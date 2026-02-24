import pandas as pd
import json
import urllib.request
import time

def extract_drugs(interventions_str):
    if pd.isna(interventions_str): return []
    drugs = []
    
    # Try different formats depending on how interventions are stored
    # Sometime it's "DRUG: Aspirin | PROCEDURE: Surgery"
    # Sometimes it's a list or JSON
    if isinstance(interventions_str, str):
        if "DRUG:" in interventions_str:
            parts = interventions_str.split('|')
            for p in parts:
                p = p.strip()
                if p.startswith('DRUG:'):
                    drug = p.replace('DRUG:', '').strip()
                    drugs.append(drug)
        elif "Drug: " in interventions_str:
             parts = interventions_str.split('|')
             for p in parts:
                 p = p.strip()
                 if p.startswith('Drug:'):
                     drug = p.replace('Drug:', '').strip()
                     drugs.append(drug)
        else:
             # Just assume the whole string is the drug if no prefix and we filtered rows
             pass
    
    return drugs

print("Reading ailment index...")
ailment_df = pd.read_csv('/home/anurag/Desktop/project-lr/ailment_index.csv')
cancer_terms = ailment_df[ailment_df['Category'].str.contains('Cancer', case=False, na=False)]['Term'].tolist() if 'Category' in ailment_df.columns and 'Term' in ailment_df.columns else []

print(f"Found {len(cancer_terms)} cancer terms.")

try:
    print("Reading first 50 rows of clinical trials...")
    df = pd.read_excel('/home/anurag/Desktop/project-lr/Clinical_Trials_2025.xlsx', nrows=50)
    print("\nColumns:", df.columns.tolist())
    
    for _, row in df.head(5).iterrows():
        print("\nRow Intervention:", row.get('Intervention') or row.get('Interventions'))
        print("Row Conditions:", row.get('Condition') or row.get('Conditions'))
        
except Exception as e:
    print('Error:', e)
