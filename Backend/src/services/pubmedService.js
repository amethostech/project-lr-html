import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

/**
 * Parses the XML response from NCBI EFetch into a structured array of articles.
 */
function parseEFetchXML(xmlString, queryDetails) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        isArray: (name) => {
            return ['PubmedArticle', 'Author', 'MeshHeading', 'ArticleId'].includes(name);
        }
    });
    
    const result = parser.parse(xmlString);
    const articles = result.PubmedArticleSet?.PubmedArticle || [];
    const articleList = Array.isArray(articles) ? articles : [articles];
    const parsedArticles = [];

    articleList.forEach(article => {
        try {
            const medlineCitation = article.MedlineCitation;
            const articleData = medlineCitation?.Article;
            const journal = articleData?.Journal;
            const meshHeadingList = medlineCitation?.MeshHeadingList?.MeshHeading || [];
            
            // Core Data Extraction
            const title = articleData?.ArticleTitle || '';
            const abstractObj = articleData?.Abstract?.AbstractText;
            let abstractText = '';
            
            if (typeof abstractObj === 'string') {
                abstractText = abstractObj;
            } else if (Array.isArray(abstractObj)) {
                abstractText = abstractObj.map(a => a['#text'] || a).join(' ');
            } else if (abstractObj && abstractObj['#text']) {
                abstractText = abstractObj['#text'];
            }

            const pmid = medlineCitation?.PMID?.['#text'] || medlineCitation?.PMID || '';
            
            // Extract Authors
            const authors = articleData?.AuthorList?.Author || [];
            const authorList = Array.isArray(authors) ? authors : [authors];
            const authorNames = authorList.map(a => `${a.LastName || ''} ${a.ForeName || ''}`.trim()).join('; ');

            // Extract Publication Year
            const pubDate = journal?.JournalIssue?.PubDate;
            const publicationYear = pubDate?.Year || pubDate?.MedlineDate?.toString().slice(0, 4) || '';

            // Extract DOI
            const articleIds = article?.PubmedData?.ArticleIdList?.ArticleId || [];
            const idList = Array.isArray(articleIds) ? articleIds : [articleIds];
            const doiObj = idList.find(id => id['@_IdType'] === 'doi');
            const doi = doiObj?.['#text'] || doiObj || '';

            // First Author
            const firstAuthor = authorList[0] || {};
            const authorFirstName = firstAuthor.ForeName || '';
            const authorLastName = firstAuthor.LastName || '';

            // MeSH Terms Extraction
            const meshList = Array.isArray(meshHeadingList) ? meshHeadingList : [meshHeadingList];
            const majorTopics = meshList
                .filter(m => m?.DescriptorName?.['@_MajorTopicYN'] === 'Y')
                .map(m => m?.DescriptorName?.['#text'] || '')
                .filter(Boolean);
            
            const subheadings = meshList
                .map(m => {
                    const qual = m?.QualifierName;
                    if (Array.isArray(qual)) {
                        return qual.map(q => q['#text'] || q).filter(Boolean).join('; ');
                    }
                    return qual?.['#text'] || qual || '';
                })
                .filter(Boolean);
            
            const allTerms = meshList
                .map(m => m?.DescriptorName?.['#text'] || '')
                .filter(Boolean);

            const articleObject = {
                'Title': title,
                'Authors': authorNames,
                'Publication Year': publicationYear,
                'Abstract': abstractText,
                'DOI/PMID': doi || pmid,
                'Source': 'PubMed',
                'Search Term': queryDetails.term,
                'Date From': queryDetails.dateFrom || '',
                'Date To': queryDetails.dateTo || '',
                'Textword': queryDetails.term,
                'Author First Name': authorFirstName,
                'Author Last Name': authorLastName,
            };

            // Dynamic MeSH Columns (Max 5 each type)
            for (let i = 0; i < 5; i++) {
                articleObject[`MeSH Major Topic ${i + 1}`] = majorTopics[i] || '';
                articleObject[`MeSH Subheading ${i + 1}`] = subheadings[i] || '';
                articleObject[`MeSH Term ${i + 1}`] = allTerms[i] || '';
            }

            parsedArticles.push(articleObject);
        } catch (e) {
            console.error("Skipping corrupted article data:", e.message);
        }
    });

    return parsedArticles;
}


// ==================== PUBMED SEARCH UTILITY ====================
/**
 * Executes a full PubMed search (ESearch + EFetch) and returns parsed results.
 */
export async function searchPubMedUtil(query, dateFrom = null, dateTo = null, maxResults = 100) {
    try {
        console.log(`[PubMed Util] Searching for: "${query}", from: ${dateFrom}, to: ${dateTo}`);

        // Step 1: ESearch - Get article IDs
        const searchParams = new URLSearchParams({
            db: "pubmed",
            term: query,
            retmode: "json",
            retmax: String(Math.min(maxResults, 10000)),
        });

        if (dateFrom) {
            searchParams.set("datetype", "PDAT");
            searchParams.set("mindate", dateFrom);
        }
        if (dateTo) {
            searchParams.set("datetype", "PDAT");
            searchParams.set("maxdate", dateTo);
        }

        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`;
        console.log(`[PubMed Util] ESearch URL: ${searchUrl}`);

        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error(`ESearch failed with status: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        const count = Number(searchData?.esearchresult?.count || 0);
        const ids = searchData?.esearchresult?.idlist || [];

        console.log(`[PubMed Util] Found ${count} results, fetching ${ids.length} articles`);

        if (ids.length === 0) {
            return { count: 0, results: [] };
        }

        // Step 2: EFetch - Get full article details
        const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
        console.log(`[PubMed Util] EFetch URL (first 200 chars): ${fetchUrl.substring(0, 200)}...`);

        const fetchResponse = await fetch(fetchUrl);
        if (!fetchResponse.ok) {
            throw new Error(`EFetch failed with status: ${fetchResponse.status}`);
        }

        const xmlData = await fetchResponse.text();
        console.log(`[PubMed Util] Received XML data, length: ${xmlData.length}`);

        // Step 3: Parse XML
        const results = parseEFetchXML(xmlData, { term: query, dateFrom, dateTo });
        console.log(`[PubMed Util] Parsed ${results.length} articles`);

        return { count, results };

    } catch (error) {
        console.error('[PubMed Util] Error:', error.message);
        throw error;
    }
}