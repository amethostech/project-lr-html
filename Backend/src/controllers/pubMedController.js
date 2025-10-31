// src/controllers/searchController.js
import { format } from 'date-fns';
import User from '../models/User.js'; // Assuming your model path is correct
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { generateExcelBuffer } from '../services/excelService.js';
import { searchPubMedUtil } from '../services/pubmedService.js';


// ==================== BACKGROUND ASYNC PROCESSING ====================

/**
 * Executes the search, generates the Excel, and sends the notification email.
 */
async function processSearchAsync(recipientEmail, from, to, query, database) {
    const startTime = Date.now();
    const formattedFrom = from ? format(new Date(from), 'PPP') : 'N/A';
    const formattedTo = to ? format(new Date(to), 'PPP') : 'N/A';
    
    // Normalize database name for display (capitalize first letter)
    const displayDatabase = database.charAt(0).toUpperCase() + database.slice(1).toLowerCase();
    
    const searchDetailsHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Keywords Searched:</td><td style="padding: 8px 0; color: #212529;">"${query}"</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Database:</td><td style="padding: 8px 0; color: #212529;">${displayDatabase}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Date Range:</td><td style="padding: 8px 0; color: #212529;">${formattedFrom} to ${formattedTo}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Request Date:</td><td style="padding: 8px 0; color: #212529;">${format(new Date(), 'PPP')} at ${format(new Date(), 'p')}</td></tr>
        </table>
    `;

    try {
        console.log(`[BACKGROUND] Starting async search for ${recipientEmail} on ${database}`);

        let searchData = { count: 0, results: [] };

        // Case-insensitive database switch
        switch (database.toLowerCase()) {
            case "pubmed":
                console.log(`[BACKGROUND] Calling searchPubMedUtil with query="${query}", from="${from}", to="${to}"`);
                searchData = await searchPubMedUtil(query, from, to); 
                console.log(`[BACKGROUND] searchPubMedUtil returned: count=${searchData.count}, results=${searchData.results?.length || 0}`);
                break;
            case "pubchem":
                throw new Error(`PubChem search is not yet implemented. Please use PubMed for now.`);
            default:
                throw new Error(`Search functionality for ${displayDatabase} is not supported. Available databases: PubMed`);
        }

        const { count, results } = searchData;

        // --- Handle No Results ---
        if (count === 0 || results.length === 0) {
            // ... (No results email logic - kept the same for brevity) ...
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
                `[Search Results] No results found for ${displayDatabase}`,
                htmlContent
            );

            console.log(`[BACKGROUND] ℹ️ No results email sent to ${recipientEmail}`);
            return;
        }

        // --- Handle Success with Results ---
        
        console.log(`[BACKGROUND] Generating Excel file for ${results.length} results...`);
        // Use imported excel service
        const excelBuffer = await generateExcelBuffer(results); 
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);
        
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
        const filename = `${username}_${displayDatabase}_${dateStr}_${timeStr}.xlsx`;
        
        // Success Email HTML (kept the same for brevity)
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">Search Results Ready! 🎉</h2>
                <p>Dear User,</p>
                <p>Your search request has been completed successfully. The results are attached to this email as an Excel file.</p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin-top: 0;">Search Summary</h3>
                    ${searchDetailsHtml.replace(/495057/g, '155724').replace(/212529/g, '212529')}
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724; width: 30%;">Results Found:</td><td style="padding: 8px 0; color: #212529; font-size: 18px; font-weight: bold;">${results.length} items</td></tr>
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724;">File Size:</td><td style="padding: 8px 0; color: #212529;">${excelSizeMB} MB</td></tr>
                    </table>
                </div>
                
                <p>Thank you for using our research service. If you need any assistance with the data or have questions about the results, please don't hesitate to contact us.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        // Use imported email service
        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] Data from ${displayDatabase} (${results.length} items)`,
            htmlContent,
            {
                content: excelBuffer,
                filename: filename,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[BACKGROUND] ✅ Search completed successfully for ${recipientEmail} in ${duration}s`);

    } catch (error) {
        // --- Handle Error Notification ---
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[BACKGROUND]  Error for ${recipientEmail} after ${duration}s:`, error.message);
        
        // Error email content (kept the same for brevity)
        const errorHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">Search Error - Request Failed</h2>
                <p>Dear User,</p>
                <p>We encountered an error while processing your search request. Please try again or contact support.</p>
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
            // Use imported email service
            await sendEmailWithSendGrid(
                recipientEmail,
                `[Search Error] Failed to process your request`,
                errorHtml
            );
            console.log(`[BACKGROUND] 📧 Error notification email sent to ${recipientEmail}`);
        } catch (emailError) {
            console.error('[BACKGROUND] ❌ Failed to send error notification:', emailError.message);
        }
    }
}


// ==================== MAIN API CONTROLLER ====================

/**
 * Main controller for the search API endpoint.
 * Responds immediately with 202 and delegates work to processSearchAsync.
 */
export const searchAPIController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        if (!recipientEmail) {
            return res.status(500).json({ error: 'Recipient email not found from token.' });
        }

        let { from, to, query, database } = req.body;

        if (!query || !database) {
            return res.status(400).json({ error: 'Missing required parameters: query, database' });
        }
        
        // Normalize database name (convert to lowercase for consistency)
        database = database.toLowerCase();
        
        // Optional date validation (only if provided)
        if (from && isNaN(Date.parse(from))) {
            return res.status(400).json({ error: 'Invalid date format for "from" parameter' });
        }
        if (to && isNaN(Date.parse(to))) {
            return res.status(400).json({ error: 'Invalid date format for "to" parameter' });
        }

        console.log(`[API] Request from ${recipientEmail} for "${query}" on ${database}`);

        // Execute search in the background to prevent client timeout
        setImmediate(() => {
            processSearchAsync(recipientEmail, from || null, to || null, query, database).catch(err => {
                console.error('[API] Background error:', err);
            });
        });

        // Respond immediately with 202 Accepted
        const displayDatabase = database.charAt(0).toUpperCase() + database.slice(1);
        return res.status(202).json({
            success: true,
            message: `Search request received! Results will be emailed to ${recipientEmail} shortly.`,
            status: 'processing',
            database: displayDatabase,
            estimatedTime: '1-2 minutes'
        });

    } catch (error) {
        console.error("[API]  Controller Error:", error.message);
        return res.status(500).json({
            error: 'Failed to process request',
            details: error.message
        });
    }
};