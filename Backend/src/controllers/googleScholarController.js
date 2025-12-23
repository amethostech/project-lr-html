import { GoogleSearch } from 'google-search-results-nodejs';
import User from '../models/User.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { generateExcelBuffer, appendToConsolidatedExcel } from '../services/excelService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';
import { SERP_API_KEY } from '../utils/constants.js';
import path from 'path';

// Helper: perform the Google Scholar search and return formatted results
async function performGoogleScholarSearch(query, maxResults = 10, dbParams = {}) {
    if (!SERP_API_KEY) {
        throw new Error('SERPAPI_API_KEY is not configured on the server.');
    }

    const search = new GoogleSearch(SERP_API_KEY);
    const scholarParams = dbParams['google_scholar'] || {};
    const numResults = parseInt(maxResults) || 10; // Note: SerpAPI may still cap to ~20

    const params = {
        engine: 'google_scholar',
        q: query,
        num: numResults,
        ...(scholarParams.as_ylo && { as_ylo: scholarParams.as_ylo }),
        ...(scholarParams.as_yhi && { as_yhi: scholarParams.as_yhi }),
        ...(scholarParams.as_sdt && { as_sdt: scholarParams.as_sdt.split(' ')[0] }),
    };

    const result = await new Promise((resolve, reject) => {
        search.json(params, (json) => {
            if (json.error) return reject(new Error(json.error));
            resolve(json);
        });
    });

    const organic = result.organic_results || [];
    const formattedResults = organic.map(item => ({
        Title: item.title,
        Authors: item.publication_info?.authors?.map(a => a.name).join(', ') || 'N/A',
        PublicationYear: item.publication_info?.summary?.match(/(\d{4})/)?.[1] || 'N/A',
        Abstract: item.snippet || 'N/A',
        DOI_PMID: (item.resources?.[0]?.link?.includes('doi.org')) 
            ? item.resources[0].link.split('doi.org/')[1] 
            : 'N/A',
        Source: 'Google Scholar',
        MeSH_Major_1: 'N/A',
    }));

    const count = result.search_information?.total_results 
        ? parseInt(result.search_information.total_results, 10) 
        : formattedResults.length;

    return { count, results: formattedResults };
}

