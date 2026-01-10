"""
PubMed Search Module using Biopython/Entrez API.
Searches for atopic dermatitis + S1P1 modulators and fetches most recent publications.
"""

import os
import csv
import ssl
import certifi
from datetime import datetime
from Bio import Entrez
import config

# SSL workaround for macOS Python installations
# This fixes certificate verification issues
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

# Configure Entrez
Entrez.email = config.ENTREZ_EMAIL
if config.ENTREZ_API_KEY:
    Entrez.api_key = config.ENTREZ_API_KEY



def build_search_query(keywords: list[str], operator: str = "AND") -> str:
    """
    Build a PubMed search query from keywords.
    
    Args:
        keywords: List of search terms
        operator: Boolean operator (AND/OR) to combine terms
    
    Returns:
        Formatted PubMed query string
    """
    # Add field qualifiers for better search
    formatted_terms = []
    for kw in keywords:
        # Search in Title/Abstract
        formatted_terms.append(f'("{kw}"[Title/Abstract])')
    
    return f" {operator} ".join(formatted_terms)


def search_pubmed(query: str, max_results: int = 100, sort: str = "pub_date") -> list[str]:
    """
    Search PubMed and return list of PMIDs.
    
    Args:
        query: PubMed search query
        max_results: Maximum number of results to return
        sort: Sort order - 'pub_date' for most recent first
    
    Returns:
        List of PMID strings
    """
    print(f"🔍 Searching PubMed with query: {query}")
    print(f"   Max results: {max_results}, Sort by: {sort}")
    
    handle = Entrez.esearch(
        db="pubmed",
        term=query,
        retmax=max_results,
        sort=sort,  # 'pub_date' sorts by publication date, most recent first
        usehistory="y"
    )
    
    results = Entrez.read(handle)
    handle.close()
    
    pmids = results.get("IdList", [])
    total_count = results.get("Count", "0")
    
    print(f"✅ Found {total_count} total results, fetching top {len(pmids)}")
    
    return pmids


