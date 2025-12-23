/**
 * Normalize heterogeneous result rows into a concise, readable set of columns
 * per source before writing to the consolidated Excel.
 */

function pick(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).length > 0) {
      return row[key];
    }
  }
  return '';
}

function normalizePub(row, source) {
  return {
    Title: pick(row, ['Title', 'title']),
    Authors: pick(row, ['Authors', 'authors']),
    PublicationYear: pick(row, ['Publication Year', 'PublicationYear', 'publicationYear', 'publication_year']),
    Abstract: pick(row, ['Abstract', 'abstract']),
    Identifier: pick(row, ['DOI/PMID', 'DOI_PMID', 'doi', 'pmid', 'identifier']),
    Source: pick(row, ['Source', 'source']) || source,
    'Source Database': source,
    'Search Term': pick(row, ['Search Term', 'searchTerm', 'query']),
    'Date From': pick(row, ['Date From', 'dateFrom']),
    'Date To': pick(row, ['Date To', 'dateTo']),
    'Search Date': new Date().toISOString().split('T')[0],
  };
}

function normalizeScholar(row, source) {
  return {
    Title: pick(row, ['Title', 'title']),
    Authors: pick(row, ['Authors', 'authors']),
    PublicationYear: pick(row, ['PublicationYear', 'Publication Year', 'publicationYear']),
    Abstract: pick(row, ['Abstract', 'abstract', 'snippet']),
    Identifier: pick(row, ['DOI_PMID', 'DOI/PMID', 'doi', 'pmid']),
    Source: pick(row, ['Source', 'source']) || source,
    'Source Database': source,
    'Search Term': pick(row, ['Search Term', 'searchTerm', 'query']),
    'Search Date': new Date().toISOString().split('T')[0],
  };
}

function normalizeTrials(row, source) {
  return {
    'Study Title': pick(row, ['Study Title', 'title']),
    Conditions: pick(row, ['Conditions', 'conditions']),
    Status: pick(row, ['Status', 'status']),
    Phase: pick(row, ['Phase', 'phase']),
    'Start Date': pick(row, ['Start Date', 'startDate']),
    'Completion Date': pick(row, ['Completion Date', 'completionDate']),
    'NCT ID': pick(row, ['NCT ID', 'nctId', 'nct_id']),
    Sponsor: pick(row, ['Sponsor', 'sponsor']),
    'Source Database': source,
    'Search Date': new Date().toISOString().split('T')[0],
  };
}

function normalizePatents(row, source) {
  // Extract abstract from various possible fields
  let abstract = pick(row, ['abstract', 'Abstract', 'abstractText', 'abstractText_en', 'abstract_en', 'description', 'Description', 'abstractText_original']);
  
  // Handle array abstracts
  if (Array.isArray(abstract)) {
    abstract = abstract.join(' ');
  }
  
  // If still no abstract, try nested structures
  if (!abstract && row.abstractText) {
    if (typeof row.abstractText === 'string') {
      abstract = row.abstractText;
    } else if (Array.isArray(row.abstractText)) {
      abstract = row.abstractText.join(' ');
    } else if (row.abstractText.text || row.abstractText.value) {
      abstract = row.abstractText.text || row.abstractText.value;
    }
  }
  
  return {
    Title: pick(row, ['title', 'inventionTitle', 'Invention Title', 'inventorNameText', 'titleText', 'title_en', 'patentTitle', 'inventionTitleText']),
    'Publication Number': pick(row, ['publicationNumber', 'Publication Number', 'patentNumber', 'patentNumberText', 'patentNo']),
    'Application Number': pick(row, ['applicationNumber', 'Application Number']),
    'Filing Date': pick(row, ['filingDate', 'Filing Date']),
    'Publication Date': pick(row, ['publicationDate', 'Publication Date', 'pubDate']),
    'Issue Date': pick(row, ['issueDate', 'Issue Date', 'grantDate']),
    Assignee: pick(row, ['assignee', 'assigneeName', 'Assignee Name']),
    Inventor: pick(row, ['inventor', 'inventorName', 'Inventor Name', 'inventorNameText']),
    Abstract: abstract || 'No abstract available',
    'Source Database': source,
    'Search Date': new Date().toISOString().split('T')[0],
  };
}

function normalizeNews(row, source) {
  return {
    Headline: pick(row, ['Headline', 'title']),
    Source: pick(row, ['Source', 'source']),
    Date: pick(row, ['Date', 'date']),
    Link: pick(row, ['News link', 'link']),
    Extract: pick(row, ['Body/abstract/extract', 'extract', 'Cleaned_Text_G']),
    'Source Database': source,
    'Search Date': new Date().toISOString().split('T')[0],
  };
}

/**
 * Normalize an array of result rows based on source.
 * Falls back to original rows if source is unknown.
 */
export function normalizeResultsForConsolidated(results = [], source = 'Unknown') {
  const src = (source || '').toLowerCase();
  let mapper;

  if (src.includes('pubmed')) mapper = normalizePub;
  else if (src.includes('google')) mapper = normalizeScholar;
  else if (src.includes('scholar')) mapper = normalizeScholar;
  else if (src.includes('clinical')) mapper = normalizeTrials;
  else if (src.includes('uspto') || src.includes('patent')) mapper = normalizePatents;
  else if (src.includes('news')) mapper = normalizeNews;

  if (!mapper) return results;

  return results.map(row => mapper(row, source));
}


