import pandas as pd
import re

df = pd.read_csv("ai_output.csv")

def clean_compound(name):
    name = name.strip()

    # Rule -3: Handle "Injection of X" or "Injection with X"
    inj_match = re.search(r"injection\s+(of|with)\s+(.+)", name, flags=re.IGNORECASE)
    if inj_match:
        name = inj_match.group(2).strip()

    # Rule -2: Remove duration phrases like "12 months of", "6 weeks of"
    name = re.sub(r"^\d+\s*(day|days|week|weeks|month|months|year|years|cycle|cycles)\s+of\s+", "", name, flags=re.IGNORECASE)

    # Rule -1: Remove leading dose like "0.03mg/kg", "15 mg"
    name = re.sub(r"^\d+(\.\d+)?\s*(mg|mcg|g|ml|iu)\s*(/kg)?\s*", "", name, flags=re.IGNORECASE)

    # Rule -0.5: Remove phrases like "before bronchoscopy", "before surgery"
    name = re.sub(r"\b(before|after)\s+[a-z\s]+$", "", name, flags=re.IGNORECASE)

    # Rule 0: Remove phrases like "given", "administered"
    name = re.sub(r"\b(given|administered|received).*$", "", name, flags=re.IGNORECASE)

    # Rule 1: If inner parentheses exist (not %) → take that
    inner_match = re.search(r"\(([^()%]+)\)\s*$", name)
    if inner_match:
        return inner_match.group(1).strip()


    # Remove percentage like (20%)
    name = re.sub(r"\(\d+(\.\d+)?%\)", "", name)

    # Remove "-based ..."
    name = re.sub(r"-based.*", "", name, flags=re.IGNORECASE)

    # Remove dosage forms
    name = re.sub(r"\b(injection|tablet|capsule|syrup|solution|cream|gel|oral|iv)\b.*", "", name, flags=re.IGNORECASE)

    # Remove remaining dose like "5 mg"
    name = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu)\b.*", "", name, flags=re.IGNORECASE)

    # Strip trailing punctuation
    name = re.sub(r"[,\.;:\-]+$", "", name)

    return name.strip()


def extract_and_clean(val):
    """
    From:
    Probiotics Compound (Biolosion) (DRUG), Etoposide Injection (DRUG)
    -> Biolosion,Etoposide
    """
    matches = re.findall(r"\s*([^,]+?)\s*\(DRUG\)", str(val))
    cleaned = [clean_compound(m) for m in matches]
    return ",".join(cleaned) if cleaned else None

mask = df["aindex"].astype(str).str.contains("ONCO", case=False, na=False) & \
       df["Interventions"].astype(str).str.contains("DRUG", case=False, na=False)

df["compound_name"] = None
df.loc[mask, "compound_name"] = df.loc[mask, "Interventions"].apply(extract_and_clean)

df.to_csv("drug_identified.csv", index=False)
print("Done. Intermediate output written to drug_identified.csv\n")

print("--- Step 2: Extracting Unique Drugs & Fetching Mechanism of Action ---")
# 1. Collect all unique drugs from the compound_name column
all_drugs = set()
for items in df["compound_name"].dropna():
    for d in items.split(','):
        d = d.strip()
        if d:
            all_drugs.add(d)

unique_drugs = sorted(list(all_drugs))
print(f"Found {len(unique_drugs)} unique drugs to query.")

import requests
import time

def fetch_moa(drug_name):
    """Fetch mechanism of action from PubChem for a given drug name."""
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
                        
        return "\n\n".join(texts) if texts else "Text could not be extracted"
        
    except Exception as e:
        return f"Error: {e}"

results = []
for i, drug in enumerate(unique_drugs):
    print(f"[{i+1}/{len(unique_drugs)}] Fetching MOA for: {drug} ...")
    moa = fetch_moa(drug)
    results.append({
        'Compound Name': drug,
        'Mechanism of Action': moa
    })
    time.sleep(0.3)

print("\n--- Step 3: Saving Mechanism of Action to Excel ---")
output_df = pd.DataFrame(results)
output_filename = 'Drug_Mechanism_Of_Action.xlsx'

try:
    with pd.ExcelWriter(output_filename, engine='openpyxl') as writer:
        output_df.to_excel(writer, sheet_name='Drugs & MOA', index=False)
    print(f"Success! Data written to {output_filename}")
except Exception as e:
    print(f"Failed to write Excel. Writing to CSV instead: {e}")
    output_df.to_csv('Drug_Mechanism_Of_Action.csv', index=False)