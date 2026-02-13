import requests
import time

try:
    start = time.time()
    res = requests.get("http://localhost:8001/api/projection/alerts?horizon=30", timeout=30)
    end = time.time()
    print(f"Status: {res.status_code}")
    print(f"Time: {end - start:.2f}s")
    if res.status_code == 200:
        data = res.json()
        print(f"Count: {data.get('count')}")
    else:
        print(res.text)
except Exception as e:
    print(f"Error: {e}")
