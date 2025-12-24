import fetch from 'node-fetch';

function classifyAssay(assayType) {
    if (!assayType) return "Unknown";
    const type = assayType.toLowerCase();
    if (type.includes("screening")) return "Screening";
    if (type.includes("confirmatory")) return "Confirmatory";
    if (type.includes("summary")) return "Summary";
    return "Other";
}

/**
 * Fetch data from PubChem API
 * @param {string} molecule - Molecule name
 * @param {string} bioassayFilter - Filter for bioassay type
 * @param {string} targetClass - Filter for target class
 * @returns {Promise<Array>} - List of assay records (Limited to 100)
 */
export async function fetchPubchemData(molecule, bioassayFilter = "Any", targetClass = "") {
    try {
        const compoundUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(molecule)}/property/IUPACName,CanonicalSMILES/JSON`;

        let compoundRes = await fetch(compoundUrl);

        if (compoundRes.status === 404) return [];
        if (!compoundRes.ok) throw new Error(`PubChem compound fetch failed: ${compoundRes.statusText}`);

        const compoundData = await compoundRes.json();
        const properties = compoundData.PropertyTable?.Properties;

        if (!properties || properties.length === 0) return [];

        const compound = properties[0];
        const cid = compound.CID;
        const iupacName = compound.IUPACName;
        const smiles = compound.CanonicalSMILES;

        // 1. Fetch all AIDs
        const aidsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/aids/JSON`;
        const aidsRes = await fetch(aidsUrl);

        if (aidsRes.status === 404) return [];
        if (!aidsRes.ok) throw new Error(`PubChem AIDs fetch failed: ${aidsRes.statusText}`);

        const aidsData = await aidsRes.json();
        const fullAidsList = aidsData.InformationList?.Information?.[0]?.AID;

        if (!fullAidsList || fullAidsList.length === 0) return [];

        // --- HARD LIMIT: Only process the first 100 AIDs to prevent payload errors ---
        const LIMIT = 100;
        const aidsList = fullAidsList.slice(0, LIMIT);

        console.log(`[PubChem] Found ${fullAidsList.length} total. Processing first ${aidsList.length} for email...`);

        // 2. Fetch summaries for the limited list
        const aidsStr = aidsList.join(',');
        const summaryUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/assay/aid/${aidsStr}/summary/JSON`;
        const res = await fetch(summaryUrl);

        if (!res.ok) {
            console.warn(`[PubChem] Summary fetch failed. Status: ${res.status}`);
            return [];
        }

        const data = await res.json();
        const summaries = data.AssaySummaries?.AssaySummary || [];
        const records = [];

        for (const a of summaries) {
            const assayType = a.AssayType || "";
            const category = classifyAssay(assayType);

            // Filter by Bioassay Type
            if (bioassayFilter && bioassayFilter !== "Any" && category.toLowerCase() !== bioassayFilter.toLowerCase()) {
                continue;
            }

            // Filter by Target Class
            const target = a.TargetName || "";
            if (targetClass && !target.toLowerCase().includes(targetClass.toLowerCase())) {
                continue;
            }

            records.push({
                'Molecule Name': iupacName,
                'CID': cid,
                'SMILES': smiles,
                'AID': a.AID,
                'Assay Name': a.Name,
                'Assay Type': assayType,
                'Category': category,
                'Target Class': target,
                'Source': 'PubChem'
            });
        }

        return records;

    } catch (error) {
        console.error("Error fetching PubChem data:", error.message);
        return [];
    }
}