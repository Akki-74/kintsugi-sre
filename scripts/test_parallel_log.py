import time
import glob
import re
import os
import json
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
import numpy as np
import pandas as pd

NEZHA_PATH = Path("c:/Users/akank/Downloads/k8/Nezha")

def parse_single_log_file(args):
    fpath, service_phrases = args
    try:
        df = pd.read_csv(fpath, usecols=['TimeUnixNano', 'PodName', 'Log'])
    except Exception:
        return []
    if df.empty:
        return []
    
    # Pre-compile regexes
    err_pat = re.compile(r'"severity":"(error|warning|fatal)"|exception|failed|error|timeout|unhealthy', re.IGNORECASE)
    http_pat = re.compile(r'"http\.resp\.status":[45]')
    took_pat = re.compile(r'"http\.resp\.took_ms":(\d+)')
    
    rc_pats = {}
    for svc, phrases in service_phrases.items():
        if phrases:
            rc_pats[svc] = re.compile("|".join(re.escape(p) for p in phrases), re.IGNORECASE)
            
    pods = df['PodName'].astype(str).to_numpy()
    logs = df['Log'].astype(str).to_numpy()
    epochs = (pd.to_numeric(df['TimeUnixNano'], errors='coerce').fillna(0).to_numpy() // 10**9).astype(int)
    minutes = (epochs // 60) * 60
    
    # Aggregate by (service, minute_bucket)
    from collections import defaultdict
    acc = defaultdict(lambda: {'count': 0, 'errors': 0, 'http_errs': 0, 'took_ms_sum': 0.0, 'took_ms_cnt': 0, 'took_ms_max': 0.0, 'rc_hits': 0})
    
    for pod, log, mb in zip(pods, logs, minutes):
        svc = pod.split('-')[0]
        key = (svc, mb)
        st = acc[key]
        st['count'] += 1
        if err_pat.search(log):
            st['errors'] += 1
        if http_pat.search(log):
            st['http_errs'] += 1
        if svc in rc_pats and rc_pats[svc].search(log):
            st['rc_hits'] += 1
        m = took_pat.search(log)
        if m:
            val = float(m.group(1))
            st['took_ms_sum'] += val
            st['took_ms_cnt'] += 1
            if val > st['took_ms_max']:
                st['took_ms_max'] = val
                
    rows = []
    for (svc, mb), st in acc.items():
        rows.append({
            'service': svc,
            'minute_bucket': mb,
            'log_total_count': st['count'],
            'log_error_count': st['errors'],
            'log_http_err_count': st['http_errs'],
            'log_took_ms_mean': st['took_ms_sum'] / max(st['took_ms_cnt'], 1),
            'log_took_ms_max': st['took_ms_max'],
            'log_rc_template_hits': st['rc_hits']
        })
    return rows

def test_parallel():
    rc_path = NEZHA_PATH / "construct_data" / "root_cause_hipster.json"
    with open(rc_path, "r", encoding="utf-8") as f:
        rc_keywords = json.load(f)
        
    service_phrases = {}
    for svc, mapping in rc_keywords.items():
        phrases = []
        for k, v in mapping.items():
            if k in ["return", "exception"] and isinstance(v, str):
                phrases.extend([p.strip() for p in v.split("_") if p.strip()])
        service_phrases[svc] = phrases
        
    log_files = sorted(glob.glob(str(NEZHA_PATH / "rca_data" / "2022-08-22" / "log" / "*_log.csv")))
    print(f"Testing parallel parse on {len(log_files)} files...")
    t0 = time.time()
    args_list = [(f, service_phrases) for f in log_files]
    
    with ProcessPoolExecutor(max_workers=8) as executor:
        all_results = list(executor.map(parse_single_log_file, args_list))
        
    flat_rows = [row for file_rows in all_results for row in file_rows]
    df = pd.DataFrame(flat_rows)
    grouped = df.groupby(['service', 'minute_bucket'], as_index=False).agg(
        log_total_count=('log_total_count', 'sum'),
        log_error_count=('log_error_count', 'sum'),
        log_http_err_count=('log_http_err_count', 'sum'),
        log_took_ms_mean=('log_took_ms_mean', 'mean'),
        log_took_ms_max=('log_took_ms_max', 'max'),
        log_rc_template_hits=('log_rc_template_hits', 'sum')
    )
    t1 = time.time()
    print(f"Parsed and aggregated all 72 files in {t1-t0:.2f}s! Result shape: {grouped.shape}")
    print(grouped.head())

if __name__ == "__main__":
    test_parallel()
