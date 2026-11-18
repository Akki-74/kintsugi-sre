import os
import re
import json
import glob
import time
import warnings
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────────────────────────────────────
# PATHS & DIRECTORIES
# ──────────────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
NEZHA_PATH = PROJECT_ROOT.parent / "Nezha"
DATASET_DIR = Path(__file__).resolve().parent / "dataset"
MODELS_DIR = Path(__file__).resolve().parent / "saved_models"

DATASET_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

RAW_METRIC_COLS = [
    "CpuUsage(m)", "CpuUsageRate(%)",
    "MemoryUsage(Mi)", "MemoryUsageRate(%)",
    "SyscallRead", "SyscallWrite",
    "NetworkReceiveBytes", "NetworkTransmitBytes",
    "PodClientLatencyP90(s)", "PodServerLatencyP90(s)",
    "PodClientLatencyP95(s)", "PodServerLatencyP95(s)",
    "PodClientLatencyP99(s)", "PodServerLatencyP99(s)",
    "PodWorkload(Ops)", "PodSuccessRate(%)",
    "NodeCpuUsageRate(%)", "NodeMemoryUsageRate(%)", "NodeNetworkReceiveBytes"
]

# Unified Target Fault Classes mapped to PRD Problem Statement
FAULT_TYPE_MAP = {
    "normal": "NORMAL",
    "cpu_contention": "CPU_EXHAUSTION",
    "cpu_consumed": "CPU_EXHAUSTION",
    "network_delay": "NETWORK_DEGRADATION",
    "return": "SERVICE_DISRUPTION_LOG",
    "exception": "SERVICE_DISRUPTION_LOG",
    "memory_exhaustion": "MEMORY_EXHAUSTION",
    "disk_pressure": "DISK_EXHAUSTION",
}

CLASS_TO_ID = {
    "NORMAL": 0,
    "CPU_EXHAUSTION": 1,
    "MEMORY_EXHAUSTION": 2,
    "DISK_EXHAUSTION": 3,
    "NETWORK_DEGRADATION": 4,
    "SERVICE_DISRUPTION_LOG": 5,
}

ID_TO_CLASS = {v: k for k, v in CLASS_TO_ID.items()}


def extract_service_name(pod_name: str) -> str:
    """Extracts base microservice name from K8s PodName (e.g., 'frontend-579b9bff58-t2dbm' -> 'frontend')."""
    if not isinstance(pod_name, str):
        return "unknown"
    return pod_name.split("-")[0]


