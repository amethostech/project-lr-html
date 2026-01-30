import csv
import json
import os
import sys
from js_api_wrapper import call_js_api
from keyword_extractor import extract_keywords
from json_to_csv import convert_json_to_csv

# New Python Clients
import opentargets_client
import icd11_client
import reactome_client

INPUT_FILE = 'input_apis.csv'
OUTPUT_DIR = 'workflow_outputs'

def read_input_csv(file_path):
    steps = []
    if not os.path.exists(file_path):
        print(f"Error: Input file '{file_path}' not found.")
        sys.exit(1)
        
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            steps.append(row)
    return steps

def execute_step(api_name, query, **kwargs):
    """
    Dispatcher to call the appropriate API client (JS Bridge or Python)
    """
    api_lower = api_name.lower().strip()
    
    if api_lower in ['pubmed', 'pubchem', 'uspto', 'patentsview']:
        print(f"  -> Executing via Node.js bridge...")
        return call_js_api(api_name, query, **kwargs)
        
    elif api_lower == 'icd11':
        print(f"  -> Executing via Python ICD-11 Client...")
        # Expecting query to be disease name
        return icd11_client.search_icd11(query)
        
    elif api_lower == 'opentargets':
        print(f"  -> Executing via Python OpenTargets Client...")
        # Workflow Step 4: Map Disease Name -> EFO ID
        # Workflow Step 5: Get Genes for Disease
        
        # Heuristic: Check if input looks like an ID or Name?
        # For now, let's assume if it starts with EFO_, it's an ID for association search
        # Otherwise it's a search for ID.
        if query.startswith('EFO_') or query.startswith('MONDO_') or query.startswith('Orphanet_'):
            return opentargets_client.get_disease_gene_associations(query)
        else:
            # If search returns a hit, we might want to return that hit
            hit = opentargets_client.search_disease(query)
            return [hit] if hit else []
            
    elif api_lower == 'reactome':
        print(f"  -> Executing via Python Reactome Client...")
        # Expecting Gene Symbol or ID
        return reactome_client.get_pathways_for_entity(query)
        
    else:
        print(f"  -> Unknown API: {api_name}")
        return []

def main():
    # Ensure output directory exists
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    print("--- Starting Sequential API Workflow ---")
    
    steps = read_input_csv(INPUT_FILE)
    current_keywords = ""
    
    for i, step in enumerate(steps):
        api_name = step.get('api_name', '').strip()
        csv_keywords = step.get('keywords', '').strip()
        
        # Determine keywords to use
        if csv_keywords:
            search_query = csv_keywords
            print(f"\nStep {i+1}: Calling {api_name} with keywords from CSV: '{search_query}'")
        elif current_keywords:
            search_query = current_keywords
            # CLEANUP: If passing from OpenTargets to Reactome, we might have JSON or specific fields.
            # Ideally the 'keyword_extractor' should handle picking the right field.
            print(f"\nStep {i+1}: Calling {api_name} with keywords from Previous Step: '{search_query}'")
        else:
            print(f"\n[WARNING] Step {i+1} ({api_name}): No keywords found in CSV and no keywords generated from previous step.")
            print("Please address this gap in the input or logic.")
            continue

        # Execute API call
        result = execute_step(api_name, search_query)
        
        # Check for results
        results_list = result.get('results', []) if isinstance(result, dict) else result
        
        if not results_list:
             print(f"  -> No results returned from {api_name}.")
             # We assume we continue? Or stop? 
             # For now, we continue, but next step might fail without keywords.
             current_keywords = "" # Reset keywords if no data to extract from
        else:
            count = len(results_list)
            print(f"  -> Success! Received {count} records.")
            
            # Save JSON
            json_filename = os.path.join(OUTPUT_DIR, f"step_{i+1}_{api_name}_output.json")
            with open(json_filename, 'w', encoding='utf-8') as jf:
                json.dump(results_list, jf, indent=2)
            
            # Convert to CSV
            csv_filename = os.path.join(OUTPUT_DIR, f"step_{i+1}_{api_name}_output.csv")
            convert_json_to_csv(results_list, csv_filename)
            
            # Extract keywords for next step
            extracted = extract_keywords(results_list, api_name)
            if extracted:
                current_keywords = extracted
                print(f"  -> Extracted new keywords for next step: '{current_keywords}'")
            else:
                print(f"  -> Could not extract meaningful keywords from output.")
                current_keywords = ""

    print("\n--- Workflow Completed ---")

if __name__ == "__main__":
    main()
