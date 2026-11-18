import time
import json
from pathlib import Path
import pandas as pd
from phase1_prediction.data_pipeline import parse_logs_for_date, NEZHA_PATH

def test_log_parsing():
    rc_path = NEZHA_PATH / "construct_data" / "root_cause_hipster.json"
    with open(rc_path, "r", encoding="utf-8") as f:
        rc_keywords = json.load(f)
    
    t0 = time.time()
    df = parse_logs_for_date("rca_data", "2022-08-22", rc_keywords)
    t1 = time.time()
    print(f"Log parsing 2022-08-22: {t1-t0:.2f}s, shape: {df.shape}")
    print(df.head())

if __name__ == "__main__":
    test_log_parsing()
