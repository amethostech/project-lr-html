import requests
import os

# Env vars would be set here
CLIENT_ID = os.environ.get('ICD11_CLIENT_ID')
CLIENT_SECRET = os.environ.get('ICD11_CLIENT_SECRET')
TOKEN_ENDPOINT = 'https://icdaccessmanagement.who.int/connect/token'
SEARCH_ENDPOINT = 'https://id.who.int/icd/entity/search'

_access_token = None

def get_access_token():
    """
    Get OAuth2 access token for ICD-11 API.
    Returns None if credentials are missing.
    """
    global _access_token
    if _access_token:
        return _access_token
        
    if not CLIENT_ID or not CLIENT_SECRET:
        return None
        
    try:
        data = {
            'grant_type': 'client_credentials',
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'scope': 'icdapi_access'
        }
        r = requests.post(TOKEN_ENDPOINT, data=data)
        r.raise_for_status()
        _access_token = r.json().get('access_token')
        return _access_token
    except Exception as e:
        print(f"ICD-11 Auth Error: {e}")
        return None

def search_icd11(query):
    """
    Search ICD-11 for a disease.
    Args:
        query (str): Disease name.
    Returns:
        list: List of results with title, code, score.
    """
    token = get_access_token()
    
    # Mock Fallback if no token
    if not token:
        # Simple mock logic for demonstration
        mock_code = "UNKNOWN"
        if "diabetes" in query.lower(): mock_code = "5A10" # Type 1 diabetes mellitus
        if "type 2" in query.lower(): mock_code = "5A11" # Type 2 diabetes mellitus
        if "cancer" in query.lower() or "tumor" in query.lower(): mock_code = "2C25" # Malignant neoplasms
        
        return [{
            'title': query,
            'code': mock_code,
            'score': 1.0, 
            'note': 'MOCKED DATA (No API Credentials)'
        }]

    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'API-Version': 'v2'
        }
        params = {'q': query, 'useFlexisearch': 'true'}
        r = requests.get(SEARCH_ENDPOINT, headers=headers, params=params)
        r.raise_for_status()
        
        data = r.json()
        results = []
        for dest in data.get('destinationEntities', []):
            results.append({
                'title': dest.get('title'),
                'code': dest.get('theCode'),
                'score': dest.get('score')
            })
        return results

    except Exception as e:
        print(f"ICD-11 Search Error: {e}")
        return []

if __name__ == "__main__":
    print(search_icd11("Type 2 diabetes"))
