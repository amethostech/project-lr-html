import { searchNewsArticles, getNewsSourceStatus } from '../services/newsArticlesService.js';
import { generateExcelBuffer } from '../services/excelService.js';
import { sendEmailWithSendGrid } from '../services/emailService.js';
import { saveToConsolidatedExcel } from '../services/consolidatedExcelService.js';
import { normalizeResultsForConsolidated } from '../utils/consolidatedNormalizer.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * POST /api/news/search
 * Body: { keywords: string[] | { value: string }[], maxResults?: number }
 * Requires authenticateJWT (req.userEmail populated by auth middleware).
 * Responds 202 Accepted and performs the heavy work in the background.
 */
export const searchNewsArticlesController = async (req, res) => {
    try {
        const recipientEmail = req.userEmail;
        if (!recipientEmail) {
            return res.status(401).json({
                success: false,
                error: 'User email not found on request. Please log in again.'
            });
        }

        let { keywords, maxResults } = req.body ?? {};

        // Frontend often sends keywords as [{ value, operatorAfter }]
        if (Array.isArray(keywords) && keywords.length > 0 && typeof keywords[0] === 'object') {
            keywords = keywords.map(k => (typeof k === 'string' ? k : k.value || ''));
        }

        if (!Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide at least one keyword.'
            });
        }

        const cleanedKeywords = keywords
            .map(k => String(k ?? '').trim())
            .filter(k => k.length > 0);

        if (cleanedKeywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide at least one non‑empty keyword.'
            });
        }

        const limit = Math.min(Math.max(parseInt(maxResults ?? '100', 10) || 1, 1), 10000);

        logInfo(`[News] Request from ${recipientEmail} for keywords: ${cleanedKeywords.join(', ')} (limit=${limit})`);

        // Heavy work in background to avoid client timeouts.
        setImmediate(() => {
            processNewsSearchAsync(recipientEmail, cleanedKeywords, limit).catch(err => {
                logError('[News] Background processing error', err);
            });
        });

        return res.status(202).json({
            success: true,
            status: 'processing',
            recipientEmail,
            message: `News articles search started for: "${cleanedKeywords.join(', ')}". Results will be emailed shortly.`
        });
    } catch (err) {
        logError('[News] searchNewsArticlesController error', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to start news articles search.',
            details: err.message
        });
    }
};

/**
 * Internal helper that performs the actual CSV search, Excel generation,
 * consolidated Excel update and email sending.
 */
async function processNewsSearchAsync(recipientEmail, keywords, maxResults) {
    try {
        logInfo(`[News] Starting CSV search for: ${keywords.join(', ')} (limit=${maxResults})`);

        const results = await searchNewsArticles(keywords, maxResults);
        logInfo(`[News] CSV search found ${results.length} matching articles`);

        if (!results || results.length === 0) {
            // Still send a friendly email saying that no results were found.
            try {
                await sendEmailWithSendGrid(
                    recipientEmail,
                    'News Articles Search – No Results',
                    `<p>Your news search for <strong>${keywords.join(', ')}</strong> did not return any results.</p>`
                );
                logInfo(`[News] Sent no‑results email to ${recipientEmail}`);
            } catch (emailErr) {
                logError('[News] Failed to send no‑results email', emailErr);
            }
            return;
        }

        // Generate Excel attachment
        const excelBuffer = await generateExcelBuffer(results);

        // Append to consolidated Excel (normalized for readability)
        try {
            const normalized = normalizeResultsForConsolidated(results, 'News Articles');
            await saveToConsolidatedExcel(normalized, 'News Articles');
            logInfo(`[News] Appended ${normalized.length} rows to consolidated Excel`);
        } catch (excelErr) {
            logError('[News] Failed to append to consolidated Excel', excelErr);
        }

        // Send results to the user
        try {
            await sendEmailWithSendGrid(
                recipientEmail,
                `News Articles Search – ${results.length} Results`,
                `<p>Your news search for <strong>${keywords.join(', ')}</strong> returned <strong>${results.length}</strong> articles.</p>
                 <p>The results are attached as an Excel file.</p>`,
                {
                    content: excelBuffer,
                    filename: `news_articles_results_${Date.now()}.xlsx`,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            );
            logInfo(`[News] Sent results email to ${recipientEmail}`);
        } catch (emailErr) {
            logError('[News] Failed to send results email', emailErr);
        }
    } catch (err) {
        logError('[News] processNewsSearchAsync error', err);
        // Best‑effort error email
        try {
            await sendEmailWithSendGrid(
                recipientEmail,
                'News Articles Search – Error',
                `<p>We were unable to complete your news articles search.</p><p>Error: ${err.message}</p>`
            );
        } catch (emailErr) {
            logError('[News] Failed to send error notification email', emailErr);
        }
    }
}

/**
 * GET /api/news/status
 * Returns basic information about the configured CSV source (local file or URL).
 */
export const getNewsArticlesStatusController = async (req, res) => {
    try {
        const status = await getNewsSourceStatus();
        return res.json({
            success: true,
            status
        });
    } catch (err) {
        logError('[News] getNewsArticlesStatusController error', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to get news CSV status.',
            details: err.message
        });
    }
};


