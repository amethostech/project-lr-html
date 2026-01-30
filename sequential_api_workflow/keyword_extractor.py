import re
from collections import Counter

def extract_keywords(data_list, source_api):
    """
    Extracts potential keywords for the next step from the output of the current step.
    
    Args:
        data_list (list): List of result dictionaries from the API.
        source_api (str): The API that generated these results.
        
    Returns:
        str: Comma-separated string of top keywords (or IDs).
    """
    if not data_list:
        return ""

    source = source_api.lower().strip()

    # --- ICD-11 logic ---
    if source == 'icd11':
        # Result: [{'title': 'Type 2 diabetes', 'code': '5A11', ...}]
        # Ideally, we want the Disease Name standardized? Or Code?
        # OpenTargets Search works with Names.
        # Let's return the title of the top match.
        if len(data_list) > 0:
            return data_list[0].get('title', '')
        return ""

    # --- Open Targets logic ---
    if source == 'opentargets':
        # This could be a Search Result (Disease ID) OR Association Result (Genes)
        
        # Check if it's a Search Hit (has 'id' starting with EFO)
        first_item = data_list[0]
        if 'id' in first_item:
            id_str = str(first_item['id'])
            if id_str.startswith('EFO_') or id_str.startswith('MONDO_') or id_str.startswith('Orphanet_'):
                return id_str
            
        # Check if it's an Association Hit (has 'symbol')
        if 'symbol' in first_item:
            # Return top 5 gene symbols for Reactome
            symbols = [item.get('symbol') for item in data_list[:5] if item.get('symbol')]
            return ", ".join(symbols)

    # --- Reactome logic ---
    if source == 'reactome':
        # Returns pathways. What's next? Maybe re-validation with PubMed?
        # Extract pathway names
        pathways = [item.get('name') for item in data_list[:5] if item.get('name')]
        return ", ".join(pathways)

    # --- Default Text Extraction (PubMed, Patents) ---
    text_content = []
    for item in data_list:
        title = item.get('Title') or item.get('patent_title') or item.get('Molecule Name') or ""
        abstract = item.get('Abstract') or item.get('patent_abstract') or ""
        text_content.append(f"{title} {abstract}")

    full_text = " ".join(text_content).lower()
    words = re.findall(r'\b[a-z]{4,}\b', full_text)
    stops = {'with', 'this', 'that', 'from', 'were', 'which', 'study', 'using', 'these', 'results', 'patent', 'invention', 'method', 'system'}
    filtered_words = [w for w in words if w not in stops]
    
    common = Counter(filtered_words).most_common(5)
    keywords = [word for word, count in common]
    return ", ".join(keywords)
