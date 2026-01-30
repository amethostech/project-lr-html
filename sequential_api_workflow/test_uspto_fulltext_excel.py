import requests
import pandas as pd
import time
from lxml import etree

# =============================
# CONFIG
# =============================
PATENTSVIEW_API_KEY = "gHnGYUVo.LvuL5K0YiHqVbDjB4biYicrzb8xiQmgi"

PATENTSVIEW_URL = "https://search.patentsview.org/api/v1/patent/"
FULLTEXT_BASE_URL = "https://developer.uspto.gov/ibd-api/v1/patent/grant/"

HEADERS = {
    "X-Api-Key": PATENTSVIEW_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json"
}

# =============================
# FETCH FULL TEXT (CLAIMS + DESCRIPTION)
# =============================
def fetch_full_text(patent_id):
    url = f"{FULLTEXT_BASE_URL}{patent_id}"

    try:
        r = requests.get(url, headers={"Accept": "application/xml"}, timeout=30)
        if r.status_code != 200:
            return "", "", url

        root = etree.fromstring(r.content)
        claims = " ".join(root.xpath("//claims//text()"))
        description = " ".join(root.xpath("//description//text()"))

        return claims.strip(), description.strip(), url

    except Exception as e:
        print(f" Full text error for {patent_id}: {e}")
        return "", "", url


# =============================
# SEARCH + FULL TEXT + EXCEL
# =============================
def search_uspto_fulltext_excel(keywords, year, page=1, size=5):
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"

    query = {
        "q": {
            "_and": [
                {"_gte": {"patent_date": start_date}},
                {"_lte": {"patent_date": end_date}},
                {
                    "_or": [
                        {"_text_any": {"patent_title": keywords}},
                        {"_text_any": {"patent_abstract": keywords}},
                        {"_text_any": {"assignees.assignee_organization": keywords}}
                    ]
                }
            ]
        },
        "f": [
            "patent_id",
            "patent_title",
            "patent_date",
            "patent_abstract",
            "assignees.assignee_organization"
        ],
        "o": {
            "size": size,
            "page": page,
            "sort": [{"patent_date": "desc"}]
        }
    }

    print("\n Searching USPTO patents...")
    response = requests.post(
        PATENTSVIEW_URL,
        headers=HEADERS,
        json=query,
        timeout=30
    )
    response.raise_for_status()

    patents = response.json().get("patents", [])
    print(f" Patents found: {len(patents)}")

    rows = []

    for idx, p in enumerate(patents, start=1):
        patent_id = p.get("patent_id")
        print(f" Fetching full text {idx}/{len(patents)} → {patent_id}")

        claims, description, fulltext_url = fetch_full_text(patent_id)
        time.sleep(0.6)  # rate-limit safety

        rows.append({
            "Patent ID": patent_id,
            "Title": p.get("patent_title"),
            "Grant Date": p.get("patent_date"),
            "Assignee": (
                p.get("assignees", [{}])[0].get("assignee_organization")
                if p.get("assignees") else None
            ),
            "Abstract": p.get("patent_abstract"),
            "Claims": claims,
            "Description": description,
            "USPTO Full Text API": fulltext_url,
            "Google Patents URL": f"https://patents.google.com/patent/US{patent_id}"
        })

    df = pd.DataFrame(rows)

    file_name = f"USPTO_TEST_{keywords.replace(' ', '_')}_{year}.xlsx"
    df.to_excel(file_name, index=False)

    return file_name, df


# ==================================================
#  MANUAL TEST BLOCK (THIS IS WHAT YOU ASKED)
# ==================================================
if __name__ == "__main__":
    print(" Manual USPTO search test started")

    # 🔹 Change these values to test
    TEST_KEYWORDS = "karuna therapeutics"   # try: "chemo lymph", "lymphoma"
    TEST_YEAR = 2024                        # frontend year filter simulation

    excel_file, dataframe = search_uspto_fulltext_excel(
        keywords=TEST_KEYWORDS,
        year=TEST_YEAR,
        page=1,
        size=5       # keep small for testing
    )

    print("\n TEST COMPLETED SUCCESSFULLY")
    print(" Rows fetched:", len(dataframe))
    print(" Excel file created:", excel_file)
