import fetch from 'node-fetch';
import { getCachedResults, cacheResults } from './pubChemCacheService.js';

const CONFIG = {
    MAX_AIDS_PER_MOLECULE: 150,      // Limit AIDs to prevent excessive API calls
    AID_BATCH_SIZE: 8,                // AIDs per request (reduced from 20)
    CONCURRENT_REQUESTS: 2,           // Max simultaneous requests
    INITIAL_BACKOFF: 1500,            // ms
    MAX_RETRIES: 4,                   // More aggressive retry for network errors
    REQUEST_TIMEOUT: 15000,           // 15 second timeout per request
    INTER_REQUEST_DELAY: 300          // ms delay between requests
};

/**
 * Queue-based request limiter to avoid overloading PubChem API
 */
class RequestQueue {
    constructor(concurrency = 2) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    async run(fn) {
        while (this.running >= this.concurrency) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

const requestQueue = new RequestQueue(CONFIG.CONCURRENT_REQUESTS);

/**
 *  fetch with exponential backoff  technique for rate limits and connection issues
 */
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
    let backoffTime = CONFIG.INITIAL_BACKOFF;

    for (let i = 0; i < retries; i++) {
        try {
            const res = await requestQueue.run(async () => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

                try {
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal,
                        timeout: CONFIG.REQUEST_TIMEOUT
                    });
                    return response;
                } finally {
                    clearTimeout(timeout);
                }
            });

            if (res.ok) {
                console.log(`[PubChem] ✓ Success: ${url.substring(0, 60)}...`);
                return res;
            }

            if (res.status === 404) {
                console.log(`[PubChem] → 404 Not Found: ${url.substring(0, 60)}...`);
                return res;
            }

            // Rate limits and server errors - retry with backoff
            const statusStr = `HTTP ${res.status} ${res.statusText}`;
            if (i < retries - 1 && (res.status === 429 || res.status === 503 || res.status >= 500)) {
                console.warn(`[PubChem] ⚠ ${statusStr}. Backoff ${backoffTime}ms (Attempt ${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, backoffTime));
                backoffTime = Math.min(backoffTime * 2.5, 30000);
            } else {
                console.warn(`[PubChem] ✗ Failed ${statusStr}`);
                return res;
            }
        } catch (error) {
            const isTimeout = error.name === 'AbortError';
            const errorMsg = isTimeout ? 'Request timeout' : error.message;

            if (i < retries - 1) {
                console.warn(`[PubChem] ⚠ ${errorMsg}. Backoff ${backoffTime}ms (Attempt ${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, backoffTime));
                backoffTime = Math.min(backoffTime * 2.5, 30000);
            } else {
                console.error(`[PubChem] ✗ Failed after ${retries} retries: ${errorMsg}`);
                throw error;
            }
        }
    }
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Classifies assay type
 */
function classifyAssay(assayType) {
    if (!assayType) return "Unknown";
    const type = assayType.toLowerCase();
    if (type.includes("screening")) return "Screening";
    if (type.includes("confirmatory")) return "Confirmatory";
    if (type.includes("summary")) return "Summary";
    return "Other";
}

/**
 * Parse target class from various formats
 */
function parseTargetClass(targetData) {
    if (!targetData) return "";
    if (Array.isArray(targetData)) {
        return targetData
            .map(t => typeof t === 'string' ? t : (t.name || t.TargetName || JSON.stringify(t)))
            .filter(Boolean)
            .join(", ");
    }
    if (typeof targetData === 'string') return targetData;
    return targetData.name || JSON.stringify(targetData);
}

/**
 * Fetch compound data from PubChem
 */
