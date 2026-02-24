import { format } from 'date-fns';
import User from '../models/User.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { generateExcelBuffer, appendToConsolidatedExcel } from '../services/excelService.js';
import { fetchPubchemData, fetchMechanismOfAction } from '../services/pubChemService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';
import { clearCache, getCacheStats } from '../services/pubChemCacheService.js';
import path from 'path';

async function processPubChemSearchAsync(recipientEmail, molecule, bioassay, target_class, maxResults) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    console.log(`[${requestId}] PubChem search starting: ${molecule} (max ${maxResults} results)`);

    const searchDetailsHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Molecule:</td><td style="padding: 8px 0; color: #212529;">"${molecule}"</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Bioassay Filter:</td><td style="padding: 8px 0; color: #212529;">${bioassay}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Target Class:</td><td style="padding: 8px 0; color: #212529;">${target_class || 'All'}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Request Date:</td><td style="padding: 8px 0; color: #212529;">${format(new Date(), 'PPP')} at ${format(new Date(), 'p')}</td></tr>
        </table>
    `;

    try {
        console.log(`[${requestId}] Fetching PubChem data...`);
        const results = await fetchPubchemData(molecule, bioassay, target_class, maxResults);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (results.length === 0) {
            console.log(`[${requestId}] No results found (${duration}s)`);
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Search Completed - No Results Found</h2>
                    <p>Dear User,</p>
                    <p>Your search for <strong>${molecule}</strong> yielded no results based on the filters provided.</p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                        ${searchDetailsHtml}
                    </div>
                </div>
            `;
            await sendEmailWithSendGrid(recipientEmail, `[Search Results] No results for PubChem`, htmlContent);
            return;
        }

        // Fetch mechanism of action and enrich results
        console.log(`[${requestId}] Fetching mechanism of action...`);
        let mechanismData = null;
        try {
            const mechanismResult = await fetchMechanismOfAction(molecule);
            if (mechanismResult.success && mechanismResult.mechanismOfAction) {
                mechanismData = mechanismResult.mechanismOfAction;
                console.log(`[${requestId}] ✓ Found mechanism of action`);
            } else {
                console.log(`[${requestId}] → No mechanism of action found`);
            }
        } catch (e) {
            console.warn(`[${requestId}] ⚠ Error fetching mechanism of action: ${e.message}`);
        }

        // Add mechanism to all results
        if (mechanismData) {
            results.forEach(result => {
                result['Mechanism of Action'] = mechanismData;
            });
        }

        console.log(`[${requestId}] Found ${results.length} results. Generating Excel...`);
        const excelBuffer = await generateExcelBuffer(results);
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);

        // Update Consolidated File
        try {
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            const normalized = normalizeResultsForConsolidated(results, 'PubChem');
            await appendToConsolidatedExcel(consolidatedFile, normalized, 'PubChem');
            console.log(`[${requestId}] Updated consolidated file`);
        } catch (e) { 
            console.warn(`[${requestId}] Consolidated Excel Error: ${e.message}`);
        }

        let username = 'User';
        const user = await User.findOne({ email: recipientEmail }).select('name').catch(() => null);
        if (user) username = user.name.replace(/[^a-zA-Z0-9]/g, '_');

        const filename = `${username}_PubChem_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">Search Results Ready!</h2>
                <p>Dear ${username},</p>
                <p>Your search results are attached. <strong>Note: Results are limited to the requested top ${maxResults} records.</strong></p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin-top: 0;">Search Summary</h3>
                    ${searchDetailsHtml}
                    <p><strong>Total Items in File:</strong> ${results.length}</p>
                    <p><strong>File Size:</strong> ${excelSizeMB} MB</p>
                    <p><strong>Processing Time:</strong> ${duration}s</p>
                </div>
            </div>
        `;

        console.log(`[${requestId}] Sending email with ${results.length} results (${excelSizeMB}MB)...`);
        await sendEmailWithSendGrid(
            recipientEmail,
            `[Search Results] PubChem Data (${results.length} items)`,
            htmlContent,
            {
                content: excelBuffer,
                filename: filename,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );
        
        console.log(`[${requestId}] ✓ Complete (${duration}s)`);

    } catch (error) {
        console.error(`[${requestId}] ✗ Error: ${error.message}`);
        
        // Send error email to user
        try {
            const errorHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">Search Error</h2>
                    <p>Dear User,</p>
                    <p>We encountered an error while processing your PubChem search for <strong>${molecule}</strong>.</p>
                    <p style="color: #666; font-size: 12px;">Error: ${error.message}</p>
                    <p>Please try again later.</p>
                </div>
            `;
            await sendEmailWithSendGrid(recipientEmail, `[Search Error] PubChem Search Failed`, errorHtml);
        } catch (emailError) {
            console.error(`[${requestId}] Failed to send error email: ${emailError.message}`);
        }
    }
}

export const pubchemSearchController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        const { molecule, bioassay = "Any", target_class = "", maxResults = 100 } = req.body;

        // Validation
        if (!molecule || typeof molecule !== 'string' || molecule.trim().length === 0) {
            return res.status(400).json({ error: 'Molecule name is required and must be a non-empty string' });
        }

        // Limit maxResults
        const validatedMaxResults = Math.min(Math.max(parseInt(maxResults, 10) || 100, 1), 200);

        console.log(`[PubChem API] Request: ${molecule} | bioassay: ${bioassay} | target: ${target_class || 'Any'} | max: ${validatedMaxResults} | email: ${recipientEmail}`);

        // Start async processing in background
        setImmediate(() => {
            processPubChemSearchAsync(recipientEmail, molecule.trim(), bioassay, target_class, validatedMaxResults)
                .catch(error => console.error(`[PubChem API] Unhandled error: ${error.message}`));
        });

        return res.status(202).json({
            success: true,
            message: `Processing your request for "${molecule}". Results (max ${validatedMaxResults}) will be emailed to ${recipientEmail} shortly.`,
            requestId: 'pubchem-async'
        });

    } catch (error) {
        console.error(`[PubChem API] Controller Error: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error processing PubChem search' });
    }
};

/**
 * Cache management endpoints (admin only)
 */
export const pubchemCacheStatsController = async (req, res) => {
    try {
        const stats = await getCacheStats();
        return res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const pubchemClearCacheController = async (req, res) => {
    try {
        const { molecule } = req.body;
        await clearCache(molecule || null);
        return res.status(200).json({
            success: true,
            message: molecule ? `Cache cleared for "${molecule}"` : 'Entire cache cleared'
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Fetch mechanism of action for a compound
 */
export const pubchemMechanismController = async (req, res) => {
    try {
        const { compound } = req.body;

        // Validation
        if (!compound || typeof compound !== 'string' || compound.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Compound name or CID is required and must be a non-empty string' 
            });
        }

        console.log(`[PubChem Mechanism API] Request: ${compound}`);

        const result = await fetchMechanismOfAction(compound.trim());

        return res.status(200).json(result);

    } catch (error) {
        console.error(`[PubChem Mechanism API] Error: ${error.message}`);
        return res.status(500).json({ 
            success: false,
            error: 'Internal server error fetching mechanism of action' 
        });
    }
};