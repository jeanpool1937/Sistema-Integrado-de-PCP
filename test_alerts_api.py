import requests
import json

try:
    print("Testing /api/projection/alerts...")
    res = requests.get("http://localhost:8001/api/projection/alerts?horizon=30", timeout=10)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(f"Count: {data.get('count')}")
        print(f"Alerts (first 3): {json.dumps(data.get('alerts', [])[:3], indent=2)}")
    else:
        print(f"Response: {res.text}")
except Exception as e:
    print(f"Error: {e}")
