"""
Fetch all Clinical Trials data from ClinicalTrials.gov API v2 (oncology + drug intervention)
and write to CSV with all existing columns + briefSummary and detailedDescription.

Usage:
    python fetch_clinical_trials.py
    python fetch_clinical_trials.py --year 2025
    python fetch_clinical_trials.py --condition "breast cancer" --max 1000
"""

import csv
import argparse
import time
import requests

API_BASE = "https://clinicaltrials.gov/api/v2/studies"
PAGE_SIZE = 50
MAX_RESULTS_DEFAULT = 10000


def parse_args():
    parser = argparse.ArgumentParser(description="Fetch clinical trials data from ClinicalTrials.gov API v2")
    parser.add_argument("--condition", default="oncology", help="Condition/disease to search (default: oncology)")
    parser.add_argument("--intervention", default="DRUG", help="Intervention type filter (default: DRUG)")
    parser.add_argument("--year", default=None, help="Filter by start year, e.g. 2025")
    parser.add_argument("--max", type=int, default=MAX_RESULTS_DEFAULT, help=f"Maximum results to fetch (default: {MAX_RESULTS_DEFAULT})")
    parser.add_argument("--output", default="clinical_trials_full.csv", help="Output CSV filename (default: clinical_trials_full.csv)")
    return parser.parse_args()


def format_study(study):
    """
    Extract all required fields from a single study returned by the API.
    Matches the existing columns from clinicalService.js + adds briefSummary and detailedDescription.
    """
    protocol = study.get("protocolSection", {})
    id_module = protocol.get("identificationModule", {})
    status_module = protocol.get("statusModule", {})
    sponsor_module = protocol.get("sponsorCollaboratorsModule", {})
    design_module = protocol.get("designModule", {})
    conditions_module = protocol.get("conditionsModule", {})
    arms_module = protocol.get("armsInterventionsModule", {})
    contacts_module = protocol.get("contactsLocationsModule", {})
    outcomes_module = protocol.get("outcomesModule", {})
    description_module = protocol.get("descriptionModule", {})

    nct_id = id_module.get("nctId", "")

    # Format interventions: "TYPE: Name; TYPE: Name"
    interventions_list = arms_module.get("interventions", [])
    interventions = "; ".join(
        f"{i.get('type', '')}: {i.get('name', '')}" for i in interventions_list
    )

    # Format conditions
    conditions = "; ".join(conditions_module.get("conditions", []))

    # Format phases
    phases = ", ".join(design_module.get("phases", []))

    # Format locations: "Facility, City, Country"
    locations_list = contacts_module.get("locations", [])
    locations = "; ".join(
        f"{loc.get('facility', '')}, {loc.get('city', '')}, {loc.get('country', '')}"
        for loc in locations_list
    )

    # Format primary outcomes
    primary_outcomes_list = outcomes_module.get("primaryOutcomes", [])
    primary_outcomes = "; ".join(o.get("measure", "") for o in primary_outcomes_list)

    return {
        "id": nct_id,
        "title": id_module.get("briefTitle", ""),
        "officialTitle": id_module.get("officialTitle", ""),
        "status": status_module.get("overallStatus", ""),
        "conditions": conditions,
        "interventions": interventions,
        "sponsor": (sponsor_module.get("leadSponsor") or {}).get("name", ""),
        "phases": phases,
        "studyType": design_module.get("studyType", ""),
        "startDate": (status_module.get("startDateStruct") or {}).get("date", ""),
        "completionDate": (status_module.get("completionDateStruct") or {}).get("date", ""),
        "locations": locations,
        "primaryOutcomes": primary_outcomes,
        "url": f"https://clinicaltrials.gov/study/{nct_id}",
        "source": "ClinicalTrials.gov",
        # ── NEW COLUMNS ──
        "briefSummary": description_module.get("briefSummary", ""),
        "detailedDescription": description_module.get("detailedDescription", ""),
    }


def fetch_all_studies(condition, intervention_type, year, max_results):
    """
    Paginate through ClinicalTrials.gov API v2 and return a list of formatted studies.
    """
    # Build the advanced filter parts
    advanced_parts = []
    if intervention_type:
        advanced_parts.append(f"AREA[InterventionType]{intervention_type.upper()}")
    if year:
        advanced_parts.append(f"AREA[StartDate]RANGE[{year}-01-01, {year}-12-31]")

    params = {
        "format": "json",
        "pageSize": PAGE_SIZE,
        "query.cond": condition,
    }
    if advanced_parts:
        params["filter.advanced"] = " AND ".join(advanced_parts)

    print(f"[INFO] Query params: {params}")

    all_studies = []
    page = 0
    page_token = None
    max_pages = (max_results // PAGE_SIZE) + 10  # safety cap

    while page < max_pages:
        request_params = dict(params)
        if page_token:
            request_params["pageToken"] = page_token

        try:
            resp = requests.get(API_BASE, params=request_params, timeout=60)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[ERROR] API request failed on page {page + 1}: {e}")
            break

        data = resp.json()
        studies = data.get("studies", [])
        page += 1

        for study in studies:
            all_studies.append(format_study(study))

        print(f"[INFO] Page {page}: fetched {len(studies)} studies (total so far: {len(all_studies)})")

        if len(all_studies) >= max_results:
            print(f"[INFO] Reached max results cap ({max_results}), stopping.")
            break

        page_token = data.get("nextPageToken")
        if not page_token:
            print("[INFO] No more pages available.")
            break

        # Small delay to be respectful to the API
        time.sleep(0.3)

    # Trim to max
    if len(all_studies) > max_results:
        all_studies = all_studies[:max_results]

    return all_studies


def write_csv(studies, output_path):
    """Write the list of study dicts to a CSV file."""
    if not studies:
        print("[WARN] No studies to write!")
        return

    fieldnames = list(studies[0].keys())

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(studies)

    print(f"[SUCCESS] Wrote {len(studies)} rows to {output_path}")


def main():
    args = parse_args()

    print("=" * 60)
    print("  Clinical Trials Data Fetcher (ClinicalTrials.gov API v2)")
    print("=" * 60)
    print(f"  Condition      : {args.condition}")
    print(f"  Intervention   : {args.intervention}")
    print(f"  Year filter    : {args.year or 'None (all years)'}")
    print(f"  Max results    : {args.max}")
    print(f"  Output file    : {args.output}")
    print("=" * 60)

    studies = fetch_all_studies(
        condition=args.condition,
        intervention_type=args.intervention,
        year=args.year,
        max_results=args.max,
    )

    print(f"\n[INFO] Total studies fetched: {len(studies)}")
    write_csv(studies, args.output)


if __name__ == "__main__":
    main()
