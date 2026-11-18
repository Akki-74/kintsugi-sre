import time
import glob
import re
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NEZHA_PATH = Path("c:/Users/akank/Downloads/k8/Nezha")

def test_steps():
    print("Testing data loading speed...")
    # Step 1: Metric loading
    t0 = time.time()
    csv_files = sorted(glob.glob(str(NEZHA_PATH / "rca_data" / "2022-08-22" / "metric" / "*_metric.csv")))
    print(f"Found {len(csv_files)} metric files. Loading...")
    frames = []
    for f in csv_files:
        df = pd.read_csv(f)
        frames.append(df)
    mdf = pd.concat(frames, ignore_index=True)
    t1 = time.time()
    print(f"Loaded {len(mdf)} metric rows in {t1-t0:.2f}s")
    
    # Step 2: Check log files
    log_files = sorted(glob.glob(str(NEZHA_PATH / "rca_data" / "2022-08-22" / "log" / "*_log.csv")))
    print(f"Found {len(log_files)} log files.")
    
    t0 = time.time()
    ldf_sample = pd.read_csv(log_files[0], nrows=1000)
    print(f"Sample log file columns: {list(ldf_sample.columns)}")
    t1 = time.time()
    print(f"Read 1000 sample log rows in {t1-t0:.2f}s")

if __name__ == "__main__":
    test_steps()
