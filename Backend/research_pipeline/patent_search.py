"""
USPTO PatentsView Search Module.
Searches for patents related to atopic dermatitis and extracted targets.
"""

import os
import csv
import json
import requests
import config


def build_patent_query(keywords: list[str]) -> dict:
    """
    Build query payload for PatentsView API.
    
    Args:
        keywords: List of search terms
    
    Returns:
        Query payload dictionary
    """
    # Build text query using _or for multiple keywords
    if len(keywords) == 1:
        text_query = {"_text_any": {"patent_abstract": keywords[0]}}
    else:
        text_query = {
            "_or": [
                {"_text_any": {"patent_abstract": kw}} for kw in keywords
            ]
        }
    
    query = {
        "q": text_query,
        "f": [
            "patent_number",
            "patent_title",
            "patent_abstract",
            "patent_date",
            "patent_type",
            "assignee_organization",
            "inventor_first_name",
            "inventor_last_name",
            "cpc_group_id",
            "uspc_mainclass_id"
        ],
        "o": {
            "per_page": 100,
            "page": 1,
            "sort": [{"patent_date": "desc"}]  # Most recent first
        }
    }
    
    return query


def search_patents(keywords: list[str], max_pages: int = 2) -> list[dict]:
    """
    Search USPTO PatentsView for patents.
    
    Args:
        keywords: List of search terms
        max_pages: Maximum number of pages to fetch
    
    Returns:
        List of patent dictionaries
    """
    if not config.PATENTSVIEW_API_KEY:
        print("⚠️  Warning: No PatentsView API key configured.")
        print("   The new PatentsView v1 API requires an API key.")
        print("   Please obtain one at https://patentsview.org/apis/purpose")
        print("   and set it in config.py. Skipping patent search.")
        return []

    print(f"🔍 Searching USPTO PatentsView for: {keywords[:5]}...")
    
    all_patents = []
    
    for page in range(1, max_pages + 1):
        query = build_patent_query(keywords)
        query["o"]["page"] = page
        
        try:
            headers = {
                "Content-Type": "application/json",
                "X-Api-Key": config.PATENTSVIEW_API_KEY
            }
            
            response = requests.post(
                config.PATENTSVIEW_BASE_URL,
                headers=headers,
                data=json.dumps(query),
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            patents = data.get("patents", [])
            total_count = data.get("total_patent_count", 0)
            
            if page == 1:
                print(f"✅ Found {total_count} total patents")
            
            if not patents:
                break
            
            for patent in patents:
                # Extract assignee info
                assignees = patent.get("assignees", [])
                assignee_names = [a.get("assignee_organization", "") for a in assignees if a.get("assignee_organization")]
                
                # Extract inventor info
                inventors = patent.get("inventors", [])
                inventor_names = []
                for inv in inventors[:3]:  # First 3 inventors
                    first = inv.get("inventor_first_name", "")
                    last = inv.get("inventor_last_name", "")
                    if first or last:
                        inventor_names.append(f"{first} {last}".strip())
                
                # Extract CPC codes
                cpcs = patent.get("cpcs", [])
                cpc_codes = [c.get("cpc_group_id", "") for c in cpcs[:5]]
                
                all_patents.append({
                    "patent_number": patent.get("patent_number", ""),
                    "title": patent.get("patent_title", ""),
                    "abstract": patent.get("patent_abstract", "")[:1000] if patent.get("patent_abstract") else "",
                    "date": patent.get("patent_date", ""),
                    "type": patent.get("patent_type", ""),
                    "assignees": "; ".join(assignee_names),
                    "inventors": "; ".join(inventor_names),
                    "cpc_codes": "; ".join(cpc_codes),
                    "url": f"https://patents.google.com/patent/US{patent.get('patent_number', '')}"
                })
            
            print(f"   Page {page}: Retrieved {len(patents)} patents")
            
            # Check if we've got all results
            if len(all_patents) >= total_count:
                break
                
        except requests.exceptions.RequestException as e:
            if response.status_code == 403:
                print("❌ API Key Invalid or Missing (403 Forbidden)")
                print("   Please check your PatentsView API key in config.py")
            else:
                print(f"❌ API request failed: {e}")
            break
        except Exception as e:
            print(f"❌ Error processing response: {e}")
            break
    
    print(f"📊 Retrieved {len(all_patents)} patents total")
    return all_patents


def save_patents_to_csv(patents: list[dict], output_path: str) -> None:
    """
    Save patent results to CSV file.
    
    Args:
        patents: List of patent dictionaries
        output_path: Path to output CSV file
    """
    if not patents:
        print("⚠️ No patents to save")
        return
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    fieldnames = [
        "patent_number", "title", "abstract", "date", "type",
        "assignees", "inventors", "cpc_codes", "url"
    ]
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(patents)
    
    print(f"💾 Saved {len(patents)} patents to {output_path}")


def run_patent_search(targets: list[str] = None) -> list[dict]:
    """
    Main function to run USPTO patent search.
    
    Args:
        targets: List of target keywords to include in search.
                 If None, searches for atopic dermatitis only.
    
    Returns:
        List of patent dictionaries
    """
    # Build keyword list
    keywords = ["atopic dermatitis"]
    
    # Add S1P-related terms
    keywords.extend([
        "S1P1 modulator",
        "sphingosine-1-phosphate receptor",
        "S1P agonist"
    ])
    
    # Add extracted targets
    if targets:
        keywords.extend(targets[:5])
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            unique_keywords.append(kw)
    
    # Search
    patents = search_patents(unique_keywords, max_pages=2)
    
    # Save results
    output_path = os.path.join(config.OUTPUT_DIR, "patent_results.csv")
    save_patents_to_csv(patents, output_path)
    
    return patents


if __name__ == "__main__":
    print("=" * 60)
    print("USPTO Patent Search: Atopic Dermatitis & S1P Modulators")
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
    
    patents = run_patent_search(targets[:5] if targets else None)
    
    print(f"\n📊 Summary:")
    print(f"   Total patents retrieved: {len(patents)}")
    
    # Show top assignees
    if patents:
        assignee_counts = {}
        for p in patents:
            assignees = p.get("assignees", "")
            if assignees:
                for a in assignees.split("; "):
                    if a:
                        assignee_counts[a] = assignee_counts.get(a, 0) + 1
        
        print(f"   Top assignees:")
        for assignee, count in sorted(assignee_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"      • {assignee}: {count} patents")
