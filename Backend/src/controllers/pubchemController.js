import { format } from 'date-fns';
import User from '../models/User.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { generateExcelBuffer, appendToConsolidatedExcel } from '../services/excelService.js';
import { fetchPubchemData } from '../services/pubChemService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';
import path from 'path';

/**
 * Executes the PubChem search, generates the Excel, and sends the notification email.
 */
async function processPubChemSearchAsync(recipientEmail, molecule, bioassay, target_class) {
    const startTime = Date.now();
    const database = "PubChem";

    const searchDetailsHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Molecule:</td><td style="padding: 8px 0; color: #212529;">"${molecule}"</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Bioassay Filter:</td><td style="padding: 8px 0; color: #212529;">${bioassay}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Target Class:</td><td style="padding: 8px 0; color: #212529;">${target_class || 'All'}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Request Date:</td><td style="padding: 8px 0; color: #212529;">${format(new Date(), 'PPP')} at ${format(new Date(), 'p')}</td></tr>
        </table>
    `;

    try {
        console.log(`[BACKGROUND] Starting async PubChem search for ${recipientEmail}`);

        const results = await fetchPubchemData(molecule, bioassay, target_class);
        console.log(`[BACKGROUND] PubChem search returned: ${results.length} results`);

        // --- Handle No Results ---
        if (results.length === 0) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Search Completed - No Results Found</h2>
                    <p>Dear User,</p>
                    <p>Your PubChem search request has been completed. Unfortunately, no results were found for your criteria.</p>
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
                `[Search Results] No results found for PubChem`,
                htmlContent
            );

            console.log(`[BACKGROUND] ℹ️ No results email sent to ${recipientEmail}`);
            return;
        }

        // --- Handle Success with Results ---

        console.log(`[BACKGROUND] Generating Excel file for ${results.length} results...`);
        const excelBuffer = await generateExcelBuffer(results);
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);

        // Save to consolidated Excel file
        try {
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            const normalized = normalizeResultsForConsolidated(results, 'PubChem');
            await appendToConsolidatedExcel(consolidatedFile, normalized, 'PubChem');
            console.log(`✅ Consolidated Excel updated: PubChem (${normalized.length} records)`);
        } catch (excelError) {
            console.error(`⚠️ Warning: Failed to save to consolidated Excel: ${excelError.message}`);
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
        const filename = `${username}_PubChem_${dateStr}_${timeStr}.xlsx`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">Search Results Ready! 🎉</h2>
                <p>Dear User,</p>
                <p>Your PubChem search request has been completed successfully. The results are attached to this email as an Excel file.</p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin-top: 0;">Search Summary</h3>
                    ${searchDetailsHtml.replace(/495057/g, '155724').replace(/212529/g, '212529')}
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724; width: 30%;">Results Found:</td><td style="padding: 8px 0; color: #212529; font-size: 18px; font-weight: bold;">${results.length} items</td></tr>
                        <tr><td style="padding: 8px 0; font-weight: bold; color: #155724;">File Size:</td><td style="padding: 8px 0; color: #212529;">${excelSizeMB} MB</td></tr>
                    </table>
                </div>
                
                <p>Thank you for using our research service.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Anandi Technology</p>
            </div>
        `;

        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] Data from PubChem (${results.length} items)`,
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
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[BACKGROUND] Error for ${recipientEmail} after ${duration}s:`, error.message);

        const errorHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">Search Error - Request Failed</h2>
                <p>Dear User,</p>
                <p>We encountered an error while processing your PubChem search request.</p>
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
                `[Search Error] Failed to process your PubChem request`,
                errorHtml
            );
        } catch (emailError) {
            console.error('[BACKGROUND] ❌ Failed to send error notification:', emailError.message);
        }
    }
}

/**
 * Main controller for the PubChem search API endpoint.
 */
export const pubchemSearchController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        if (!recipientEmail) {
            return res.status(500).json({ error: 'Recipient email not found from token.' });
        }

        const { molecule, bioassay = "Any", target_class = "" } = req.body;

        if (!molecule) {
            return res.status(400).json({ error: 'Missing required parameter: molecule' });
        }

        console.log(`[API] PubChem Request from ${recipientEmail} for "${molecule}"`);

        setImmediate(() => {
            processPubChemSearchAsync(recipientEmail, molecule, bioassay, target_class).catch(err => {
                console.error('[API] Background error:', err);
            });
        });

        return res.status(202).json({
            success: true,
            message: `Search request received! Results will be emailed to ${recipientEmail} shortly.`,
            status: 'processing',
            database: 'PubChem',
            estimatedTime: '1-2 minutes'
        });

    } catch (error) {
        console.error("[API] Controller Error:", error.message);
        return res.status(500).json({
            error: 'Failed to process request',
            details: error.message
        });
    }
};
