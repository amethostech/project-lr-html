"""
Configuration settings for the research pipeline.
"""

# PubMed/Entrez settings
# IMPORTANT: Set your email for NCBI API access (required)
ENTREZ_EMAIL = "your-email@example.com"  # TODO: Update with your email
ENTREZ_API_KEY = None  # Optional: Get from https://www.ncbi.nlm.nih.gov/account/settings/

# Search parameters
PUBMED_MAX_RESULTS = 100

# ClinicalTrials.gov API v2
CLINICALTRIALS_BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
CLINICALTRIALS_PAGE_SIZE = 100

# USPTO PatentsView API
# New API endpoint (v1)
PATENTSVIEW_BASE_URL = "https://search.patentsview.org/api/v1/patent"
PATENTSVIEW_API_KEY = None  # TODO: Get key from https://patentsview.org/apis/purpose

# Output directory
OUTPUT_DIR = "output"

# Known drug targets for atopic dermatitis
KNOWN_TARGETS = {
    # S1P pathway
    "S1P1": ["S1P1", "S1PR1", "sphingosine-1-phosphate receptor 1", "EDG1"],
    "S1P": ["S1P", "sphingosine-1-phosphate", "S1P receptor"],
    
    # JAK-STAT pathway
    "JAK1": ["JAK1", "Janus kinase 1"],
    "JAK2": ["JAK2", "Janus kinase 2"],
    "JAK3": ["JAK3", "Janus kinase 3"],
    "TYK2": ["TYK2", "tyrosine kinase 2"],
    
    # Interleukins
    "IL-4": ["IL-4", "interleukin-4", "IL4"],
    "IL-13": ["IL-13", "interleukin-13", "IL13"],
    "IL-31": ["IL-31", "interleukin-31", "IL31"],
    "IL-4Rα": ["IL-4R", "IL-4 receptor", "IL4R", "IL-4Rα"],
    
    # PDE inhibitors
    "PDE4": ["PDE4", "phosphodiesterase-4", "phosphodiesterase 4"],
    
    # Other targets
    "TSLP": ["TSLP", "thymic stromal lymphopoietin"],
    "OX40": ["OX40", "OX40L", "CD134"],
    "TRPV1": ["TRPV1", "transient receptor potential vanilloid 1"],
    "NK1R": ["NK1R", "neurokinin-1 receptor", "substance P receptor"],
    "H4R": ["H4R", "histamine H4 receptor"],
    "DGAT1": ["DGAT1", "diacylglycerol O-acyltransferase 1"],
    "AhR": ["AhR", "aryl hydrocarbon receptor"],
}

# Known subtargets (more specific pathway components)
KNOWN_SUBTARGETS = {
    "STAT3": ["STAT3", "signal transducer and activator of transcription 3"],
    "STAT6": ["STAT6", "signal transducer and activator of transcription 6"],
    "NF-κB": ["NF-κB", "NF-kB", "nuclear factor kappa B"],
    "Th2": ["Th2", "T helper 2", "type 2 helper T cell"],
    "IgE": ["IgE", "immunoglobulin E"],
    "GATA3": ["GATA3", "GATA binding protein 3"],
    "CCL17": ["CCL17", "TARC", "thymus and activation-regulated chemokine"],
    "CCL22": ["CCL22", "MDC", "macrophage-derived chemokine"],
    "Eotaxin": ["eotaxin", "CCL11", "CCL24", "CCL26"],
}
