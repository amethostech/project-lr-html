import requests
import json

BASE_URL = 'https://reactome.org/ContentService'
query = "ABCC8"
url = f"{BASE_URL}/search/query?query={query}&cluster=true"

print(f"Querying: {url}")
response = requests.get(url)

if response.status_code == 200:
    data = response.json()
    print(json.dumps(data, indent=2))
else:
    print(f"Error: {response.status_code}")
