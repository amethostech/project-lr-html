import requests
import pandas as pd
import time

BASE_URL = "https://clinicaltrials.gov/api/v2/studies"

class ClinicalTrialsExtractor:
    def __init__(self, session=None, delay=0.3):
        self.session = session or requests.Session()
        self.delay = delay

    def fetch_studies(self, condition="", status=None, year_from=None, year_to=None, regions=None, max_pages=1, page_size=50):
        all_studies = []
        page_token = None
        condition = (condition or "").strip()

        for _ in range(max_pages):
            params = {"format": "json", "pageSize": page_size}
            if condition: params["query.cond"] = condition
            if status: params["filter.overallStatus"] = status.upper()
            if year_from and year_to:
                params["filter.advanced"] = f"AREA[StartDate]RANGE[{year_from}-01-01, {year_to}-12-31]"
            elif year_from:
                params["filter.advanced"] = f"AREA[StartDate]RANGE[{year_from}-01-01, MAX]"
            if regions and regions != "Global":
                # Note: ClinicalTrials.gov API may not directly support region filtering; this is a placeholder
                # You might need to filter post-fetch or use advanced queries
                pass
            if page_token: params["pageToken"] = page_token

            resp = self.session.get(BASE_URL, params=params, timeout=60)
            if resp.status_code != 200: break

            data = resp.json()
            studies = data.get("studies", []) or []
            all_studies.extend(studies)
            page_token = data.get("nextPageToken")
            if not page_token: break
            time.sleep(self.delay)
        return all_studies

    def parse_studies(self, studies):
        rows = []
        for s in studies:
            p = s.get("protocolSection", {}) or {}

            # Identification
            ident = p.get("identificationModule", {})
            nct_id = ident.get("nctId", "")
            title = ident.get("briefTitle", "")
            official_title = ident.get("officialTitle", "")

            # Status
            status_mod = p.get("statusModule", {})
            status = status_mod.get("overallStatus", "")
            start_date = status_mod.get("startDateStruct", {}).get("date", "")
            completion_date = status_mod.get("completionDateStruct", {}).get("date", "")
            primary_completion_date = status_mod.get("primaryCompletionDateStruct", {}).get("date", "")

            # Sponsor
            sponsor_mod = p.get("sponsorCollaboratorsModule", {})
            sponsor = sponsor_mod.get("leadSponsor", {}).get("name", "")

            # Conditions
            conditions_mod = p.get("conditionsModule", {})
            conditions_list = conditions_mod.get("conditions", [])
            if isinstance(conditions_list, list):
                conditions = ", ".join([c.get("condition", "") if isinstance(c, dict) else str(c) for c in conditions_list])
            else:
                conditions = str(conditions_list)

            # Design
            design_mod = p.get("designModule", {})
            study_type = design_mod.get("studyType", "")
            phases = ", ".join(design_mod.get("phases", []))

            # Interventions
            interventions_mod = p.get("armsInterventionsModule", {})
            interventions = []
            for arm in interventions_mod.get("armGroups", []):
                interventions.extend(arm.get("armGroupInterventionNames", []))
            interventions = ", ".join(set(interventions))  # Remove duplicates

            # Eligibility
            eligibility_mod = p.get("eligibilityModule", {})
            gender = eligibility_mod.get("gender", "")
            min_age = eligibility_mod.get("minimumAge", "")
            max_age = eligibility_mod.get("maximumAge", "")
            healthy_volunteers = eligibility_mod.get("healthyVolunteers", "")

            # Locations
            locations_mod = p.get("contactsLocationsModule", {})
            locations = []
            for loc in locations_mod.get("locations", []):
                facility = loc.get("facility", "")
                city = loc.get("city", "")
                state = loc.get("state", "")
                country = loc.get("country", "")
                location_str = f"{facility}, {city}, {state}, {country}".strip(", ")
                locations.append(location_str)
            locations = "; ".join(locations[:5])  # Limit to first 5 locations

            # Outcomes
            outcomes_mod = p.get("outcomesModule", {})
            primary_outcomes = ", ".join([o.get("measure", "") for o in outcomes_mod.get("primaryOutcomes", [])])

            rows.append({
                "NCT ID": nct_id,
                "Title": title,
                "Official Title": official_title,
                "Status": status,
                "Study Results": "No Results Available" if status_mod.get("studyResults") else "Has Results",
                "Conditions": conditions,
                "Interventions": interventions,
                "Sponsor": sponsor,
                "Collaborators": ", ".join([c.get("name", "") for c in sponsor_mod.get("collaborators", [])]),
                "Phases": phases,
                "Study Type": study_type,
                "Start Date": start_date,
                "Primary Completion Date": primary_completion_date,
                "Completion Date": completion_date,
                "Enrollment": eligibility_mod.get("enrollmentCount", ""),
                "Gender": gender,
                "Age": f"{min_age} to {max_age}",
                "Healthy Volunteers": healthy_volunteers,
                "Locations": locations,
                "Primary Outcome Measures": primary_outcomes,
                "URL": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else ""
            })
        return pd.DataFrame(rows)

    def fetch_and_parse(self, condition, status=None, year_from=None, year_to=None, regions=None, max_pages=1, page_size=50):
        return self.parse_studies(
            self.fetch_studies(condition=condition, status=status, year_from=year_from, year_to=year_to, regions=regions, max_pages=max_pages, page_size=page_size)
        )