def fetch_article_details(pmids: list[str]) -> list[dict]:
    """
    Fetch detailed information for a list of PMIDs.
    Uses batching and retries to handle network instability.
    
    Args:
        pmids: List of PubMed IDs
    
    Returns:
        List of article dictionaries with full details
    """
    import http.client
    import time

    if not pmids:
        return []
    
    print(f"📚 Fetching details for {len(pmids)} articles...")
    
    articles = []
    BATCH_SIZE = 20
    MAX_RETRIES = 3
    
    # Process in batches
    for i in range(0, len(pmids), BATCH_SIZE):
        batch_pmids = pmids[i:i + BATCH_SIZE]
        print(f"   Processing batch {i//BATCH_SIZE + 1}/{(len(pmids)-1)//BATCH_SIZE + 1} ({len(batch_pmids)} articles)...")
        
        for attempt in range(MAX_RETRIES):
            try:
                handle = Entrez.efetch(
                    db="pubmed",
                    id=",".join(batch_pmids),
                    rettype="xml",
                    retmode="xml"
                )
                
                records = Entrez.read(handle)
                handle.close()
                
                # Process records in this batch
                for record in records.get("PubmedArticle", []):
                    try:
                        medline = record.get("MedlineCitation", {})
                        article = medline.get("Article", {})
                        
                        # Extract PMID
                        pmid = str(medline.get("PMID", ""))
                        
                        # Extract title
                        title = article.get("ArticleTitle", "")
                        
                        # Extract abstract
                        abstract_parts = article.get("Abstract", {}).get("AbstractText", [])
                        if isinstance(abstract_parts, list):
                            abstract = " ".join(str(part) for part in abstract_parts)
                        else:
                            abstract = str(abstract_parts)
                        
                        # Extract authors
                        author_list = article.get("AuthorList", [])
                        authors = []
                        for author in author_list[:5]:  # First 5 authors
                            last_name = author.get("LastName", "")
                            fore_name = author.get("ForeName", "")
                            if last_name:
                                authors.append(f"{last_name} {fore_name}".strip())
                        author_str = "; ".join(authors)
                        if len(author_list) > 5:
                            author_str += " et al."
                        
                        # Extract journal info
                        journal = article.get("Journal", {})
                        journal_title = journal.get("Title", "")
                        
                        # Extract publication date
                        pub_date_info = article.get("ArticleDate", [])
                        if pub_date_info:
                            pd = pub_date_info[0]
                            pub_date = f"{pd.get('Year', '')}-{pd.get('Month', '01'):>02}-{pd.get('Day', '01'):>02}"
                        else:
                            # Try journal issue date
                            issue_date = journal.get("JournalIssue", {}).get("PubDate", {})
                            year = issue_date.get("Year", "")
                            month = issue_date.get("Month", "01")
                            day = issue_date.get("Day", "01")
                            pub_date = f"{year}-{month}-{day}" if year else ""
                        
                        # Extract keywords/MeSH terms
                        mesh_headings = medline.get("MeshHeadingList", [])
                        mesh_terms = []
                        for mesh in mesh_headings[:10]:  # First 10 MeSH terms
                            descriptor = mesh.get("DescriptorName", "")
                            if descriptor:
                                mesh_terms.append(str(descriptor))
                        
                        articles.append({
                            "pmid": pmid,
                            "title": title,
                            "abstract": abstract,
                            "authors": author_str,
                            "journal": journal_title,
                            "pub_date": pub_date,
                            "mesh_terms": "; ".join(mesh_terms),
                            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                        })
                        
                    except Exception as e:
                        print(f"⚠️ Error parsing article in batch: {e}")
                        continue
                
                # If success, break retry loop
                break
                
            except (http.client.IncompleteRead, Exception) as e:
                print(f"⚠️ Batch failed (attempt {attempt+1}/{MAX_RETRIES}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(2 * (attempt + 1))  # Exponential backoff
                else:
                    print(f"❌ Failed to fetch batch after {MAX_RETRIES} attempts. Skipping.")
    
    print(f"✅ Successfully parsed {len(articles)} articles")
    return articles


def save_results_to_csv(articles: list[dict], output_path: str) -> None:
    """
    Save article results to CSV file.
    
    Args:
        articles: List of article dictionaries
        output_path: Path to output CSV file
    """
    if not articles:
        print("⚠️ No articles to save")
        return
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    fieldnames = ["pmid", "title", "abstract", "authors", "journal", "pub_date", "mesh_terms", "url"]
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(articles)
    
    print(f"💾 Saved {len(articles)} articles to {output_path}")


def run_pubmed_search() -> list[dict]:
    """
    Main function to run PubMed search for atopic dermatitis + S1P1 modulators.
    
    Returns:
        List of article dictionaries
    """
    # Build search query with proper PubMed syntax
    # Search for atopic dermatitis AND any S1P-related terms
    query = '("atopic dermatitis"[Title/Abstract]) AND (S1P1[Title/Abstract] OR S1P[Title/Abstract] OR "sphingosine-1-phosphate"[Title/Abstract] OR "S1P receptor"[Title/Abstract] OR "sphingosine 1-phosphate"[Title/Abstract])'
    
    # Search PubMed
    pmids = search_pubmed(
        query=query,
        max_results=config.PUBMED_MAX_RESULTS,
        sort="pub_date"  # Most recent first
    )
    
    # Fetch article details
    articles = fetch_article_details(pmids)
    
    # Save to CSV
    output_path = os.path.join(config.OUTPUT_DIR, "pubmed_results.csv")
    save_results_to_csv(articles, output_path)
    
    return articles


if __name__ == "__main__":
    print("=" * 60)
    print("PubMed Search: Atopic Dermatitis + S1P1 Modulators")
    print("=" * 60)
    
    articles = run_pubmed_search()
    
    print("\n📊 Summary:")
    print(f"   Total articles retrieved: {len(articles)}")
    if articles:
        print(f"   Most recent publication: {articles[0].get('pub_date', 'N/A')}")
        print(f"   Oldest publication: {articles[-1].get('pub_date', 'N/A')}")
