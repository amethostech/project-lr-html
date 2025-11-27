from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import pandas as pd
import os
import json
from io import BytesIO
from clinical_extractor import ClinicalTrialsExtractor

# ---- FIREBASE / FIRESTORE ----
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Flask
app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

# Initialize Firebase Admin
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()  # Firestore database reference

BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
DATA_API_URL = "https://clinicaltrials.gov/data-api/api/studies"
session = requests.Session()


# ----------------------------- FETCH CLINICAL STUDIES --------------------------------
def fetch_studies(keywords, max_pages=1, page_size=50):
    all_studies = []
    page_token = None
    query = " ".join(keywords)

    for _ in range(max_pages):
        params = {
            "format": "json",
            "pageSize": page_size,
            "query.term": query,
            "fields": "NCTId,BriefTitle,OverallStatus,SponsorCollaboratorsModule"
        }

        if page_token:
            params["pageToken"] = page_token

        resp = session.get(BASE_URL, params=params)
        if resp.status_code != 200:
            break

        data = resp.json()
        all_studies.extend(data.get("studies", []))
        page_token = data.get("nextPageToken")

        if not page_token:
            break

    results = []
    for study in all_studies:
        protocol = study.get("protocolSection", {})
        results.append({
            "id": protocol.get("identificationModule", {}).get("nctId", ""),
            "title": protocol.get("identificationModule", {}).get("briefTitle", ""),
            "status": protocol.get("statusModule", {}).get("overallStatus", ""),
            "sponsor": protocol.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", "")
        })

    return results


# ------------------------------- SEARCH ROUTE -----------------------------------------
@app.route("/search", methods=["POST"])
def search_trials():
    data = request.json
    keywords = data.get("keywords", [])
    if not keywords:
        return jsonify({"error": "No keywords provided"}), 400

    results = fetch_studies(keywords, max_pages=2)
    return jsonify({"count": len(results), "results": results})


# -------------------------- GENERATE EXCEL (FIRESTORE) --------------------------------
@app.route("/generate-excel", methods=["GET"])
def generate_excel():

    # 🔥 Fetch the most recent Firestore document
    docs = (
        db.collection("searches")
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )

    latest = None
    for d in docs:
        latest = d.to_dict()

    if latest is None:
        return jsonify({"error": "No saved frontend data in Firestore"}), 404

    # ---------------- Parse Firestore Data ----------------
    keywords = [k.get("v") for k in latest.get("keywords", [])]
    year_from = latest.get("yearFrom", "")
    year_to = latest.get("yearTo", "")
    regions = ", ".join(latest.get("regions", []))
    selected_dbs = latest.get("selectedDbs", ["clinicaltrials"])
    db_params = latest.get("dbParams", {})

    keywords_str = " ".join(keywords)

    # INPUTS sheet
    inputs_df = pd.DataFrame({
        "Keywords": [keywords_str],
        "Year From": [year_from],
        "Year To": [year_to],
        "Regions": [regions],
        "Selected Databases": [", ".join(selected_dbs)],
        "Database Params": [json.dumps(db_params)]
    })

    # ------------------- FETCH DATA FOR EACH DB -------------------
    all_results = []

    for dbname in selected_dbs:

        if dbname == "clinicaltrials":
            params = {"format": "xlsx"}
            query_term = keywords_str.strip()
            if query_term:
                params["query.term"] = query_term

            status = db_params.get("clinicaltrials", {}).get("status", None)
            if status:
                params["filter.overallStatus"] = status.upper()

            if year_from and year_to:
                params["filter.advanced"] = f"AREA[StartDate]RANGE[{year_from}-01-01, {year_to}-12-31]"

            try:
                resp = session.get(DATA_API_URL, params=params, timeout=60)
                resp.raise_for_status()
                df = pd.read_excel(BytesIO(resp.content))
                df["Database"] = "ClinicalTrials.gov"
                all_results.append(df)

            except:
                extractor = ClinicalTrialsExtractor(session=session)
                condition = " ".join(keywords)
                df = extractor.fetch_and_parse(
                    condition=condition,
                    status=status,
                    year_from=year_from,
                    year_to=year_to,
                    regions=regions,
                    max_pages=5
                )
                df["Database"] = "ClinicalTrials.gov"
                all_results.append(df)

        else:
            # Placeholder for future DB integrations
            placeholder_df = pd.DataFrame({
                "Message": [f"Database '{dbname}' not implemented yet"],
                "Database": dbname
            })
            all_results.append(placeholder_df)

    if all_results:
        results_df = pd.concat(all_results, ignore_index=True)
    else:
        results_df = pd.DataFrame({"Message": ["No results"]})

    # ------------------- CREATE EXCEL -------------------
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        inputs_df.to_excel(writer, sheet_name="Inputs", index=False)
        results_df.to_excel(writer, sheet_name="Results", index=False)

    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="results.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


if __name__ == "__main__":
    app.run(debug=True)