// Background processing: performs search, generates Excel, sends email
async function processScholarSearchAsync(recipientEmail, query, maxResults, dbParams) {
    const startTime = Date.now();
    const displayDatabase = 'Google Scholar';

    const searchDetailsHtml = `
        <table style="width:100%; border-collapse:collapse;">
            <tr><td style="padding:6px 0; font-weight:bold; width:30%;">Keywords Searched:</td><td style="padding:6px 0;">"${query}"</td></tr>
            <tr><td style="padding:6px 0; font-weight:bold;">Database:</td><td style="padding:6px 0;">${displayDatabase}</td></tr>
            <tr><td style="padding:6px 0; font-weight:bold;">Request Date:</td><td style="padding:6px 0;">${new Date().toISOString()}</td></tr>
        </table>
    `;

    try {
        console.log(`[Scholar] Processing search for ${recipientEmail}: "${query}"`);

        const { count, results } = await performGoogleScholarSearch(query, maxResults, dbParams);
        console.log(`[Scholar] Found ${results.length} results`);

        // Handle no results case
        if (!count || results.length === 0) {
            const htmlContent = `
                <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;">
                    <h2 style="color:#333;">Search Completed - No Results Found</h2>
                    <p>Your search request has been completed. Unfortunately, no results were found for your search criteria.</p>
                    <div style="background:#f8f9fa; padding:15px; border-radius:6px;">${searchDetailsHtml}</div>
                    <p>Thank you.</p>
                </div>
            `;
            
            await sendEmailWithSendGrid(
                recipientEmail, 
                `[Search Results] No results found for ${displayDatabase}`, 
                htmlContent
            );
            
            console.log(`[Scholar] No-results email sent to ${recipientEmail}`);
            return;
        }

        // Generate Excel file
        console.log(`[Scholar] Generating Excel file...`);
        const excelBuffer = await generateExcelBuffer(results);
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);

        // Save to consolidated Excel file (normalized for readability)
        try {
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            const normalized = normalizeResultsForConsolidated(results, 'Google Scholar');
            await appendToConsolidatedExcel(consolidatedFile, normalized, 'Google Scholar');
            console.log(`✅ Consolidated Excel updated: Google Scholar (${normalized.length} records)`);
        } catch (excelError) {
            console.error(`⚠️ Warning: Failed to save to consolidated Excel: ${excelError.message}`);
            // Continue even if consolidated Excel save fails
        }

        // Fetch username for filename
        let username = 'User';
        try {
            const user = await User.findOne({ email: recipientEmail }).select('name');
            username = user ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : 'User';
        } catch (error) {
            console.log('[Scholar] Could not fetch username, using default');
        }

        // Generate filename
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `${username}_GoogleScholar_${dateStr}_${timeStr}.xlsx`;

        // Prepare and send email with attachment
        const htmlContent = `
            <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;">
                <h2 style="color:#28a745;">Your Google Scholar Search Results Are Ready</h2>
                <p>The results are attached as an Excel file.</p>
                <div style="background:#d4edda; padding:15px; border-radius:6px;">
                    ${searchDetailsHtml}
                    <p><strong>Results Found:</strong> ${results.length}</p>
                    <p><strong>File Size:</strong> ${excelSizeMB} MB</p>
                </div>
                <p>Thank you for using our service.</p>
            </div>
        `;

        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] Google Scholar (${results.length} items)`,
            htmlContent,
            {
                content: excelBuffer,
                filename,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[Scholar] Email sent successfully to ${recipientEmail} in ${duration}s`);

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[Scholar]  Error for ${recipientEmail} after ${duration}s:`, error.message);

        // Send error notification email
        const errorHtml = `
            <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;">
                <h2 style="color:#d9534f;">Search Error</h2>
                <p>We encountered an error while processing your Google Scholar search.</p>
                <div style="background:#f8f9fa; padding:15px; border-radius:6px;">${searchDetailsHtml}</div>
                <div style="background:#f8d7da; padding:10px; border-radius:4px; margin-top:10px;">
                    <strong>Error:</strong> ${error.message}
                </div>
                <p style="margin-top:15px;">Please try again or contact support if the issue persists.</p>
            </div>
        `;

        try {
            await sendEmailWithSendGrid(
                recipientEmail, 
                `[Search Error] Google Scholar request failed`, 
                errorHtml
            );
            console.log(`[Scholar] Error notification sent to ${recipientEmail}`);
        } catch (emailError) {
            console.error('[Scholar] Failed to send error notification:', emailError.message);
        }
    }
}

// Main API endpoint: accepts search request and processes in background
export const searchGoogleScholar = async (req, res) => {
    const { query, maxResults, dbParams } = req.body;

    if (!query) {
        return res.status(400).json({ 
            status: 'error', 
            error: 'Query term is required.' 
        });
    }

    const recipientEmail = req.userEmail;
    if (!recipientEmail) {
        return res.status(500).json({ 
            status: 'error', 
            error: 'User email not found. Please log in again.' 
        });
    }

    try {
        console.log(`[Scholar] Request from ${recipientEmail}: "${query}"`);
        
        // Perform search synchronously to return results to frontend
        const { count, results } = await performGoogleScholarSearch(query, maxResults || 10, dbParams || {});
        console.log(`[Scholar] Found ${results.length} results`);

        // Send email in background (non-blocking)
        setImmediate(() => {
            processScholarSearchAsync(
                recipientEmail, 
                query, 
                maxResults || 10, 
                dbParams || {}
            ).catch(err => {
                console.error('[Scholar] Background email error:', err.message);
            });
        });

        // Return results immediately to frontend
        return res.status(200).json({
            status: 'success',
            count: count || results.length,
            results: results || [],
            message: `Found ${count || results.length} results. Results will also be emailed to ${recipientEmail} shortly.`,
            recipientEmail: recipientEmail
        });

    } catch (error) {
        console.error("[Scholar] Controller error:", error.message);
        return res.status(500).json({
            status: 'error',
            error: `Failed to process request: ${error.message}`
        });
    }
};

export const searchGoogleScholarAPIController = searchGoogleScholar;