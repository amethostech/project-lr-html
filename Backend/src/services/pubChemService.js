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
 * @returns {Promise<Array>} - List of assay records
 */
export async function fetchPubchemData(molecule, bioassayFilter = "Any", targetClass = "") {
    try {
        const compoundUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(molecule)}/property/IUPACName,CanonicalSMILES/JSON`;

        let compoundRes = await fetch(compoundUrl);

        if (compoundRes.status === 404) {
            return [];
        }

        if (!compoundRes.ok) {
            throw new Error(`PubChem compound fetch failed: ${compoundRes.statusText}`);
        }

        const compoundData = await compoundRes.json();
        const properties = compoundData.PropertyTable?.Properties;

        if (!properties || properties.length === 0) return [];

        const compound = properties[0];
        const cid = compound.CID;
        const iupacName = compound.IUPACName;
        const smiles = compound.CanonicalSMILES;

        const assayUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/assaysummary/JSON`;

        let assayRes = await fetch(assayUrl);

        if (assayRes.status === 404) {
            return [];
        }

        if (!assayRes.ok) {
            return [];
        }

        const assayData = await assayRes.json();
        if (!assayData || !assayData.AssaySummaries || !assayData.AssaySummaries.AssaySummary) {
            return [];
        }

        const assays = assayData.AssaySummaries.AssaySummary;
        const records = [];

        for (const a of assays) {
            const assayType = a.AssayType || "";
            const category = classifyAssay(assayType);

            if (bioassayFilter && bioassayFilter !== "Any" && category.toLowerCase() !== bioassayFilter.toLowerCase()) {
                continue;
            }

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