async function getCompoundData(molecule) {
    // Add MolecularWeight and MolecularFormula to the requested properties
    const compoundUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(molecule)}/property/IUPACName,CanonicalSMILES,MolecularWeight,MolecularFormula/JSON`;

    const res = await fetchWithRetry(compoundUrl);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Compound fetch failed: ${res.statusText}`);

    try {
        const data = await res.json();
        const properties = data.PropertyTable?.Properties;
        if (!properties || properties.length === 0) return null;

        const compound = properties[0];
        return {
            cid: compound.CID,
            iupacName: compound.IUPACName || molecule,
            smiles: compound.CanonicalSMILES || "",
            molecularWeight: compound.MolecularWeight || "",
            molecularFormula: compound.MolecularFormula || ""
        };
    } catch (e) {
        console.error(`[PubChem] Error parsing compound data: ${e.message}`);
        return null;
    }
}

/**
 * Fetch AIDs for a compound
 */
async function getAIDs(cid) {
    const aidsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/aids/JSON`;
    const res = await fetchWithRetry(aidsUrl);

    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`AIDs fetch failed: ${res.statusText}`);

    try {
        const data = await res.json();
        let aids = data.InformationList?.Information?.[0]?.AID || [];

        // Limit to MAX_AIDS_PER_MOLECULE to avoid excessive API calls
        if (aids.length > CONFIG.MAX_AIDS_PER_MOLECULE) {
            console.log(`[PubChem] Limiting AIDs from ${aids.length} to ${CONFIG.MAX_AIDS_PER_MOLECULE}`);
            aids = aids.slice(0, CONFIG.MAX_AIDS_PER_MOLECULE);
        }

        console.log(`[PubChem] Found ${aids.length} AIDs for CID ${cid}`);
        return aids;
    } catch (e) {
        console.error(`[PubChem] Error parsing AIDs: ${e.message}`);
        return [];
    }
}

/**
 * Fetch assay summaries for a batch of AIDs
 */
async function getAssaySummaries(aidBatch) {
    const aidsStr = aidBatch.join(',');
    const summaryUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/assay/aid/${aidsStr}/summary/JSON`;

    const res = await fetchWithRetry(summaryUrl);
    if (!res.ok) {
        console.warn(`[PubChem] Summary fetch failed for AIDs ${aidBatch[0]}-${aidBatch[aidBatch.length - 1]}: ${res.status}`);
        return [];
    }

    try {
        const data = await res.json();
        return data.AssaySummaries?.AssaySummary || [];
    } catch (e) {
        console.error(`[PubChem] Error parsing assay summaries: ${e.message}`);
        return [];
    }
}

/**
 * Process assay records with filters
 */
function filterAssayRecords(summaries, iupacName, cid, smiles, molecularWeight, molecularFormula, bioassayFilter, targetClass, maxResults) {
    const records = [];

    for (const assay of summaries) {
        if (records.length >= maxResults) break;

        const methodType = assay.Method || assay.AssayType || "Unknown";
        const category = classifyAssay(methodType);

        if (bioassayFilter && bioassayFilter !== "Any") {
            if (category.toLowerCase() !== bioassayFilter.trim().toLowerCase()) {
                continue;
            }
        }

        const target = parseTargetClass(assay.TargetName);

        if (targetClass && targetClass.trim() !== "") {
            if (!target.toLowerCase().includes(targetClass.trim().toLowerCase())) {
                continue;
            }
        }

        records.push({
            'Molecule Name': iupacName,
            'CID': cid,
            'SMILES': smiles,
            'Molecular Weight': molecularWeight || 'N/A',
            'Molecular Formula': molecularFormula || 'N/A',
            'AID': assay.AID,
            'Assay Name': assay.Name,
            'Assay Type': methodType,
            'Category': category,
            'Target Class': target || 'Unknown',
            'Source': 'PubChem'
        });
    }

    return records;
}

/**
 * Fetch compound profile data from PubChem PUG_VIEW API
 * Returns mechanism of action, pharmacology, and other compound information
 */
async function getCompoundProfileData(cid) {
    const profileUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON`;

    const res = await fetchWithRetry(profileUrl);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Compound profile fetch failed: ${res.statusText}`);

    try {
        const data = await res.json();
        return data;
    } catch (e) {
        console.error(`[PubChem] Error parsing compound profile: ${e.message}`);
        return null;
    }
}

