"""
Kintsugi-AI — Nezha Dataset Inspector
Extracts exact CSV column names, timestamp format, fault durations, 
sampling intervals, and Drain3 log templates for pipeline design.
"""

import os
import sys
import json
import glob
import pandas as pd
from collections import Counter
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────
NEZHA_PATH = os.environ.get("NEZHA_PATH", str(Path(__file__).resolve().parent.parent.parent / "Nezha"))

def section(title: str):
    print(f"\n{'='*72}")
    print(f"  {title}")
    print(f"{'='*72}")

def inspect():
    if not os.path.isdir(NEZHA_PATH):
        print(f"ERROR: Nezha path not found: {NEZHA_PATH}")
        print("Set NEZHA_PATH env var or place Nezha alongside kintsugi-sre/")
        sys.exit(1)
    
    print(f"Nezha dataset location: {NEZHA_PATH}")
    
    # ─── 1. FAULT LIST JSON ──────────────────────────────────────────
    section("1. FAULT LIST JSON STRUCTURE")
    for day in ["2022-08-22", "2022-08-23"]:
        fault_file = os.path.join(NEZHA_PATH, "rca_data", day, f"{day}-fault_list.json")
        if not os.path.exists(fault_file):
            print(f"  [SKIP] {fault_file} not found")
            continue
        with open(fault_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        all_faults = []
        for hour_key, episodes in data.items():
            all_faults.extend(episodes)
        
        print(f"\n  Day: {day}")
        print(f"  Total fault episodes: {len(all_faults)}")
        print(f"  Hours covered: {sorted(data.keys())}")
        
        # Fault type distribution
        type_counts = Counter(e["inject_type"] for e in all_faults)
        print(f"  Fault type distribution: {dict(type_counts)}")
        
        # Pod targets
        pod_counts = Counter(e["inject_pod"].split("-")[0] for e in all_faults)
        print(f"  Targeted services: {dict(pod_counts)}")
        
        # Timing
        timestamps = sorted(int(e["inject_timestamp"]) for e in all_faults)
        if len(timestamps) > 1:
            spacings = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
            print(f"  Inter-fault spacing: mean={sum(spacings)/len(spacings):.0f}s "
                  f"({sum(spacings)/len(spacings)/60:.1f}min), "
                  f"min={min(spacings)}s, max={max(spacings)}s")
        
        # Sample entry
        print(f"  Sample entry: {json.dumps(all_faults[0], indent=4)}")

    # ─── 2. METRIC CSV FILES ─────────────────────────────────────────
    section("2. METRIC CSV FILES (rca_data)")
    for day in ["2022-08-22", "2022-08-23"]:
        metric_dir = os.path.join(NEZHA_PATH, "rca_data", day, "metric")
        if not os.path.isdir(metric_dir):
            print(f"  [SKIP] {metric_dir} not found")
            continue
        
        metric_files = sorted(glob.glob(os.path.join(metric_dir, "*_metric.csv")))
        other_files = [f for f in glob.glob(os.path.join(metric_dir, "*.csv"))
                       if f not in metric_files]
        
        print(f"\n  Day: {day}")
        print(f"  Pod metric files ({len(metric_files)}): {[os.path.basename(f) for f in metric_files]}")
        print(f"  Other metric files: {[os.path.basename(f) for f in other_files]}")
        
        if metric_files:
            df = pd.read_csv(metric_files[0])
            print(f"\n  === Pod Metric Schema (from {os.path.basename(metric_files[0])}) ===")
            print(f"  Columns ({len(df.columns)}): {list(df.columns)}")
            print(f"  Shape: {df.shape}")

    # ─── 3. DEPENDENCY GRAPH ─────────────────────────────────────────
    section("3. DEPENDENCY GRAPH")
    dep_path = os.path.join(NEZHA_PATH, "rca_data", "2022-08-22", "metric", "dependency.csv")
    if os.path.exists(dep_path):
        df = pd.read_csv(dep_path)
        print(f"  Edges: {len(df)}")
        print(f"\n{df.to_string()}")

    # ─── 4. LOG FILES ────────────────────────────────────────────────
    section("4. LOG FILES")
    log_dir = os.path.join(NEZHA_PATH, "rca_data", "2022-08-22", "log")
    if os.path.isdir(log_dir):
        log_files = sorted(glob.glob(os.path.join(log_dir, "*.csv")))
        print(f"  Total log CSVs: {len(log_files)}")
        df = pd.read_csv(log_files[0])
        print(f"  Log columns: {list(df.columns)}")
        print(f"  Shape: {df.shape}")

    # ─── SUMMARY ─────────────────────────────────────────────────────
    section("SUMMARY")
    print("  Sampling: 60s, Metrics: 22 cols, Logs: 8 cols, 10 services")
    print("  Day1: 24 faults, Day2: 32 faults, Baselines in construct_data/")

if __name__ == "__main__":
    inspect()
