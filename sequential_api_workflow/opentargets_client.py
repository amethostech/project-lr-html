import requests

BASE_URL = 'https://api.platform.opentargets.org/api/v4/graphql'

def search_disease(disease_name):
    """
    Search for a disease to get its ID (EFO ID).
    Args:
        disease_name (str): Name of the disease.
    Returns:
        dict: The first hit containing id and name, or None.
    """
    query = """
        query Search($queryString: String!) {
            search(queryString: $queryString, entityNames: ["disease"], page: { size: 1, index: 0 }) {
                hits {
                    id
                    name
                }
            }
        }
    """
    
    try:
        response = requests.post(BASE_URL, json={
            'query': query,
            'variables': {'queryString': disease_name}
        })
        response.raise_for_status()
        
        data = response.json()
        hits = data.get('data', {}).get('search', {}).get('hits', [])
        
        if hits:
            return hits[0] # {'id': 'EFO_0000384', 'name': "Crohn's disease"}
        return None
        
    except Exception as e:
        if 'response' in locals() and response is not None:
            print(f"OpenTargets Search Error Response: {response.text}")
        print(f"OpenTargets Search Error: {e}")
        return None

def get_disease_gene_associations(efo_id, limit=10):
    """
    Get genes associated with a disease.
    Args:
        efo_id (str): The EFO ID of the disease.
        limit (int): Number of associations to return.
    Returns:
        list: List of dictionaries containing gene details.
    """
    query = """
        query DiseaseAssociations($efoId: String!, $size: Int!) {
            disease(efoId: $efoId) {
                id
                name
                associatedTargets(page: { size: $size, index: 0 }) {
                    rows {
                        target {
                            id
                            approvedSymbol
                            approvedName
                        }
                        score
                    }
                }
            }
        }
    """
    
    try:
        response = requests.post(BASE_URL, json={
            'query': query,
            'variables': {'efoId': efo_id, 'size': limit}
        })
        response.raise_for_status()
        
        data = response.json()
        rows = data.get('data', {}).get('disease', {}).get('associatedTargets', {}).get('rows', [])
        
        results = []
        for row in rows:
            target = row.get('target', {})
            results.append({
                'geneId': target.get('id'),
                'symbol': target.get('approvedSymbol'),
                'name': target.get('approvedName'),
                'score': row.get('score'),
                'diseaseId': efo_id # Keep context
            })
            
        return results
        
    except Exception as e:
        print(f"OpenTargets Associations Error: {e}")
        return []

if __name__ == "__main__":
    # Test
    d = search_disease("type 2 diabetes")
    print(f"Search Result: {d}")
    if d:
        genes = get_disease_gene_associations(d['id'], 5)
        print(f"Top 5 Genes: {genes}")
