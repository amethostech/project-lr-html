import fetch from 'node-fetch';
import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import { format } from 'date-fns';
import path from 'path';
import https from 'https';
import User from '../models/User.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { appendToConsolidatedExcel, generateExcelBuffer } from '../services/excelService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';

// =========================================================================
// NEW USPTO CONTROLLER LOGIC (Based on test_uspto_fulltext_excel.js)
// =========================================================================

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

/**
 * Fetch full text (claims + description) from USPTO IBD API
 */
async function fetchFullText(patentId) {
    const url = `${FULLTEXT_BASE_URL}${patentId}`;
    try {
        const response = await fetch(url, {
            headers: { "Accept": "application/xml" },
            timeout: 30000
        });

        if (!response.ok) return { claims: "", description: "", url };

        const xmlContent = await response.text();
        const jsonObj = parser.parse(xmlContent);

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

/**
 * Background processing: generates Excel and emails results to user
 */
async function processUsptoSearchAsync(recipientEmail, keywords, year, results) {
    const startTime = Date.now();
    try {
        console.log(`[USPTO] Background processing for ${recipientEmail}`);

        // Generate Excel file
        const excelBuffer = await generateExcelBuffer(results);

        // Save to consolidated Excel
        try {
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            const normalized = normalizeResultsForConsolidated(results, 'USPTO');
            await appendToConsolidatedExcel(consolidatedFile, normalized, 'USPTO');
            console.log(`✅ Consolidated Excel updated: USPTO (${normalized.length} records)`);
        } catch (err) {
            console.error(`⚠️ Consolidated Excel Error:`, err.message);
        }

        // Fetch user info for naming
        let username = 'User';
        try {
            const user = await User.findOne({ email: recipientEmail }).select('name');
            username = user ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : 'User';
        } catch (error) { }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `${username}_USPTO_${dateStr}_${timeStr}.xlsx`;

        // Success Email HTML
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">USPTO Search Results Ready! 🎉</h2>
                <p>Keywords: "${keywords}"</p>
                <p>Date Range Year: ${year}</p>
                <p>Found ${results.length} results.</p>
                <p>The results are attached to this email as an Excel file.</p>
                <hr>
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] USPTO Patents (${results.length} items)`,
            htmlContent,
            {
                content: excelBuffer,
                filename: filename,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );
        console.log(`[USPTO] ✅ Email sent successfully to ${recipientEmail}`);
    } catch (error) {
        console.error(`[USPTO] Background Error:`, error.message);
    }
}

/**
 * Main Controller for USPTO Search
 */
export const searchUsptoController = async (req, res) => {
    try {
        // Support email from JWT (userEmail) or body (email)
        const recipientEmail = req.userEmail || req.body.email || null;
        const { keywords, year = 2024, page = 1, size = 10 } = req.body;

        // Keywords validation
        const queryKeywords = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        if (!queryKeywords || queryKeywords.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide search keywords' });
        }

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Build PatentsView Query
        const queryPayload = {
            "q": {
                "_and": [
                    { "_gte": { "patent_date": startDate } },
                    { "_lte": { "patent_date": endDate } },
                    {
                        "_or": [
                            { "_text_any": { "patent_title": queryKeywords } },
                            { "_text_any": { "patent_abstract": queryKeywords } },
                            { "_text_any": { "assignees.assignee_organization": queryKeywords } }
                        ]
                    }
                ]
            },
            "f": ["patent_id", "patent_title", "patent_date", "patent_abstract", "assignees.assignee_organization"],
            "o": {
                "size": Math.min(parseInt(size) || 10, 100),
                "page": parseInt(page) || 1,
                "sort": [{ "patent_date": "desc" }]
            }
        };

        console.log(`[USPTO] Running Search API Controller for: "${queryKeywords}" in ${year}`);

        const response = await fetch(PATENTSVIEW_URL, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(queryPayload),
            timeout: 30000
        });

        if (!response.ok) throw new Error(`PatentsView Search failed: ${response.statusText}`);

        const data = await response.json();
        const patents = data.patents || [];
        const total = data.total_patent_count || patents.length;

        console.log(`[USPTO] Found ${patents.length} patents, starting full-text extraction...`);

        const formattedResults = [];
        for (let i = 0; i < patents.length; i++) {
            const p = patents[i];
            const patentId = p.patent_id;

            console.log(`[USPTO] Fetching full text ${i + 1}/${patents.length} → ${patentId}`);

            // Try to fetch claims and description
            const { claims, description, url: fulltextUrl } = await fetchFullText(patentId);

            // Wait slightly between requests to avoid USPTO rate limits
            if (patents.length > 1 && i < patents.length - 1) {
                await sleep(600);
            }

            formattedResults.push({
                id: patentId,
                patent_id: patentId,
                title: p.patent_title,
                patent_title: p.patent_title,
                date: p.patent_date,
                patent_date: p.patent_date,
                abstract: p.patent_abstract || 'No abstract available',
                patent_abstract: p.patent_abstract || 'No abstract available',
                assignee: p.assignees?.[0]?.assignee_organization || 'N/A',
                claims: claims,
                description: description,
                fulltext_url: fulltextUrl,
                google_patents_url: `https://patents.google.com/patent/US${patentId}`,
                source: 'USPTO'
            });
        }

        // Trigger background email if email is available
        if (recipientEmail) {
            setImmediate(() => {
                processUsptoSearchAsync(recipientEmail, queryKeywords, year, formattedResults).catch(err => {
                    console.error('[USPTO] Background task error:', err.message);
                });
            });
        }

        return res.status(200).json({
            success: true,
            results: formattedResults,
            total: total,
            count: formattedResults.length,
            message: recipientEmail
                ? `Found ${total} USPTO patents. Results will also be emailed to ${recipientEmail} shortly.`
                : `Found ${total} USPTO patents.`,
            database: 'USPTO'
        });

    } catch (error) {
        console.error('[USPTO Controller] Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to process USPTO search request',
            details: error.message
        });
    }
};

/**
 * Get available searchable fields from USPTO API
 * (This is a utility endpoint used by the frontend)
 */
export const getUsptoFieldsController = async (req, res) => {
    try {
        const BASE_URL = "https://developer.uspto.gov/ds-api";
        const DATASET = "enriched_cited_reference_metadata";
        const VERSION = "v3";
        const url = `${BASE_URL}/${DATASET}/${VERSION}/fields`;

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        const response = await fetch(url, {
            method: 'GET',
            headers: { "Accept": "application/json" },
            // @ts-ignore
            agent: httpsAgent
        });

        if (response.status === 200) {
            const data = await response.json();
            return res.status(200).json({
                success: true,
                data: data
            });
        } else {
            return res.status(response.status).json({
                success: false,
                error: `API Error ${response.status}`
            });
        }
    } catch (error) {
        console.error('[USPTO Fields Controller] Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch fields',
            details: error.message
        });
    }
};

// =========================================================================
// OLD VERSION (COMMENTED OUT FOR SAFETY)
// =========================================================================

/*
import { searchUsptoDsapi } from '../services/usptoService.js';
... 

export const searchUsptoController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        ...
        const result = await searchUsptoDsapi(filteredKeywords, validOperator, validLimit);
        ...
        return res.status(200).json({
            success: true,
            results: formattedResults,
            ...
        });
    } catch (error) {
        ...
    }
};
*/
