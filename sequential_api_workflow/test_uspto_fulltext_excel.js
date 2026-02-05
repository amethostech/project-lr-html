import fetch from 'node-fetch';
import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';

const PATENTSVIEW_API_KEY = "gHnGYUVo.LvuL5K0YiHqVbDjB4biYicrzb8xiQmgi";

const PATENTSVIEW_URL = "https://search.patentsview.org/api/v1/patent/";
const FULLTEXT_BASE_URL = "https://developer.uspto.gov/ibd-api/v1/patent/grant/";

const HEADERS = {
    "X-Api-Key": PATENTSVIEW_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json"
};

const parser = new XMLParser({
    ignoreAttributes: false,
    textNodeName: "_text",
    trimValues: true,
    parseTagValue: false
});

// =============================
// UTILS
// =============================

/**
 * Recursively extracts all text from an object (produced by fast-xml-parser)
 */
function extractAllText(obj) {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number') return String(obj);
    if (Array.isArray(obj)) return obj.map(extractAllText).join(' ');
    if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).map(extractAllText).join(' ');
    }
    return '';
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =============================
// FETCH FULL TEXT (CLAIMS + DESCRIPTION)
// =============================
async function fetchFullText(patentId) {
    const url = `${FULLTEXT_BASE_URL}${patentId}`;

    try {
        const response = await fetch(url, {
            headers: { "Accept": "application/xml" },
            timeout: 30000
        });

        if (!response.ok) {
            return { claims: "", description: "", url };
        }

        const xmlContent = await response.text();
        const jsonObj = parser.parse(xmlContent);

        // Based on Python's //claims and //description
        // We look for these tags anywhere in the object
        // This is a simplified traversal for the expected structure
        const findTag = (obj, tag) => {
            if (obj && obj[tag]) return obj[tag];
            if (typeof obj === 'object' && obj !== null) {
                for (const key in obj) {
                    const found = findTag(obj[key], tag);
                    if (found) return found;
                }
            }
            return null;
        };

        const claimsObj = findTag(jsonObj, 'claims') || findTag(jsonObj, 'claim');
        const descObj = findTag(jsonObj, 'description');

        const claims = extractAllText(claimsObj).replace(/\s+/g, ' ').trim();
        const description = extractAllText(descObj).replace(/\s+/g, ' ').trim();

        return { claims, description, url };

    } catch (e) {
        console.error(` Full text error for ${patentId}:`, e.message);
        return { claims: "", description: "", url };
    }
}

// =============================
// SEARCH + FULL TEXT + EXCEL
// =============================
export async function searchUsptoFulltextExcel(keywords, year, page = 1, size = 5) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const query = {
        "q": {
            "_and": [
                { "_gte": { "patent_date": startDate } },
                { "_lte": { "patent_date": endDate } },
                {
                    "_or": [
                        { "_text_any": { "patent_title": keywords } },
                        { "_text_any": { "patent_abstract": keywords } },
                        { "_text_any": { "assignees.assignee_organization": keywords } }
                    ]
                }
            ]
        },
        "f": [
            "patent_id",
            "patent_title",
            "patent_date",
            "patent_abstract",
            "assignees.assignee_organization"
        ],
        "o": {
            "size": size,
            "page": page,
            "sort": [{ "patent_date": "desc" }]
        }
    };

    console.log("\n Searching USPTO patents...");
    const response = await fetch(PATENTSVIEW_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(query),
        timeout: 30000
    });

    if (!response.ok) {
        throw new Error(`PatentsView Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    const patents = data.patents || [];
    console.log(` Patents found: ${patents.length}`);

    const rows = [];

    for (let i = 0; i < patents.length; i++) {
        const p = patents[i];
        const patentId = p.patent_id;
        console.log(` Fetching full text ${i + 1}/${patents.length} → ${patentId}`);

        const { claims, description, url: fulltextUrl } = await fetchFullText(patentId);
        await sleep(600);

        rows.push({
            "Patent ID": patentId,
            "Title": p.patent_title,
            "Grant Date": p.patent_date,
            "Assignee": p.assignees?.[0]?.assignee_organization || null,
            "Abstract": p.patent_abstract,
            "Claims": claims,
            "Description": description,
            "USPTO Full Text API": fulltextUrl,
            "Google Patents URL": `https://patents.google.com/patent/US${patentId}`
        });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Patents');

    if (rows.length > 0) {
        worksheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key: key }));
        worksheet.addRows(rows);
    }

    const fileName = `USPTO_TEST_${keywords.replace(/ /g, '_')}_${year}.xlsx`;
    await workbook.xlsx.writeFile(fileName);

    return { fileName, rows };
}

// ==================================================
//  MANUAL TEST BLOCK
// ==================================================
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('test_uspto_fulltext_excel.js');

if (isMain) {
    (async () => {
        console.log(" Manual USPTO search test started");

        // 🔹 Change these values to test
        const TEST_KEYWORDS = "karuna therapeutics";
        const TEST_YEAR = 2024;

        try {
            const { fileName, rows } = await searchUsptoFulltextExcel(TEST_KEYWORDS, TEST_YEAR, 1, 5);

            console.log("\n TEST COMPLETED SUCCESSFULLY");
            console.log(" Rows fetched:", rows.length);
            console.log(" Excel file created:", fileName);
        } catch (error) {
            console.error(" TEST FAILED:", error.message);
        }
    })();
}
