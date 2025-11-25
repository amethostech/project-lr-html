import { searchUsptoDsapi } from '../services/usptoService.js';
import { appendToExcelFile, appendToConsolidatedExcel, generateExcelBuffer } from '../services/excelService.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import User from '../models/User.js';
import path from 'path';
import fetch from 'node-fetch';
import https from 'https';

/**
 * Background processing: performs USPTO search, generates Excel, sends email
 */
async function processUsptoSearchAsync(recipientEmail, keywords, operator, limit) {
    const startTime = Date.now();
    const displayDatabase = 'USPTO Patents';
    const queryString = keywords.join(` ${operator} `);
    
    const searchDetailsHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Keywords Searched:</td><td style="padding: 8px 0; color: #212529;">"${queryString}"</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Database:</td><td style="padding: 8px 0; color: #212529;">${displayDatabase}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Operator:</td><td style="padding: 8px 0; color: #212529;">${operator}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Request Date:</td><td style="padding: 8px 0; color: #212529;">${new Date().toLocaleString()}</td></tr>
        </table>
    `;

    try {
        console.log(`[USPTO] Processing search for ${recipientEmail}: "${queryString}"`);

        // Perform search
        const result = await searchUsptoDsapi(keywords, operator, limit);

        // Check for errors
        if (result.error) {
            throw new Error(result.error);
        }

        const { results, total, shown } = result;

        // Handle no results case
        if (!results || results.length === 0) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Search Completed - No Results Found</h2>
                    <p>Dear User,</p>
                    <p>Your USPTO patent search request has been completed. Unfortunately, no results were found for your search criteria.</p>
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
                `[Search Results] No results found for ${displayDatabase}`,
                htmlContent
            );

            console.log(`[USPTO] ℹ️ No results email sent to ${recipientEmail}`);
            return;
        }

        // Generate Excel file
        console.log(`[USPTO] Generating Excel file for ${results.length} results...`);
        const excelBuffer = await generateExcelBuffer(results);
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);

        // Save to Excel files (both individual and consolidated)
        try {
            // Save to individual USPTO file
            const individualFile = path.resolve('uspto_responses.xlsx');
            await appendToExcelFile(individualFile, results, 'uspto responses');
            
            // Also save to consolidated file
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            await appendToConsolidatedExcel(consolidatedFile, results, 'USPTO');
            
            console.log(`✅ Excel files updated: uspto_responses.xlsx and consolidated_search_results.xlsx (added ${results.length} records)`);
        } catch (excelError) {
            console.error(`⚠️ Warning: Failed to save Excel file: ${excelError.message}`);
            // Continue even if Excel save fails - still send email
        }

        // Fetch username for filename
        let username = 'User';
        try {
            const user = await User.findOne({ email: recipientEmail }).select('name');
            username = user ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : 'User';
        } catch (error) {
            console.log('[USPTO] Could not fetch username, using default');
        }

        // Generate filename
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `${username}_USPTO_${dateStr}_${timeStr}.xlsx`;

        // Success Email HTML
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">Search Results Ready! 🎉</h2>
                <p>Dear User,</p>
                <p>Your USPTO patent search request has been completed successfully. The results are attached to this email as an Excel file.</p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin-top: 0;">Search Summary</h3>
                    ${searchDetailsHtml}
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724; width: 30%;">Results Found:</td><td style="padding: 8px 0; color: #212529; font-size: 18px; font-weight: bold;">${total || results.length} total (${shown || results.length} shown)</td></tr>
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724;">File Size:</td><td style="padding: 8px 0; color: #212529;">${excelSizeMB} MB</td></tr>
                    </table>
                </div>
                
                <p>Thank you for using our research service. If you need any assistance with the data or have questions about the results, please don't hesitate to contact us.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        // Send email with attachment
        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] USPTO Patents (${total || results.length} results)`,
            htmlContent,
            {
                content: excelBuffer,
                filename: filename,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[USPTO] ✅ Search completed successfully for ${recipientEmail} in ${duration}s`);

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[USPTO] Error for ${recipientEmail} after ${duration}s:`, error.message);

        // Error email content
        const errorHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">Search Error - Request Failed</h2>
                <p>Dear User,</p>
                <p>We encountered an error while processing your USPTO patent search request. Please try again or contact support.</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                    <h3 style="color: #495057; margin-top: 0;">Search Request Details</h3>
                    ${searchDetailsHtml}
                </div>
                <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #d9534f; margin: 20px 0;">
                    <h4 style="color: #721c24; margin-top: 0;">Error Message:</h4>
                    <p style="margin: 5px 0; color: #721c24;">${error.message}</p>
                </div>
                <p>Thank you for your patience.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        try {
            await sendEmailWithSendGrid(
                recipientEmail,
                `[Search Error] USPTO Patents request failed`,
                errorHtml
            );
            console.log(`[USPTO] 📧 Error notification email sent to ${recipientEmail}`);
        } catch (emailError) {
            console.error('[USPTO] ❌ Failed to send error notification:', emailError.message);
        }
    }
}

/**
 * Controller for USPTO search endpoint.
 * Searches USPTO API, saves results to Excel, and emails results to user.
 */
export const searchUsptoController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        if (!recipientEmail) {
            return res.status(500).json({
                success: false,
                error: 'Recipient email not found from token.',
                results: [],
                total: 0
            });
        }

        const { keywords, operator = 'AND', limit = 500 } = req.body;

        // Validate keywords
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide at least one keyword',
                results: [],
                total: 0
            });
        }

        // Filter out empty keywords
        const filteredKeywords = keywords
            .map(kw => String(kw).trim())
            .filter(kw => kw.length > 0);

        if (filteredKeywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide at least one valid keyword',
                results: [],
                total: 0
            });
        }

        // Validate operator
        const validOperator = operator.toUpperCase() === 'OR' ? 'OR' : 'AND';

        // Validate limit
        const validLimit = Math.min(Math.max(parseInt(limit) || 500, 1), 10000);

        console.log(`[USPTO] Request from ${recipientEmail} for: "${filteredKeywords.join(', ')}" with operator: ${validOperator}, limit: ${validLimit}`);

        // Process search in background and respond immediately
        setImmediate(() => {
            processUsptoSearchAsync(recipientEmail, filteredKeywords, validOperator, validLimit).catch(err => {
                console.error('[USPTO] Background process error:', err.message);
            });
        });

        // Respond immediately with 202 Accepted
        return res.status(202).json({
            success: true,
            message: `Search request received! Results will be emailed to ${recipientEmail} shortly.`,
            status: 'processing',
            database: 'USPTO Patents',
            estimatedTime: '1-3 minutes',
            recipientEmail: recipientEmail
        });

    } catch (error) {
        console.error('[USPTO Controller] Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to process search request',
            details: error.message,
            results: [],
            total: 0
        });
    }
};

/**
 * Get available searchable fields from USPTO API
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
            // @ts-ignore - node-fetch v3 supports agent
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