/**
 * Extract mechanism of action from compound profile data
 */
function extractMechanismOfAction(profileData) {
    if (!profileData || !profileData.Record) {
        console.log('[PubChem] No Record field in profile response');
        return null;
    }

    try {
        function findMechanismSection(sectionArray) {
            for (const section of sectionArray) {
                if (section.TOCHeading === "Mechanism of Action") {
                    return section;
                }
                if (section.Section) {
                    const found = findMechanismSection(section.Section);
                    if (found) return found;
                }
            }
            return null;
        }

        const sections = profileData.Record.Section || [];
        const mechanismSection = findMechanismSection(sections);

        if (!mechanismSection) {
            console.log('[PubChem] Mechanism of Action section not found in Record');
            return { hasData: false, mechanism: null, reference: [] };
        }

        const information = mechanismSection.Information || [];
        if (information.length > 0) {
            let mechanismTexts = [];

            for (const info of information) {
                if (info.Value && info.Value.StringWithMarkup) {
                    const texts = info.Value.StringWithMarkup.map(s => s.String).filter(Boolean);
                    mechanismTexts.push(...texts);
                } else if (info.Value && typeof info.Value.String === 'string') {
                    mechanismTexts.push(info.Value.String);
                } else if (info.Value && Array.isArray(info.Value)) {
                    const texts = info.Value.map(v => typeof v === 'string' ? v : v.String).filter(Boolean);
                    mechanismTexts.push(...texts);
                }
            }

            if (mechanismTexts.length > 0) {
                console.log('[PubChem] ✓ Extracted mechanism text');
                return {
                    hasData: true,
                    mechanism: mechanismTexts.join('\n\n'),
                    reference: information[0]?.Reference || []
                };
            }
        }

        console.log('[PubChem] Mechanism section found but no text extracted');
        return { hasData: false, mechanism: null, reference: [] };
    } catch (e) {
        console.error(`[PubChem] Error extracting mechanism of action: ${e.message}`);
        return { hasData: false, mechanism: null, reference: [] };
    }
}

/**
 * Fetch full mechanism of action information for a compound (by CID or name)
 */
export async function fetchMechanismOfAction(moleculeIdentifier) {
    try {
        console.log(`[PubChem] Fetching mechanism of action for: ${moleculeIdentifier}`);

        let cid = parseInt(moleculeIdentifier, 10);

        if (isNaN(cid)) {
            const compound = await getCompoundData(moleculeIdentifier);
            if (!compound) {
                console.log(`[PubChem] Compound not found: ${moleculeIdentifier}`);
                return {
                    success: false,
                    error: "Compound not found",
                    cid: null,
                    compound: null,
                    mechanismOfAction: null
                };
            }
            cid = compound.cid;
        }

        const profileData = await getCompoundProfileData(cid);
        if (!profileData) {
            console.log(`[PubChem] Profile data not found for CID: ${cid}`);
            return {
                success: false,
                error: "Profile data not found",
                cid: cid,
                compound: null,
                mechanismOfAction: null
            };
        }

        const mechanismData = extractMechanismOfAction(profileData);

        const compoundInfo = profileData.Data?.[0]?.Record?.RecordTitle || "Unknown";

        console.log(`[PubChem] ✓ Found mechanism of action for CID ${cid}`);

        if (!mechanismData) {
            return {
                success: true,
                cid: cid,
                compound: compoundInfo,
                mechanismOfAction: null,
                hasData: false,
                reference: []
            };
        }

        return {
            success: true,
            cid: cid,
            compound: compoundInfo,
            mechanismOfAction: mechanismData.mechanism,
            hasData: mechanismData.hasData,
            reference: mechanismData.reference
        };

    } catch (error) {
        console.error(`[PubChem] Error fetching mechanism of action: ${error.message}`);
        return {
            success: false,
            error: error.message,
            cid: null,
            compound: null,
            mechanismOfAction: null
        };
    }
}