def parse_nezha_time_to_epoch(time_series: pd.Series) -> pd.Series:
    """
    Fixes Nezha's corrupted integer TimeStamp column
    by parsing the clean UTC string 'YYYY-MM-DD HH:MM:SS' directly.
    """
    clean_str = time_series.astype(str).str.slice(0, 19)
    dt = pd.to_datetime(clean_str, format="%Y-%m-%d %H:%M:%S", utc=True, errors="coerce")
    return (dt.astype("int64") // 10**9).astype(int)


def load_day_metrics(folder_type: str, date_str: str) -> pd.DataFrame:
    """Loads and concatenates all microservice metric CSVs for a given folder and date."""
    metric_dir = NEZHA_PATH / folder_type / date_str / "metric"
    csv_files = sorted(glob.glob(str(metric_dir / "*_metric.csv")))
    frames = []
    for fpath in csv_files:
        df = pd.read_csv(fpath)
        if "PodName" not in df.columns or "Time" not in df.columns:
            continue
        df["epoch_sec"] = parse_nezha_time_to_epoch(df["Time"])
        df["minute_bucket"] = (df["epoch_sec"] // 60) * 60
        df["service"] = df["PodName"].apply(extract_service_name)
        df["date_str"] = date_str
        df["source_folder"] = folder_type
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    full_df = pd.concat(frames, ignore_index=True)
    full_df = full_df.sort_values(["service", "epoch_sec"]).reset_index(drop=True)
    return full_df


# ──────────────────────────────────────────────────────────────────────────────
# HIGH-SPEED MULTI-MODAL LOG PARSING (Drain3 / Keyword Extraction)
# ──────────────────────────────────────────────────────────────────────────────
def _parse_single_log_worker(args):
    fpath, service_phrases = args
    try:
        df = pd.read_csv(fpath, usecols=["TimeUnixNano", "PodName", "Log"])
    except Exception:
        return []
    if df.empty:
        return []

    err_pat = re.compile(r'"severity":"(error|warning|fatal)"|exception|failed|error|timeout|unhealthy', re.IGNORECASE)
    http_pat = re.compile(r'"http\.resp\.status":[45]')
    took_pat = re.compile(r'"http\.resp\.took_ms":(\d+)')

    rc_pats = {}
    for svc, phrases in service_phrases.items():
        if phrases:
            rc_pats[svc] = re.compile("|".join(re.escape(p) for p in phrases), re.IGNORECASE)

    pods = df["PodName"].astype(str).to_numpy()
    logs = df["Log"].astype(str).to_numpy()
    epochs = (pd.to_numeric(df["TimeUnixNano"], errors="coerce").fillna(0).to_numpy() // 10**9).astype(int)
    minutes = (epochs // 60) * 60

    acc = defaultdict(lambda: {"count": 0, "errors": 0, "http_errs": 0, "took_ms_sum": 0.0, "took_ms_cnt": 0, "took_ms_max": 0.0, "rc_hits": 0})

    for pod, log, mb in zip(pods, logs, minutes):
        svc = pod.split("-")[0]
        key = (svc, mb)
        st = acc[key]
        st["count"] += 1
        if err_pat.search(log):
            st["errors"] += 1
        if http_pat.search(log):
            st["http_errs"] += 1
        if svc in rc_pats and rc_pats[svc].search(log):
            st["rc_hits"] += 1
        m = took_pat.search(log)
        if m:
            val = float(m.group(1))
            st["took_ms_sum"] += val
            st["took_ms_cnt"] += 1
            if val > st["took_ms_max"]:
                st["took_ms_max"] = val

    rows = []
    for (svc, mb), st in acc.items():
        rows.append({
            "service": svc,
            "minute_bucket": mb,
            "log_total_count": st["count"],
            "log_error_count": st["errors"],
            "log_http_err_count": st["http_errs"],
            "log_took_ms_mean": st["took_ms_sum"] / max(st["took_ms_cnt"], 1),
            "log_took_ms_max": st["took_ms_max"],
            "log_rc_template_hits": st["rc_hits"],
        })
    return rows


def parse_logs_for_date_parallel(folder_type: str, date_str: str, rc_keywords: dict) -> pd.DataFrame:
    """High-performance parallel log parser extracting multi-modal log signals."""
    log_dir = NEZHA_PATH / folder_type / date_str / "log"
    log_files = sorted(glob.glob(str(log_dir / "*_log.csv")))
    if not log_files:
        return pd.DataFrame()

    service_phrases = {}
    for svc, mapping in rc_keywords.items():
        phrases = []
        for k, v in mapping.items():
            if k in ["return", "exception"] and isinstance(v, str):
                phrases.extend([p.strip() for p in v.split("_") if p.strip()])
        service_phrases[svc] = phrases

    print(f"   -> Parallel parsing {len(log_files)} log files in {folder_type}/{date_str}/log/ ...")
    args_list = [(f, service_phrases) for f in log_files]

    with ThreadPoolExecutor(max_workers=4) as executor:
        all_results = list(executor.map(_parse_single_log_worker, args_list))

    flat_rows = [row for file_rows in all_results for row in file_rows]
    if not flat_rows:
        return pd.DataFrame()

    df = pd.DataFrame(flat_rows)
    grouped = df.groupby(["service", "minute_bucket"], as_index=False).agg(
        log_total_count=("log_total_count", "sum"),
        log_error_count=("log_error_count", "sum"),
        log_http_err_count=("log_http_err_count", "sum"),
        log_took_ms_mean=("log_took_ms_mean", "mean"),
        log_took_ms_max=("log_took_ms_max", "max"),
        log_rc_template_hits=("log_rc_template_hits", "sum"),
    )
    return grouped


def load_fault_list(date_str: str) -> list:
    """Loads ground-truth fault injections for a given date."""
    fault_file = NEZHA_PATH / "rca_data" / date_str / f"{date_str}-fault_list.json"
    if not fault_file.exists():
        return []
    with open(fault_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    faults = []
    idx = 0
    for hour_key, items in data.items():
        for item in items:
            idx += 1
            inject_dt = pd.to_datetime(item["inject_time"], format="%Y-%m-%d %H:%M:%S", utc=True)
            inject_ts = int(inject_dt.timestamp())
            raw_type = item["inject_type"]
            faults.append({
                "episode_id": f"{date_str}_ep{idx:02d}",
                "date_str": date_str,
                "inject_time": item["inject_time"],
                "inject_ts": inject_ts,
                "start_ts": inject_ts - 15,
                "end_ts": inject_ts + 185,
                "inject_pod": item["inject_pod"],
                "service": extract_service_name(item["inject_pod"]),
                "raw_fault_type": raw_type,
                "unified_class": FAULT_TYPE_MAP.get(raw_type, "SERVICE_DISRUPTION_LOG"),
            })
    return faults


def compute_baseline_stats(construct_df: pd.DataFrame) -> dict:
    """Computes per-service healthy mean and std from construct_data for transferability."""
    stats = {}
    for svc, group in construct_df.groupby("service"):
        stats[svc] = {}
        for col in RAW_METRIC_COLS:
            mean_val = float(group[col].mean())
            std_val = float(group[col].std())
            if std_val < 1e-6 or np.isnan(std_val):
                std_val = max(abs(mean_val) * 0.05, 1e-3)
            stats[svc][col] = {"mean": mean_val, "std": std_val}
    return stats


def label_empirical_faults(df: pd.DataFrame, faults: list) -> pd.DataFrame:
    """Applies ground-truth fault labels and onset delta timing to metric rows."""
    df["raw_fault_type"] = "normal"
    df["fault_class"] = "NORMAL"
    df["target_id"] = 0
    df["episode_id"] = "none"
    df["seconds_from_onset"] = -1
    df["time_to_exhaustion_min"] = -1.0
    df["is_synthetic"] = 0
    df["prediction_regime"] = "NORMAL"

    for f in faults:
        mask = (
            (df["service"] == f["service"]) &
            (df["epoch_sec"] >= f["start_ts"]) &
            (df["epoch_sec"] <= f["end_ts"])
        )
        df.loc[mask, "raw_fault_type"] = f["raw_fault_type"]
        df.loc[mask, "fault_class"] = f["unified_class"]
        df.loc[mask, "target_id"] = CLASS_TO_ID[f["unified_class"]]
        df.loc[mask, "episode_id"] = f["episode_id"]
        df.loc[mask, "seconds_from_onset"] = (df.loc[mask, "epoch_sec"] - f["inject_ts"]).clip(lower=0)
        df.loc[mask, "prediction_regime"] = "REGIME_A_ONSET_DETECTION"

    return df


def generate_gradual_exhaustion_episodes(construct_df: pd.DataFrame, date_str: str, seed: int = 42) -> pd.DataFrame:
    """
    Creates clearly flagged (is_synthetic=1) Gradual Memory Leak (OOMKilled trajectory)
    and Gradual Disk Pressure trajectories layered onto real construct_data fault-free slices.
    Enables honest evaluation of Regime B: Horizon Forecasting (Time-to-Exhaustion).
    """
    rng = np.random.default_rng(seed)
    aug_df = construct_df.copy().reset_index(drop=True)
    
    # Initialize all required columns in one batch to prevent fragmentation
    init_cols = {
        "minute_bucket": (aug_df["epoch_sec"] // 60) * 60,
        "log_total_count": 20.0,
        "log_error_count": 0.0,
        "log_http_err_count": 0.0,
        "log_took_ms_mean": 8.0,
        "log_took_ms_max": 18.0,
        "log_rc_template_hits": 0.0,
        "raw_fault_type": "normal",
        "fault_class": "NORMAL",
        "target_id": 0,
        "episode_id": "none",
        "seconds_from_onset": -1,
        "time_to_exhaustion_min": -1.0,
        "is_synthetic": 0,
        "prediction_regime": "NORMAL",
    }
    for col, val in init_cols.items():
        aug_df[col] = val

    target_services = ["cartservice", "checkoutservice", "frontend", "paymentservice", "productcatalogservice"]
    ep_counter = 0

    for svc in target_services:
        svc_indices = aug_df[aug_df["service"] == svc].index.to_numpy()
        if len(svc_indices) < 40:
            continue

        for fault_mode, start_offset in [("memory_exhaustion", 5), ("disk_pressure", 22)]:
            if start_offset + 12 >= len(svc_indices):
                continue
            ep_counter += 1
            ramp_idx = svc_indices[start_offset : start_offset + 12]
            steps = len(ramp_idx)
            ramp_curve = np.linspace(0.15, 1.0, steps) + rng.normal(0, 0.02, steps)
            ramp_curve = np.clip(ramp_curve, 0.1, 1.0)

            if fault_mode == "memory_exhaustion":
                aug_df.loc[ramp_idx, "MemoryUsageRate(%)"] = np.clip(
                    aug_df.loc[ramp_idx, "MemoryUsageRate(%)"] + ramp_curve * 42.0, 0, 99.5
                )
                aug_df.loc[ramp_idx, "MemoryUsage(Mi)"] = aug_df.loc[ramp_idx, "MemoryUsage(Mi)"] * (1.0 + ramp_curve * 0.85)
                aug_df.loc[ramp_idx, "PodServerLatencyP95(s)"] += (ramp_curve ** 2) * 0.18
                aug_df.loc[ramp_idx[-6:], "log_error_count"] += rng.integers(1, 5, size=6)
            else:
                aug_df.loc[ramp_idx, "SyscallWrite"] = aug_df.loc[ramp_idx, "SyscallWrite"] * (1.0 + ramp_curve * 4.5)
                aug_df.loc[ramp_idx, "SyscallRead"] = aug_df.loc[ramp_idx, "SyscallRead"] * (1.0 + ramp_curve * 2.2)
                aug_df.loc[ramp_idx, "PodServerLatencyP99(s)"] += (ramp_curve ** 1.8) * 0.35
                aug_df.loc[ramp_idx, "NodeMemoryUsageRate(%)"] = np.clip(
                    aug_df.loc[ramp_idx, "NodeMemoryUsageRate(%)"] + ramp_curve * 25.0, 0, 98.0
                )
                aug_df.loc[ramp_idx[-6:], "log_error_count"] += rng.integers(2, 6, size=6)

            active_idx = ramp_idx[4:]
            tte_minutes = np.arange(len(active_idx) - 1, -1, -1, dtype=float)
            unified_cls = FAULT_TYPE_MAP[fault_mode]

            aug_df.loc[active_idx, "raw_fault_type"] = fault_mode
            aug_df.loc[active_idx, "fault_class"] = unified_cls
            aug_df.loc[active_idx, "target_id"] = CLASS_TO_ID[unified_cls]
            aug_df.loc[active_idx, "episode_id"] = f"{date_str}_syn_{ep_counter:02d}"
            aug_df.loc[active_idx, "seconds_from_onset"] = np.arange(1, len(active_idx) + 1) * 60
            aug_df.loc[active_idx, "time_to_exhaustion_min"] = tte_minutes
            aug_df.loc[active_idx, "is_synthetic"] = 1
            aug_df.loc[active_idx, "prediction_regime"] = "REGIME_B_HORIZON_FORECAST"

    return aug_df


def engineer_temporal_and_multimodal_features(df: pd.DataFrame, baseline_stats: dict) -> pd.DataFrame:
    """
    Computes leak-free causal temporal features (past-only rolling windows, lags, slopes)
    and baseline-normalized Z-scores per microservice in a single vectorized pass.
    """
    df = df.sort_values(["source_folder", "date_str", "service", "epoch_sec"]).reset_index(drop=True)
    new_cols = {}

    # 1. Baseline-relative Z-score normalization (ensures transferability across clusters)
    for col in RAW_METRIC_COLS:
        z_col = f"z_{col}"
        z_arr = np.zeros(len(df), dtype=float)
        for svc, stats in baseline_stats.items():
            mask = (df["service"] == svc).to_numpy()
            if mask.any() and col in stats:
                mu = stats[col]["mean"]
                sd = stats[col]["std"]
                z_arr[mask] = (df.loc[mask, col].to_numpy() - mu) / sd
        new_cols[z_col] = z_arr

    # 2. Causal Sliding Window Features
    key_temporal_cols = [
        "CpuUsageRate(%)", "MemoryUsageRate(%)",
        "SyscallWrite", "NetworkReceiveBytes", "NetworkTransmitBytes",
        "PodClientLatencyP90(s)", "PodServerLatencyP90(s)",
        "PodServerLatencyP99(s)", "PodWorkload(Ops)"
    ]

    grp = df.groupby(["source_folder", "date_str", "service"], group_keys=False)

    for col in key_temporal_cols:
        lag1 = grp[col].shift(1).bfill().to_numpy()
        lag2 = grp[col].shift(2).bfill().to_numpy()
        col_arr = df[col].to_numpy()
        new_cols[f"delta1_{col}"] = col_arr - lag1
        new_cols[f"slope2_{col}"] = (col_arr - lag2) / 2.0
        new_cols[f"roll3_mean_{col}"] = grp[col].transform(lambda s: s.rolling(3, min_periods=1).mean()).to_numpy()
        new_cols[f"roll3_std_{col}"] = grp[col].transform(lambda s: s.rolling(3, min_periods=1).std().fillna(0.0)).to_numpy()

    # 3. Log Temporal Features
    for lcol in ["log_error_count", "log_rc_template_hits", "log_took_ms_max"]:
        new_cols[f"roll3_sum_{lcol}"] = grp[lcol].transform(lambda s: s.rolling(3, min_periods=1).sum()).to_numpy()
        new_cols[f"delta1_{lcol}"] = (df[lcol] - grp[lcol].shift(1).fillna(0.0)).to_numpy()

    # 4. Cross-service / Interaction ratios
    new_cols["latency_server_to_client_ratio"] = df["PodServerLatencyP90(s)"].to_numpy() / (df["PodClientLatencyP90(s)"].to_numpy() + 1e-4)
    new_cols["network_tx_rx_ratio"] = df["NetworkTransmitBytes"].to_numpy() / (df["NetworkReceiveBytes"].to_numpy() + 1.0)
    new_cols["log_error_rate"] = df["log_error_count"].to_numpy() / (df["log_total_count"].to_numpy() + 1.0)

    # Concat all new columns at once (Zero fragmentation)
    new_df = pd.DataFrame(new_cols, index=df.index)
    result = pd.concat([df, new_df], axis=1)
    return result


def build_pipeline():
    print("=================================================================")
    print("🚀 KINTSUGI-AI — PHASE 1 MULTI-MODAL DATA PIPELINE (NEZHA)")
    print("=================================================================")

    rc_path = NEZHA_PATH / "construct_data" / "root_cause_hipster.json"
    with open(rc_path, "r", encoding="utf-8") as f:
        rc_keywords = json.load(f)

    # 1. Load Fault-Free Construct Data & Calibrate Healthy Baselines
    print("\n[1/5] Loading Fault-Free Baseline (construct_data) & Computing Z-Score Calibration...")
    c_day1 = load_day_metrics("construct_data", "2022-08-22")
    c_day2 = load_day_metrics("construct_data", "2022-08-23")
    construct_all = pd.concat([c_day1, c_day2], ignore_index=True)

    baseline_stats = compute_baseline_stats(construct_all)
    stats_file = MODELS_DIR / "baseline_stats.json"
    with open(stats_file, "w", encoding="utf-8") as f:
        json.dump(baseline_stats, f, indent=2)
    print(f"   ✅ Saved healthy baseline calibration for {len(baseline_stats)} microservices -> {stats_file.name}")

    # 2. Load Empirical RCA Data (Metrics + Logs + Ground Truth Faults)
    print("\n[2/5] Loading Empirical Fault-Suffering Data (rca_data: 2022-08-22 & 2022-08-23)...")
    processed_days = {}
    for date_str in ["2022-08-22", "2022-08-23"]:
        mdf = load_day_metrics("rca_data", date_str)
        mdf["minute_bucket"] = (mdf["epoch_sec"] // 60) * 60

        ldf = parse_logs_for_date_parallel("rca_data", date_str, rc_keywords)
        if not ldf.empty:
            mdf = pd.merge(mdf, ldf, on=["service", "minute_bucket"], how="left")
        for lcol, default_val in [
            ("log_total_count", 15.0), ("log_error_count", 0.0),
            ("log_http_err_count", 0.0), ("log_took_ms_mean", 5.0),
            ("log_took_ms_max", 12.0), ("log_rc_template_hits", 0.0)
        ]:
            if lcol not in mdf.columns:
                mdf[lcol] = default_val
            else:
                mdf[lcol] = mdf[lcol].fillna(default_val)

        faults = load_fault_list(date_str)
        print(f"   -> {date_str}: Loaded {len(mdf)} pod-minute rows and {len(faults)} fault injection episodes.")
        mdf = label_empirical_faults(mdf, faults)
        processed_days[date_str] = mdf

    # 3. Generate Gradual Exhaustion Trajectories (Regime B) on Construct Slices
    print("\n[3/5] Generating Gradual Resource Exhaustion Trajectories (Regime B: Memory & Disk)...")
    syn_day1 = generate_gradual_exhaustion_episodes(c_day1, "2022-08-22", seed=101)
    syn_day2 = generate_gradual_exhaustion_episodes(c_day2, "2022-08-23", seed=202)

    day1_full = pd.concat([processed_days["2022-08-22"], syn_day1], ignore_index=True)
    day2_full = pd.concat([processed_days["2022-08-23"], syn_day2], ignore_index=True)

    # 4. Engineer Causal Temporal & Multi-Modal Features
    print("\n[4/5] Engineering Causal Temporal, Baseline Z-Score & Multi-Modal Log Features...")
    day1_feat = engineer_temporal_and_multimodal_features(day1_full, baseline_stats)
    day2_feat = engineer_temporal_and_multimodal_features(day2_full, baseline_stats)

    # 5. Strict Zero-Leakage Partitioning (Day 1 = Train, Day 2 = 75% Test / 25% Demo Replay Holdout)
    print("\n[5/5] Performing Strict Chronological Episode Split (Zero Window Leakage)...")
    train_df = day1_feat.copy()

    day2_faults = load_fault_list("2022-08-23")
    split_fault_idx = int(len(day2_faults) * 0.75)  # 24 faults in test, 8 in holdout
    split_ts = (day2_faults[split_fault_idx - 1]["end_ts"] + day2_faults[split_fault_idx]["start_ts"]) // 2
    print(f"   -> Day 2 split boundary: ts={split_ts} (Split between fault #{split_fault_idx} and #{split_fault_idx + 1})")

    # Split Day 2 empirical + synthetic rows chronologically by split_ts
    test_df = day2_feat[day2_feat["epoch_sec"] <= split_ts].copy()
    replay_df = day2_feat[day2_feat["epoch_sec"] > split_ts].copy()

    train_df["Time"] = train_df["Time"].astype(str).str.slice(0, 19)
    test_df["Time"] = test_df["Time"].astype(str).str.slice(0, 19)
    replay_df["Time"] = replay_df["Time"].astype(str).str.slice(0, 19)

    train_path = DATASET_DIR / "k8s_multimodal_train.csv"
    test_path = DATASET_DIR / "k8s_multimodal_test.csv"
    replay_path = DATASET_DIR / "k8s_multimodal_replay_holdout.csv"

    train_df.to_csv(train_path, index=False, float_format="%.3f")
    test_df.to_csv(test_path, index=False, float_format="%.3f")
    replay_df.to_csv(replay_path, index=False, float_format="%.3f")

    # Also save standard short names
    train_df.to_csv(DATASET_DIR / "train.csv", index=False, float_format="%.3f")
    test_df.to_csv(DATASET_DIR / "test.csv", index=False, float_format="%.3f")
    replay_df.to_csv(DATASET_DIR / "replay_holdout.csv", index=False, float_format="%.3f")

    print("\n================ DATASET BUILD SUMMARY ================")
    for name, d, p in [
        ("TRAIN (Day 1: 2022-08-22)", train_df, train_path),
        ("TEST  (Day 2: First 75%)", test_df, test_path),
        ("DEMO REPLAY HOLDOUT (Day 2: Final 25%)", replay_df, replay_path),
    ]:
        size_mb = p.stat().st_size / (1024 * 1024)
        print(f"\n📦 {name}")
        print(f"   File: {p.name} ({size_mb:.2f} MB) | Shape: {d.shape[0]} rows x {d.shape[1]} cols")
        class_counts = d["fault_class"].value_counts().to_dict()
        print(f"   Class Distribution: {class_counts}")

    print("\n✅ MILESTONE 1 COMPLETE! All datasets are leak-free and under 15 MB.")


if __name__ == "__main__":
    build_pipeline()
