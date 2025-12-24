import { format } from 'date-fns';
import User from '../models/User.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { generateExcelBuffer, appendToConsolidatedExcel } from '../services/excelService.js';
import { fetchPubchemData } from '../services/pubChemService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';
import path from 'path';

async function processPubChemSearchAsync(recipientEmail, molecule, bioassay, target_class) {
    const startTime = Date.now();

    const searchDetailsHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Molecule:</td><td style="padding: 8px 0; color: #212529;">"${molecule}"</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Bioassay Filter:</td><td style="padding: 8px 0; color: #212529;">${bioassay}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Target Class:</td><td style="padding: 8px 0; color: #212529;">${target_class || 'All'}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Request Date:</td><td style="padding: 8px 0; color: #212529;">${format(new Date(), 'PPP')} at ${format(new Date(), 'p')}</td></tr>
        </table>
    `;

    try {
        const results = await fetchPubchemData(molecule, bioassay, target_class);

        if (results.length === 0) {
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

        const excelBuffer = await generateExcelBuffer(results);
        const excelSizeMB = (excelBuffer.length / (1024 * 1024)).toFixed(2);

        // Update Consolidated File
        try {
            const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
            const normalized = normalizeResultsForConsolidated(results, 'PubChem');
            await appendToConsolidatedExcel(consolidatedFile, normalized, 'PubChem');
        } catch (e) { console.error("Consolidated Excel Error:", e.message); }

        let username = 'User';
        const user = await User.findOne({ email: recipientEmail }).select('name').catch(() => null);
        if (user) username = user.name.replace(/[^a-zA-Z0-9]/g, '_');

        const filename = `${username}_PubChem_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">Search Results Ready!</h2>
                <p>Dear ${username},</p>
                <p>Your search results are attached. <strong>Note: Results are limited to the top 100 records for email delivery.</strong></p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin-top: 0;">Search Summary</h3>
                    ${searchDetailsHtml}
                    <p><strong>Total Items in File:</strong> ${results.length}</p>
                </div>
            </div>
        `;

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

    } catch (error) {
        console.error("Async Process Error:", error.message);
    }
}

export const pubchemSearchController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        const { molecule, bioassay = "Any", target_class = "" } = req.body;

        if (!molecule) return res.status(400).json({ error: 'Molecule name is required' });

        setImmediate(() => {
            processPubChemSearchAsync(recipientEmail, molecule, bioassay, target_class).catch(console.error);
        });

        return res.status(202).json({
            success: true,
            message: `Processing your request for ${molecule}. Results (max 100) will be emailed to ${recipientEmail} shortly.`
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};