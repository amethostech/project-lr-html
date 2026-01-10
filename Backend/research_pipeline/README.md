# Research Pipeline

## Overview
This project implements a research pipeline to identifying drug targets and subtargets for specific diseases (focusing on Atopic Dermatitis and S1P1 modulators) by extracting information from scientific literature and patent databases.

The pipeline executes the following steps:
1.  **PubMed Search**: Retrieves relevant scientific articles.
2.  **Target Extraction**: Identifies potential drug targets from article abstracts.
3.  **Cross-Referencing**: Searches for these targets in ClinicalTrials.gov and USPTO Patent databases.

## Target Extraction Methodology

The "finding the target" logic is implemented in `target_extractor.py` and relies on a **deterministic keyword matching approach**.

### How it Works
1.  **Configuration**: The list of targets and subtargets is manually defined in `config.py` under the `KNOWN_TARGETS` and `KNOWN_SUBTARGETS` dictionaries. Each entry maps a canonical target name (e.g., "S1P1") to a list of synonyms and aliases (e.g., "S1PR1", "sphingosine-1-phosphate receptor 1").
2.  **Matching Process**:
    - The `target_extractor.py` script iterates through the Title and Abstract of each retrieved PubMed article.
    - It performs a case-insensitive text search for every alias defined in the configuration.
    - Precise word boundary detection (`\b` regex) is used to avoid partial matches (e.g., ensuring "S1P" doesn't match inside "S1P1").
3.  **Counting & Ranking**:
    - The pipeline counts the number of articles mentioning each target.
    - Targets are ranked by mention frequency to determine the most relevant "Top Targets" for downstream searching in Clinical Trials and Patent databases.

### Modifying Targets
To add or remove targets from the search, regular expressions and aliases can be updated directly in the `KNOWN_TARGETS` dictionary within `config.py`.

## Usage

To run the full pipeline:

```bash
python main.py
```

### Output
Results are saved to the `output/` directory:
- `pubmed_results.csv`: Raw articles.
- `extracted_targets.csv`: Summary of found targets and their frequencies.
- `extracted_targets_detailed.csv`: Line-by-line extraction evidence.
- `clinical_trials_results.csv`: Related clinical trials.
- `patent_results.csv`: Related patents.
