import { format } from 'date-fns';
import User from '../models/User.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { generateExcelBuffer, appendToConsolidatedExcel } from '../services/excelService.js';
import { searchPubMedUtil } from '../services/pubmedService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';
import path from 'path';

/**
 * Executes the search, generates the Excel, and sends the notification email in the background.
 * This is only called when an email is provided.
 */
async function processSearchAsync(recipientEmail, from, to, query, maxResults = 100) {
    const startTime = Date.now();
    const formattedFrom = from ? format(new Date(from), 'PPP') : 'N/A';
    const formattedTo = to ? format(new Date(to), 'PPP') : 'N/A';

    const searchDetailsHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Keywords Searched:</td><td style="padding: 8px 0; color: #212529;">"${query}"</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Database:</td><td style="padding: 8px 0; color: #212529;">PubMed</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Date Range:</td><td style="padding: 8px 0; color: #212529;">${formattedFrom} to ${formattedTo}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Request Date:</td><td style="padding: 8px 0; color: #212529;">${format(new Date(), 'PPP')} at ${format(new Date(), 'p')}</td></tr>
        </table>
    `;

    try {
        console.log(`[BACKGROUND] Starting async PubMed search for ${recipientEmail}`);

        const searchData = await searchPubMedUtil(query, from, to, maxResults);
        const { count, results } = searchData;

        // --- Handle No Results ---
        if (count === 0 || results.length === 0) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Search Completed - No Results Found</h2>
                    <p>Dear User,</p>
                    <p>Your search request has been completed. Unfortunately, no results were found for your search criteria.</p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                        <h3 style="color: #495057; margin-top: 0;">Search Details</h3>
                        ${searchDetailsHtml}
                    </div>
                    <p>Thank you for using our research service.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">Anandi Technology</p>
                </div>
            `;

            await sendEmailWithSendGrid(
                recipientEmail,
                `[Search Results] No results found for PubMed`,
                htmlContent
            );

            console.log(`[BACKGROUND] ℹ️ No results email sent to ${recipientEmail}`);
            return;
        }

        console.log(`[BACKGROUND] Generating Excel file for ${results.length} results...`);
        const excelBuffer = await generateExcelBuffer(results);
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);

        // Save to consolidated Excel file
        try {
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            const normalized = normalizeResultsForConsolidated(results, 'PubMed');
            await appendToConsolidatedExcel(consolidatedFile, normalized, 'PubMed');
            console.log(`Consolidated Excel updated: PubMed (${normalized.length} records)`);
        } catch (excelError) {
            console.error(`Warning: Failed to save to consolidated Excel: ${excelError.message}`);
        }

        // Fetch user name for file naming
        let username = 'UnknownUser';
        try {
            const user = await User.findOne({ email: recipientEmail }).select('name');
            username = user ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : 'UnknownUser';
        } catch (userError) {
            console.log('[BACKGROUND] Could not fetch user name, using default');
        }

        const currentDate = new Date();
        const dateStr = currentDate.toISOString().split('T')[0];
        const timeStr = currentDate.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `${username}_PubMed_${dateStr}_${timeStr}.xlsx`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">Search Results Ready! 🎉</h2>
                <p>Dear User,</p>
                <p>Your search request has been completed successfully. The results are attached to this email as an Excel file.</p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin-top: 0;">Search Summary</h3>
                    ${searchDetailsHtml}
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724; width: 30%;">Results Found:</td><td style="padding: 8px 0; color: #212529; font-size: 18px; font-weight: bold;">${results.length} items</td></tr>
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724;">File Size:</td><td style="padding: 8px 0; color: #212529;">${excelSizeMB} MB</td></tr>
                    </table>
                </div>
                
                <p>Thank you for being part of our research service.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] Data from PubMed (${results.length} items)`,
            htmlContent,
            {
                content: excelBuffer,
                filename: filename,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[BACKGROUND] PubMed search completed successfully for ${recipientEmail} in ${duration}s`);

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[BACKGROUND] PubMed Error for ${recipientEmail} after ${duration}s:`, error.message);

        const errorHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">Search Error - Request Failed</h2>
                <p>Dear User,</p>
                <p>We encountered an error while processing your search request.</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                    <h3 style="color: #495057; margin-top: 0;">Search Request Details</h3>
                    ${searchDetailsHtml}
                </div>
                <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #d9534f; margin: 20px 0;">
                    <h4 style="color: #721c24; margin-top: 0;">Error Message:</h4>
                    <p style="margin: 5px 0; color: #721c24;">${error.message}</p>
                </div>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        try {
            await sendEmailWithSendGrid(recipientEmail, `[Search Error] Failed to process PubMed request`, errorHtml);
        } catch (emailError) {
            console.error('[BACKGROUND]  Failed to send error notification:', emailError.message);
        }
    }
}


// ==================== MAIN API CONTROLLER ====================

/**
 * Main controller for the PubMed search API endpoint.
 * Handles both:
 * 1. Authenticated Search (with email) -> returns results + sends email in background
 * 2. Guest Search (no email) -> returns results only
 */
export const searchAPIController = async (req, res) => {
    try {
        // Support email from JWT (userEmail) or body (email)
        const recipientEmail = req.userEmail || req.body.email || null;

        let { from, to, dateFrom, dateTo, query, database, maxResults, operator } = req.body;

        // Support both 'from'/'to' and 'dateFrom'/'dateTo' from different frontends
        // Convert YYYY-MM-DD to YYYY/MM/DD format for NCBI EUtils
        const formatDate = (d) => d ? d.replace(/-/g, '/') : null;
        from = formatDate(from || dateFrom);
        to = formatDate(to || dateTo);

        // Ensure we are only handling PubMed
        if (database && database.toLowerCase() !== 'pubmed') {
            return res.status(400).json({ error: 'This controller only supports PubMed searches.' });
        }

        if (!query) {
            return res.status(400).json({ error: 'Missing required parameter: query' });
        }

        console.log(`[API] PubMed Request for "${query}" with operator ${operator || 'OR'}${recipientEmail ? ` from ${recipientEmail}` : ' (GUEST)'}`);

        const parsedMax = parseInt(maxResults || 100, 10);
        const validMaxResults = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100;

        // Process keywords (Commas -> select logic for PubMed)
        const keywords = query.split(',').map(k => k.trim()).filter(k => k.length > 0);
        let pubmedQuery = query;
        if (keywords.length > 1) {
            const joinOp = (operator && operator.toUpperCase() === 'AND') ? ' AND ' : ' OR ';
            pubmedQuery = keywords.map(k => `(${k})`).join(joinOp);
        }

        // Execute search
        const searchData = await searchPubMedUtil(pubmedQuery, from || null, to || null, validMaxResults);

        // Map results to standard format for frontend
        const formattedResults = searchData.results.map(article => ({
            id: article['DOI/PMID'] || article.id || '',
            title: article['Title'] || article.title || '',
            authors: article['Authors'] || article.authors || '',
            abstract: article['Abstract'] || article.abstract || '',
            year: article['Publication Year'] || article.year || '',
            source: 'PubMed',
            searchTerm: article['Search Term'] || query
        }));

        // If email is provided, trigger background processing (Excel + Email)
        if (recipientEmail) {
            setImmediate(() => {
                processSearchAsync(recipientEmail, from || null, to || null, pubmedQuery, validMaxResults).catch(err => {
                    console.error('[API] Background task error:', err);
                });
            });
        }

        return res.status(200).json({
            success: true,
            count: searchData.count,
            results: formattedResults,
            message: recipientEmail
                ? `Found ${searchData.count} results. They will also be emailed to ${recipientEmail} shortly.`
                : `Found ${searchData.count} results.`,
            database: 'PubMed'
        });

    } catch (error) {
        console.error("[API] PubMed Controller Error:", error.message);
        return res.status(500).json({
            error: 'Failed to process PubMed request',
            details: error.message
        });
    }
};