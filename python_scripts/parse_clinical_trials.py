import pandas as pd
import requests
import json
import time

def fetch_moa(drug_name):
    """Fetch mechanism of action from PubChem for a given drug name."""
    print(f"Fetching MOA for: {drug_name}...")
    try:
        url_cid = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{drug_name}/cids/JSON"
        res_cid = requests.get(url_cid, timeout=10)
        
        if res_cid.status_code == 404:
            return "Drug not found in PubChem"
        
        cid_data = res_cid.json()
        cids = cid_data.get('IdentifierList', {}).get('CID', [])
        if not cids:
            return "CID not found"
            
        cid = cids[0]
        url_profile = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON"
        res_profile = requests.get(url_profile, timeout=10)
        
        if res_profile.status_code == 404:
            return "Profile not found"
            
        profile_data = res_profile.json()
        
        def find_moa(section_list):
            for sec in section_list:
                if sec.get('TOCHeading') == 'Mechanism of Action':
                    return sec
                if 'Section' in sec:
                    found = find_moa(sec['Section'])
                    if found:
                        return found
            return None
            
        sections = profile_data.get('Record', {}).get('Section', [])
        moa_section = find_moa(sections)
        
        if not moa_section:
            return "Mechanism of Action section not found"
            
        information = moa_section.get('Information', [])
        texts = []
        for info in information:
            val = info.get('Value', {})
            if 'StringWithMarkup' in val:
                for s in val['StringWithMarkup']:
                    if 'String' in s:
                        texts.append(s['String'])
            elif 'String' in val and isinstance(val['String'], str):
                texts.append(val['String'])
            elif isinstance(val, list):
                for v in val:
                    if isinstance(v, dict) and 'String' in v:
                        texts.append(v['String'])
                
        if texts:
            return "\n\n".join(texts)
        else:
            return "Text could not be extracted"
            
    except Exception as e:
        print(f"Error fetching MOA for {drug_name}: {e}")
        return f"Error: {e}"

def extract_drugs(interventions_str):
    """Extract drugs from the interventions string."""
    if pd.isna(interventions_str):
        return []
    
    drugs = []
    parts = str(interventions_str).split('|')
    for part in parts:
        part = part.strip()
        if part.upper().startswith('DRUG:'):
            drug_name = part[5:].strip()
            # If the drug string contains dosage (e.g. "Aspirin 50mg"), take just the first word
            drug_name = drug_name.split(' ')[0]
            drugs.append(drug_name)
    return drugs

def main():
    print("Loading ailment index...")
    try:
        # Check parent directory since script is in python_scripts/
        import os
        ailment_path = '../ailment_index.csv' if os.path.exists('../ailment_index.csv') else 'ailment_index.csv'
        ailments = pd.read_csv(ailment_path)
        if 'Keyword' in ailments.columns and 'Index' in ailments.columns:
            cancer_terms = ailments[ailments['Index'].str.contains('ONCO|CAR-T|CANCER', case=False, na=False)]['Keyword'].tolist()
        else:
            cancer_terms = ailments['Term'].tolist() if 'Term' in ailments.columns else ailments.iloc[:, 1].tolist()
            
        print(f"Found {len(cancer_terms)} cancer-related terms.")
        
    except Exception as e:
        print(f"Error reading ailment index: {e}")
        cancer_terms = ['Cancer', 'Tumor', 'Neoplasm', 'Oncology', 'Carcinoma', 'Melanoma', 'Lymphoma', 'Leukemia']

    print("\nReading Clinical Trials spreadsheet...")
    try:
        ct_path = '../Clinical_Trials_2025.xlsx' if os.path.exists('../Clinical_Trials_2025.xlsx') else 'Clinical_Trials_2025.xlsx'
        df = pd.read_excel(ct_path, engine='openpyxl')
    except Exception as e:
        print(f"Error reading Clinical Trials Data: {e}")
        return
        
    # Match various column names for conditions (e.g. 'Condition' or 'Disease')
    condition_col = next((c for c in df.columns if 'condition' in c.lower() or 'disease' in c.lower()), None)
    # Match various column names for interventions
    intervention_col = next((c for c in df.columns if 'intervent' in c.lower()), None)
    
    if not condition_col or not intervention_col:
        print("Could not find 'Conditions/Disease' or 'Interventions' columns in the dataset.")
        print("Available columns:", df.columns.tolist())
        return

    print("Filtering for Cancer trials...")
    pattern = '|'.join([f"\\b{term}\\b" for term in cancer_terms if term])
    cancer_trials = df[df[condition_col].str.contains(pattern, case=False, na=False)]
    print(f"Found {len(cancer_trials)} cancer trials out of {len(df)} total.")
    
    print("Extracting unique drugs...")
    all_drugs = set()
    for _, row in cancer_trials.iterrows():
        drugs = extract_drugs(row[intervention_col])
        all_drugs.update(drugs)
        
    unique_drugs = sorted(list(all_drugs))
    print(f"Found {len(unique_drugs)} unique drugs across cancer trials.")
    
    results = []
    print("\nStarting PubChem queries...")
    for i, drug in enumerate(unique_drugs):
        print(f"[{i+1}/{len(unique_drugs)}] ", end="")
        moa = fetch_moa(drug)
        results.append({
            'Drug Name': drug,
            'Mechanism of Action': moa
        })
        time.sleep(0.3) 
        
    print("\nGenerated Mechanisms of Action. Saving to Output Excel...")
    output_df = pd.DataFrame(results)
    
    output_filename = 'Cancer_Drugs_MOA.xlsx'
    try:
        with pd.ExcelWriter(output_filename, engine='openpyxl') as writer:
            output_df.to_excel(writer, sheet_name='Drugs & MOA', index=False)
        print(f"Success! Data written to {output_filename}")
    except Exception as e:
        print(f"Failed to write Excel. Writing to CSV instead: {e}")
        output_df.to_csv('Cancer_Drugs_MOA.csv', index=False)

if __name__ == "__main__":
    main()
