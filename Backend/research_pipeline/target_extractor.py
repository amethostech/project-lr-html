"""
Target Extractor Module.
Extracts drug targets and subtargets from PubMed article abstracts.
"""

import os
import re
import csv
from collections import defaultdict
import config


def extract_targets_from_text(text: str, target_dict: dict) -> list[tuple[str, str]]:
    """
    Extract target mentions from text using keyword matching.
    
    Args:
        text: Text to search (abstract, title, etc.)
        target_dict: Dictionary mapping target names to aliases
    
    Returns:
        List of (target_name, matched_term) tuples
    """
    if not text:
        return []
    
    found_targets = []
    text_lower = text.lower()
    
    for target_name, aliases in target_dict.items():
        for alias in aliases:
            # Case-insensitive search with word boundaries
            pattern = r'\b' + re.escape(alias.lower()) + r'\b'
            if re.search(pattern, text_lower):
                found_targets.append((target_name, alias))
                break  # Only count each target once per text
    
    return found_targets


def extract_targets_from_articles(articles: list[dict]) -> dict:
    """
    Extract targets and subtargets from a list of PubMed articles.
    
    Args:
        articles: List of article dictionaries with 'abstract' and 'title' keys
    
    Returns:
        Dictionary with extracted target data
    """
    print(f" Extracting targets from {len(articles)} articles...")
    
    # Track all found targets and their sources
    target_counts = defaultdict(int)
    subtarget_counts = defaultdict(int)
    target_sources = defaultdict(list)  # target -> list of PMIDs
    subtarget_sources = defaultdict(list)
    
    all_extractions = []
    
    for article in articles:
        pmid = article.get("pmid", "")
        title = article.get("title", "")
        abstract = article.get("abstract", "")
        combined_text = f"{title} {abstract}"
        
        # Extract main targets
        found_targets = extract_targets_from_text(combined_text, config.KNOWN_TARGETS)
        for target_name, matched_term in found_targets:
            target_counts[target_name] += 1
            if pmid not in target_sources[target_name]:
                target_sources[target_name].append(pmid)
            
            all_extractions.append({
                "pmid": pmid,
                "type": "target",
                "name": target_name,
                "matched_term": matched_term,
                "source_title": title[:100] + "..." if len(title) > 100 else title
            })
        
        # Extract subtargets
        found_subtargets = extract_targets_from_text(combined_text, config.KNOWN_SUBTARGETS)
        for subtarget_name, matched_term in found_subtargets:
            subtarget_counts[subtarget_name] += 1
            if pmid not in subtarget_sources[subtarget_name]:
                subtarget_sources[subtarget_name].append(pmid)
            
            all_extractions.append({
                "pmid": pmid,
                "type": "subtarget",
                "name": subtarget_name,
                "matched_term": matched_term,
                "source_title": title[:100] + "..." if len(title) > 100 else title
            })
    
    # Sort by frequency
    sorted_targets = sorted(target_counts.items(), key=lambda x: x[1], reverse=True)
    sorted_subtargets = sorted(subtarget_counts.items(), key=lambda x: x[1], reverse=True)
    
    print(f"\n📊 Target Extraction Summary:")
    print(f"   Found {len(sorted_targets)} unique targets")
    print(f"   Found {len(sorted_subtargets)} unique subtargets")
    
    if sorted_targets:
        print(f"\n   Top 5 Targets:")
        for name, count in sorted_targets[:5]:
            print(f"      • {name}: {count} mentions")
    
    if sorted_subtargets:
        print(f"\n   Top 5 Subtargets:")
        for name, count in sorted_subtargets[:5]:
            print(f"      • {name}: {count} mentions")
    
    return {
        "targets": sorted_targets,
        "subtargets": sorted_subtargets,
        "target_sources": dict(target_sources),
        "subtarget_sources": dict(subtarget_sources),
        "all_extractions": all_extractions
    }


def save_targets_to_csv(extraction_results: dict, output_path: str) -> None:
    """
    Save extracted targets to CSV file.
    
    Args:
        extraction_results: Dictionary from extract_targets_from_articles()
        output_path: Path to output CSV file
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save summary CSV
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Type", "Name", "Mention Count", "Source PMIDs"])
        
        for name, count in extraction_results["targets"]:
            pmids = extraction_results["target_sources"].get(name, [])
            writer.writerow(["target", name, count, "; ".join(pmids[:10])])
        
        for name, count in extraction_results["subtargets"]:
            pmids = extraction_results["subtarget_sources"].get(name, [])
            writer.writerow(["subtarget", name, count, "; ".join(pmids[:10])])
    
    print(f"💾 Saved target summary to {output_path}")
    
    # Save detailed extractions
    detail_path = output_path.replace(".csv", "_detailed.csv")
    with open(detail_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["pmid", "type", "name", "matched_term", "source_title"])
        writer.writeheader()
        writer.writerows(extraction_results["all_extractions"])
    
    print(f"💾 Saved detailed extractions to {detail_path}")


def get_target_keywords_for_search(extraction_results: dict, top_n: int = 5) -> list[str]:
    """
    Get list of top target names for use in downstream searches.
    
    Args:
        extraction_results: Dictionary from extract_targets_from_articles()
        top_n: Number of top targets to return
    
    Returns:
        List of target names
    """
    targets = extraction_results.get("targets", [])
    return [name for name, count in targets[:top_n]]


def run_target_extraction(articles: list[dict] = None) -> dict:
    """
    Main function to run target extraction.
    
    Args:
        articles: Optional list of articles. If None, loads from pubmed_results.csv
    
    Returns:
        Extraction results dictionary
    """
    # Load articles from CSV if not provided
    if articles is None:
        input_path = os.path.join(config.OUTPUT_DIR, "pubmed_results.csv")
        if not os.path.exists(input_path):
            print(f"❌ PubMed results not found at {input_path}")
            print("   Please run pubmed_search.py first")
            return {}
        
        print(f"📂 Loading articles from {input_path}")
        articles = []
        with open(input_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            articles = list(reader)
    
    # Extract targets
    results = extract_targets_from_articles(articles)
    
    # Save to CSV
    output_path = os.path.join(config.OUTPUT_DIR, "extracted_targets.csv")
    save_targets_to_csv(results, output_path)
    
    return results


if __name__ == "__main__":
    print("=" * 60)
    print("Target Extraction from PubMed Results")
    print("=" * 60)
    
    results = run_target_extraction()
    
    if results:
        top_targets = get_target_keywords_for_search(results)
        print(f"\n🎯 Top targets for downstream search: {top_targets}")
