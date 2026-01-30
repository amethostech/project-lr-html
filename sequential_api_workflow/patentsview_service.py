"""
PatentsView API Service
Provides search functionality using the PatentsView API for rich patent metadata.
"""
import requests
from typing import List, Dict, Any, Optional

# API Configuration
PATENTSVIEW_API_KEY = "gHnGYUVo.LvuL5K0YiHqVbDjB4biYicrzb8xiQmgi"
PATENTSVIEW_URL = "https://search.patentsview.org/api/v1/patent/"

HEADERS = {
    "X-Api-Key": PATENTSVIEW_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json"
}


def search_patents(
    keywords: str,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    page: int = 1,
    size: int = 100
) -> Dict[str, Any]:
    """
    Search patents using PatentsView API.
    
    Args:
        keywords: Search keywords (space-separated for OR, can include phrases)
        start_year: Start year for date filter (optional)
        end_year: End year for date filter (optional)
        page: Page number for pagination
        size: Number of results per page (max 100)
    
    Returns:
        Dictionary with 'results' list and 'total' count
    """
    # Build the query
    query_conditions = []
    
    # Add date filters if provided
    if start_year:
        query_conditions.append({"_gte": {"patent_date": f"{start_year}-01-01"}})
    if end_year:
        query_conditions.append({"_lte": {"patent_date": f"{end_year}-12-31"}})
    
    # Add keyword search across title, abstract, and assignee
    if keywords:
        query_conditions.append({
            "_or": [
                {"_text_any": {"patent_title": keywords}},
                {"_text_any": {"patent_abstract": keywords}},
                {"_text_any": {"assignees.assignee_organization": keywords}}
            ]
        })
    
    # Build full query
    if len(query_conditions) > 1:
        query = {"_and": query_conditions}
    elif len(query_conditions) == 1:
        query = query_conditions[0]
    else:
        query = {}
    
    request_body = {
        "q": query,
        "f": [
            "patent_id",
            "patent_title",
            "patent_date",
            "patent_abstract",
            "assignees.assignee_organization",
            "inventors.inventor_name_first",
            "inventors.inventor_name_last"
        ],
        "o": {
            "size": min(size, 100),
            "page": page,
            "sort": [{"patent_date": "desc"}]
        }
    }
    
    try:
        print(f"DEBUG PatentsView: Searching for '{keywords}' ({start_year}-{end_year})")
        response = requests.post(
            PATENTSVIEW_URL,
            headers=HEADERS,
            json=request_body,
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        patents = data.get("patents", [])
        total = data.get("total_patent_count", len(patents))
        
        print(f"DEBUG PatentsView: Found {len(patents)} patents (total: {total})")
        
        # Transform to consistent format for frontend
        results = []
        for p in patents:
            # Get first assignee
            assignees = p.get("assignees", [])
            assignee = assignees[0].get("assignee_organization") if assignees else None
            
            # Get inventors
            inventors = p.get("inventors", [])
            inventor_names = [
                f"{inv.get('inventor_name_first', '')} {inv.get('inventor_name_last', '')}".strip()
                for inv in inventors
            ]
            
            results.append({
                "patent_id": p.get("patent_id"),
                "title": p.get("patent_title"),
                "abstract": p.get("patent_abstract"),
                "assignee": assignee,
                "date": p.get("patent_date"),
                "year": p.get("patent_date", "")[:4] if p.get("patent_date") else None,
                "inventors": inventor_names,
                "google_patents_url": f"https://patents.google.com/patent/US{p.get('patent_id')}"
            })
        
        return {"results": results, "total": total}
        
    except requests.exceptions.RequestException as e:
        print(f"PatentsView API Error: {e}")
        return {"results": [], "total": 0, "error": str(e)}


# For testing
if __name__ == "__main__":
    result = search_patents("blockchain", start_year=2020, end_year=2024, size=5)
    print(f"Found {len(result['results'])} results")
    for r in result['results']:
        print(f"  - {r['patent_id']}: {r['title'][:50]}...")
