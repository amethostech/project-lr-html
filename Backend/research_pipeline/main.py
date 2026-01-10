#!/usr/bin/env python3
"""
Main Orchestration Script for Research Pipeline.
Runs PubMed search, extracts targets, then cascades to ClinicalTrials and Patents.
"""

import os
import sys
from datetime import datetime

# Add the pipeline directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from pubmed_search import run_pubmed_search
from target_extractor import run_target_extraction, get_target_keywords_for_search
from clinicaltrials_search import run_clinical_trials_search
from patent_search import run_patent_search


def print_header(title: str) -> None:
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def run_pipeline():
    """
    Execute the full research pipeline:
    1. Search PubMed for atopic dermatitis + S1P1 modulators
    2. Extract drug targets from abstracts
    3. Search ClinicalTrials.gov with disease + targets
    4. Search USPTO Patents with disease + targets
    """
    start_time = datetime.now()
    
    print_header("RESEARCH PIPELINE: Atopic Dermatitis & S1P1 Modulators")
    print(f"Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Output directory: {os.path.abspath(config.OUTPUT_DIR)}")
    
    # Ensure output directory exists
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    
    # ===== STEP 1: PubMed Search =====
    print_header("STEP 1: PubMed Search")
    try:
        articles = run_pubmed_search()
        print(f"\n✅ PubMed search complete: {len(articles)} articles retrieved")
    except Exception as e:
        print(f"\n❌ PubMed search failed: {e}")
        articles = []
    
    if not articles:
        print("\n⚠️ No PubMed articles found. Pipeline cannot continue.")
        return
    
    # ===== STEP 2: Target Extraction =====
    print_header("STEP 2: Target Extraction")
    try:
        extraction_results = run_target_extraction(articles)
        targets = get_target_keywords_for_search(extraction_results, top_n=5)
        print(f"\n✅ Target extraction complete")
        print(f"   Top targets for downstream search: {targets}")
    except Exception as e:
        print(f"\n❌ Target extraction failed: {e}")
        targets = []
    
    # ===== STEP 3: ClinicalTrials.gov Search =====
    print_header("STEP 3: ClinicalTrials.gov Search")
    try:
        studies = run_clinical_trials_search(targets)
        print(f"\n✅ ClinicalTrials search complete: {len(studies)} studies retrieved")
    except Exception as e:
        print(f"\n❌ ClinicalTrials search failed: {e}")
        studies = []
    
    # ===== STEP 4: USPTO Patent Search =====
    print_header("STEP 4: USPTO Patent Search")
    try:
        patents = run_patent_search(targets)
        print(f"\n✅ Patent search complete: {len(patents)} patents retrieved")
    except Exception as e:
        print(f"\n❌ Patent search failed: {e}")
        patents = []
    
    # ===== SUMMARY =====
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print_header("PIPELINE COMPLETE")
    print(f"Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Total duration: {duration:.1f} seconds")
    print()
    print("📊 Results Summary:")
    print(f"   • PubMed articles:     {len(articles)}")
    print(f"   • Extracted targets:   {len(extraction_results.get('targets', []))}")
    print(f"   • Extracted subtargets:{len(extraction_results.get('subtargets', []))}")
    print(f"   • Clinical trials:     {len(studies)}")
    print(f"   • Patents:             {len(patents)}")
    print()
    print("📁 Output files:")
    for filename in os.listdir(config.OUTPUT_DIR):
        filepath = os.path.join(config.OUTPUT_DIR, filename)
        if os.path.isfile(filepath):
            size = os.path.getsize(filepath)
            print(f"   • {filename} ({size:,} bytes)")
    
    return {
        "articles": articles,
        "targets": extraction_results,
        "studies": studies,
        "patents": patents
    }


if __name__ == "__main__":
    run_pipeline()