/**
 * Main fetch function with optimized batch processing and caching
 */
export async function fetchPubchemData(molecule, bioassayFilter = "Any", targetClass = "", maxResults = 100) {
    const globalStartTime = Date.now();
    console.log(`[PubChem] Starting search for "${molecule}" (max ${maxResults} results)...`);

    try {
        // 1. Check cache first
        const cached = await getCachedResults(molecule, bioassayFilter, targetClass, maxResults);
        if (cached !== null) {
            return cached;
        }

        const startTime = Date.now();
        const metadata = {};

        // 2. Get compound data
        const compound = await getCompoundData(molecule);
        if (!compound) {
            console.log(`[PubChem] Molecule "${molecule}" not found`);
            // Cache the negative result
            await cacheResults(molecule, bioassayFilter, targetClass, maxResults, [], {});
            return [];
        }
        console.log(`[PubChem] Found compound: ${compound.iupacName} (CID: ${compound.cid})`);

        metadata.cid = compound.cid;
        metadata.iupacName = compound.iupacName;
        metadata.smiles = compound.smiles;

        // 3. Get all AIDs (limited to MAX_AIDS_PER_MOLECULE)
        const allAIDs = await getAIDs(compound.cid);
        if (allAIDs.length === 0) {
            console.log(`[PubChem] No AIDs found for CID ${compound.cid}`);
            await cacheResults(molecule, bioassayFilter, targetClass, maxResults, [], metadata);
            return [];
        }

        metadata.totalAIDsFound = allAIDs.length;

        // 4. Process AIDs in batches
        const records = [];
        const totalBatches = Math.ceil(allAIDs.length / CONFIG.AID_BATCH_SIZE);

        console.log(`[PubChem] Processing ${allAIDs.length} AIDs in ${totalBatches} batches of ${CONFIG.AID_BATCH_SIZE}...`);

        for (let i = 0; i < allAIDs.length; i += CONFIG.AID_BATCH_SIZE) {
            if (records.length >= maxResults) break;

            const batchNum = Math.floor(i / CONFIG.AID_BATCH_SIZE) + 1;
            const batch = allAIDs.slice(i, i + CONFIG.AID_BATCH_SIZE);

            console.log(`[PubChem] Batch ${batchNum}/${totalBatches}: Processing AIDs ${batch[0]}-${batch[batch.length - 1]}...`);

            // Get summaries for this batch
            const summaries = await getAssaySummaries(batch);

            if (summaries.length > 0) {
                const batchRecords = filterAssayRecords(
                    summaries,
                    compound.iupacName,
                    compound.cid,
                    compound.smiles,
                    compound.molecularWeight,
                    compound.molecularFormula,
                    bioassayFilter,
                    targetClass,
                    maxResults - records.length
                );
                records.push(...batchRecords);
                console.log(`[PubChem] Batch ${batchNum}: Found ${batchRecords.length} matching records (total: ${records.length})`);
            } else {
                console.log(`[PubChem] Batch ${batchNum}: No results`);
            }

            // Delay between batches to avoid rate limiting
            if (i + CONFIG.AID_BATCH_SIZE < allAIDs.length) {
                await sleep(CONFIG.INTER_REQUEST_DELAY);
            }
        }

        const duration = Date.now() - startTime;
        metadata.searchDuration = duration;

        // 5. Cache results for future requests
        await cacheResults(molecule, bioassayFilter, targetClass, maxResults, records, metadata);

        const totalDuration = ((Date.now() - globalStartTime) / 1000).toFixed(1);
        console.log(`[PubChem] ✓ Complete: Found ${records.length} results in ${totalDuration}s`);

        return records;

    } catch (error) {
        console.error(`[PubChem] ✗ Error: ${error.message}`);
        return [];
    }
}