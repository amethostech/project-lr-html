"""
ClinicalTrials.gov Search Module using API v2.
Searches for clinical trials related to atopic dermatitis and extracted targets.
"""

import os
import csv
import requests
from urllib.parse import urlencode
import config


def build_clinical_trials_query(
    condition: str,
    interventions: list[str] = None,
    status: list[str] = None
) -> dict:
    """
    Build query parameters for ClinicalTrials.gov API v2.
    
    Args:
        condition: Disease/condition to search for
        interventions: List of intervention/treatment terms
        status: List of study statuses to filter
    
    Returns:
        Dictionary of query parameters
    """
    params = {
        "format": "json",
        "pageSize": config.CLINICALTRIALS_PAGE_SIZE,
        "sort": "LastUpdatePostDate:desc",  # Most recent first
        "countTotal": "true"
    }
    
    # Add condition query
    if condition:
        params["query.cond"] = condition
    
    # Add intervention terms
    if interventions:
        # Combine interventions with OR
        intr_query = " OR ".join(f'"{intr}"' for intr in interventions)
        params["query.intr"] = intr_query
    
    # Add status filter
    if status:
        params["filter.overallStatus"] = ",".join(status)
    
    # Specify fields to return
    params["fields"] = ",".join([
        "NCTId",
        "BriefTitle",
        "OfficialTitle",
        "OverallStatus",
        "Phase",
        "StudyType",
        "Condition",
        "InterventionName",
        "InterventionType",
        "LeadSponsorName",
        "StartDate",
        "PrimaryCompletionDate",
        "EnrollmentCount",
        "BriefSummary"
    ])
    
    return params


def search_clinical_trials(
    condition: str,
    interventions: list[str] = None,
    max_pages: int = 3
) -> list[dict]:
    """
    Search ClinicalTrials.gov for studies.
    
    Args:
        condition: Disease/condition to search for
        interventions: List of intervention/treatment terms
        max_pages: Maximum number of pages to fetch
    
    Returns:
        List of study dictionaries
    """
    print(f"🔍 Searching ClinicalTrials.gov for: {condition}")
    if interventions:
        print(f"   Interventions: {interventions[:5]}...")
    
    params = build_clinical_trials_query(condition, interventions)
    
    all_studies = []
    next_page_token = None
    page = 0
    
    while page < max_pages:
        if next_page_token:
            params["pageToken"] = next_page_token
        
        try:
            response = requests.get(
                config.CLINICALTRIALS_BASE_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            studies = data.get("studies", [])
            total_count = data.get("totalCount", 0)
            
            if page == 0:
                print(f"✅ Found {total_count} total studies")
            
            for study in studies:
                # Extract nested protocol section
                protocol = study.get("protocolSection", {})
                id_module = protocol.get("identificationModule", {})
                status_module = protocol.get("statusModule", {})
                design_module = protocol.get("designModule", {})
                sponsor_module = protocol.get("sponsorCollaboratorsModule", {})
                desc_module = protocol.get("descriptionModule", {})
                conditions_module = protocol.get("conditionsModule", {})
                interventions_module = protocol.get("armsInterventionsModule", {})
                
                # Extract interventions
                interventions_list = interventions_module.get("interventions", [])
                intervention_names = [i.get("name", "") for i in interventions_list]
                intervention_types = [i.get("type", "") for i in interventions_list]
                
                # Extract lead sponsor
                lead_sponsor = sponsor_module.get("leadSponsor", {})
                
                all_studies.append({
                    "nct_id": id_module.get("nctId", ""),
                    "brief_title": id_module.get("briefTitle", ""),
                    "official_title": id_module.get("officialTitle", ""),
                    "status": status_module.get("overallStatus", ""),
                    "phase": ", ".join(design_module.get("phases", [])),
                    "study_type": design_module.get("studyType", ""),
                    "conditions": "; ".join(conditions_module.get("conditions", [])),
                    "interventions": "; ".join(intervention_names),
                    "intervention_types": "; ".join(intervention_types),
                    "sponsor": lead_sponsor.get("name", ""),
                    "start_date": status_module.get("startDateStruct", {}).get("date", ""),
                    "completion_date": status_module.get("primaryCompletionDateStruct", {}).get("date", ""),
                    "enrollment": design_module.get("enrollmentInfo", {}).get("count", ""),
                    "summary": desc_module.get("briefSummary", "")[:500]
                })
            
            # Check for next page
            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break
            
            page += 1
            
        except requests.exceptions.RequestException as e:
            print(f"❌ API request failed: {e}")
            break
        except Exception as e:
            print(f"❌ Error processing response: {e}")
            break
    
    print(f"📊 Retrieved {len(all_studies)} studies across {page + 1} page(s)")
    return all_studies


def save_trials_to_csv(studies: list[dict], output_path: str) -> None:
    """
    Save clinical trial results to CSV file.
    
    Args:
        studies: List of study dictionaries
        output_path: Path to output CSV file
    """
    if not studies:
        print("⚠️ No studies to save")
        return
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    fieldnames = [
        "nct_id", "brief_title", "official_title", "status", "phase",
        "study_type", "conditions", "interventions", "intervention_types",
        "sponsor", "start_date", "completion_date", "enrollment", "summary"
    ]
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(studies)
    
    print(f"💾 Saved {len(studies)} studies to {output_path}")


def run_clinical_trials_search(targets: list[str] = None) -> list[dict]:
    """
    Main function to run ClinicalTrials.gov search.
    
    Args:
        targets: List of target keywords to include in search.
                 If None, searches for atopic dermatitis only.
    
    Returns:
        List of study dictionaries
    """
    # Base condition
    condition = "atopic dermatitis"
    
    # Build intervention list from targets
    interventions = []
    if targets:
        interventions.extend(targets)
    
    # Add S1P-related terms
    interventions.extend([
        "S1P modulator",
        "S1P1 agonist",
        "sphingosine-1-phosphate"
    ])
    
    # Search
    studies = search_clinical_trials(
        condition=condition,
        interventions=interventions if interventions else None,
        max_pages=3
    )
    
    # Save results
    output_path = os.path.join(config.OUTPUT_DIR, "clinical_trials_results.csv")
    save_trials_to_csv(studies, output_path)
    
    return studies


if __name__ == "__main__":
    print("=" * 60)
    print("ClinicalTrials.gov Search: Atopic Dermatitis")
    print("=" * 60)
    
    # Try to load targets from previous extraction
    targets = []
    targets_path = os.path.join(config.OUTPUT_DIR, "extracted_targets.csv")
    if os.path.exists(targets_path):
        print(f"📂 Loading targets from {targets_path}")
        with open(targets_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Type") == "target":
                    targets.append(row.get("Name", ""))
        print(f"   Found {len(targets)} targets")
    
    studies = run_clinical_trials_search(targets[:5] if targets else None)
    
    print(f"\n📊 Summary:")
    print(f"   Total studies retrieved: {len(studies)}")
    
    # Show status breakdown
    if studies:
        status_counts = {}
        for s in studies:
            status = s.get("status", "Unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        print(f"   Status breakdown:")
        for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"      • {status}: {count}")
