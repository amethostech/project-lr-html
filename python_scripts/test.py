import pandas as pd
import requests
import json
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch_moa(drug_name):
    """Fetch mechanism of action from PubChem for a given drug name."""
    try:
        url_cid = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{drug_name}/cids/JSON"
        res_cid = requests.get(url_cid, timeout=10)
        
        if res_cid.status_code == 404:
            return drug_name, "Drug not found in PubChem"
        
        cid_data = res_cid.json()
        cids = cid_data.get('IdentifierList', {}).get('CID', [])
        if not cids:
            return drug_name, "CID not found"
            
        cid = cids[0]
        url_profile = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON"
        res_profile = requests.get(url_profile, timeout=10)
        
        if res_profile.status_code == 404:
            return drug_name, "Profile not found"
            
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
            return drug_name, "Mechanism of Action section not found"
            
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
                        
        return drug_name, "\n\n".join(texts) if texts else "Text could not be extracted"
        
    except Exception as e:
        return drug_name, f"Error: {e}"

def main():
    print("--- Step 1: Loading & Cleaning Backend Output ---")
    if not os.path.exists('../Clinical_Trials_2025.xlsx'):
        print("Error: Could not find ../Clinical_Trials_2025.xlsx!")
        return
        
    import re
    def clean_compound(name):
        name = name.strip()
        inj_match = re.search(r"injection\s+(of|with)\s+(.+)", name, flags=re.IGNORECASE)
        if inj_match: name = inj_match.group(2).strip()
        name = re.sub(r"^\d+\s*(day|days|week|weeks|month|months|year|years|cycle|cycles)\s+of\s+", "", name, flags=re.IGNORECASE)
        name = re.sub(r"^\d+(\.\d+)?\s*(mg|mcg|g|ml|iu)\s*(/kg)?\s*", "", name, flags=re.IGNORECASE)
        name = re.sub(r"\b(before|after)\s+[a-z\s]+$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"\b(given|administered|received).*$", "", name, flags=re.IGNORECASE)
        inner_match = re.search(r"\(([^()%]+)\)\s*$", name)
        if inner_match: return inner_match.group(1).strip()
        name = re.sub(r"\(\d+(\.\d+)?%\)", "", name)
        name = re.sub(r"-based.*", "", name, flags=re.IGNORECASE)
        name = re.sub(r"\b(injection|tablet|capsule|syrup|solution|cream|gel|oral|iv)\b.*", "", name, flags=re.IGNORECASE)
        name = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu)\b.*", "", name, flags=re.IGNORECASE)
        name = re.sub(r"[,\.;:\-]+$", "", name)
        return name.strip()

    def extract_and_clean(val):
        val_str = str(val)
        drugs = []
        # Format 1 (from Node backend): "DRUG: DrugName; BIOLOGICAL: OtherName"
        for part in val_str.split(';'):
            part = part.strip()
            if part.upper().startswith('DRUG:'):
                drug_name = part[5:].strip()  # Remove "DRUG: " prefix
                if drug_name:
                    drugs.append(clean_compound(drug_name))
        # Format 2 (from original CSV): "DrugName (DRUG), OtherName (DRUG)"
        if not drugs:
            matches = re.findall(r"\s*([^,]+?)\s*\(DRUG\)", val_str)
            drugs = [clean_compound(m) for m in matches]
        return ",".join(drugs) if drugs else None


    df = pd.read_excel("../Clinical_Trials_2025.xlsx")
    print(f"Loaded {len(df)} rows. Columns: {list(df.columns)}")
    
    # The pipeline already fetched only oncology + drug intervention trials,
    # so we just need to find rows that have drug interventions
    mask = df["interventions"].astype(str).str.contains("DRUG", case=False, na=False)
    print(f"Found {mask.sum()} rows with DRUG interventions")

           
    df["compound_name"] = None
    df.loc[mask, "compound_name"] = df.loc[mask, "interventions"].apply(extract_and_clean)
    
    # Save the intermediate output just in case
    df.to_csv("drug_identified_async.csv", index=False)
    
    print("--- Step 2: Extracting Unique Drugs to Query ---")
    all_drugs = set()
    for items in df["compound_name"].dropna():
        for d in items.split(','):
            d = d.strip()
            if d:
                all_drugs.add(d)

    unique_drugs = sorted(list(all_drugs))
    total_drugs = len(unique_drugs)
    print(f"Found {total_drugs} unique drugs to query.")

    results = []
    
    # By running exactly 2 workers, and enforcing a 0.5 sec sleep,
    # This script will run around 2-3 requests per second.
    # When combined with your other script, you'll still be under the strict 5/sec limit!
    MAX_WORKERS = 2
    count = 0
    
    output_filename_excel = 'Cancer_Drugs_MOA.xlsx'
    output_filename_csv = 'Cancer_Drugs_MOA.csv'

    print(f"\n--- Starting ThreadPoolExecutor with {MAX_WORKERS} workers ---")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        
        # Submit all tasks
        future_to_drug = {executor.submit(fetch_moa, drug): drug for drug in unique_drugs}
        
        for future in as_completed(future_to_drug):
            count += 1
            drug = future_to_drug[future]
            try:
                drug_name, moa = future.result()
                results.append({
                    'Compound Name': drug_name,
                    'Mechanism of Action': moa
                })
                print(f"[{count}/{total_drugs}] SUCCESS! Fetched MOA for: {drug_name}")
            except Exception as e:
                print(f"[{count}/{total_drugs}] FAILED to fetch MOA for {drug}: {e}")
                results.append({
                    'Compound Name': drug,
                    'Mechanism of Action': f"Error: {e}"
                })
            
            # MANDATORY 0.5 second sleep so BOTH of your scripts can run at the same time without an IP ban
            time.sleep(0.5) 
            
            # Auto-save progress every 50 drugs so you don't lose anything if you force quit
            if count % 50 == 0:
                print(f"---> Auto-saving progress at {count} drugs...")
                temp_df = pd.DataFrame(results)
                temp_df.to_csv(output_filename_csv, index=False)

    print("\n--- Saving Final Mechanism of Action ---")
    output_df = pd.DataFrame(results)
    
    try:
        with pd.ExcelWriter(output_filename_excel, engine='openpyxl') as writer:
            output_df.to_excel(writer, sheet_name='Drugs & MOA', index=False)
        print(f"Success! Final data written to {output_filename_excel}")
    except Exception as e:
        print(f"Failed to write Excel. Writing to CSV instead: {e}")
        output_df.to_csv(output_filename_csv, index=False)

if __name__ == "__main__":
    main()
