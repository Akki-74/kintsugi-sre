import time
import re
import pandas as pd
from collections import defaultdict

t0 = time.time()
df = pd.read_csv('C:/Users/akank/Downloads/k8/Nezha/rca_data/2022-08-22/log/03_53_log.csv', usecols=['TimeUnixNano', 'PodName', 'Log'])
t1 = time.time()

err_pat = re.compile(r'"severity":"(error|warning|fatal)"|exception|failed|error|timeout|unhealthy', re.IGNORECASE)
http_pat = re.compile(r'"http\.resp\.status":[45]')
took_pat = re.compile(r'"http\.resp\.took_ms":(\d+)')

pods = df['PodName'].astype(str).to_numpy()
logs = df['Log'].astype(str).to_numpy()

stats = defaultdict(lambda: {'total': 0, 'errors': 0, 'http_errs': 0, 'took_ms_sum': 0, 'took_ms_cnt': 0, 'took_ms_max': 0.0})

for pod, log in zip(pods, logs):
    svc = pod.split('-')[0]
    st = stats[svc]
    st['total'] += 1
    if err_pat.search(log):
        st['errors'] += 1
    if http_pat.search(log):
        st['http_errs'] += 1
    m = took_pat.search(log)
    if m:
        val = int(m.group(1))
        st['took_ms_sum'] += val
        st['took_ms_cnt'] += 1
        if val > st['took_ms_max']:
            st['took_ms_max'] = float(val)

t2 = time.time()
print(f"CSV read: {t1-t0:.3f}s, Processing 25k logs: {t2-t1:.3f}s, Total per file: {t2-t0:.3f}s")
for svc, s in list(stats.items())[:3]:
    mean_took = s['took_ms_sum'] / max(s['took_ms_cnt'], 1)
    print(f"  {svc}: total={s['total']}, err={s['errors']}, http_err={s['http_errs']}, mean_took={mean_took:.1f}ms, max_took={s['took_ms_max']}ms")
