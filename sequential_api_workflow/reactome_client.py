import requests

BASE_URL = 'https://reactome.org/ContentService'

def get_pathways_for_entity(identifier):
    """
    Get pathways for a given entity (e.g., Gene Symbol).
    Args:
        identifier (str): Gene symbol or ID (e.g. "PTEN").
    Returns:
        list: List of pathway dictionaries.
    """
    try:
        # Handle comma-separated list
        if ',' in identifier:
            entities = [e.strip() for e in identifier.split(',')]
        else:
            entities = [identifier]
            
        all_pathways = []
        seen_ids = set()

        for entity in entities:
            # Search for the entity first to handle symbols
            url = f"{BASE_URL}/search/query?query={requests.utils.quote(entity)}&cluster=true"
            
            response = requests.get(url)
            if response.status_code != 200:
                continue
            
            data = response.json()
            results = data.get('results', [])
            
            for group in results:
                if group.get('typeName') == 'Pathway':
                    for r in group.get('entries', []):
                        st_id = r.get('stId')
                        if st_id and st_id not in seen_ids:
                            all_pathways.append({
                                'stId': st_id,
                                'name': r.get('name'),
                                'species': r.get('species'),
                                'associatedGene': entity
                            })
                            seen_ids.add(st_id)
        
        return all_pathways[:20] # Return top 20 matches
        
    except Exception as e:
        print(f"Reactome Error: {e}")
        return []

if __name__ == "__main__":
    # Test
    p = get_pathways_for_entity("ASGR1")
    print(f"Pathways for ASGR1: {p}")
