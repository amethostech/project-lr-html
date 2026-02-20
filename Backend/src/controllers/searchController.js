import { fetchStudies } from "../services/clinicalService.js";
import { logInfo, logError } from "../utils/logger.js";
import { generateExcelBuffer } from "../services/excelService.js";
import { sendEmailWithSendGrid } from "../services/emailService.js";
import { saveToConsolidatedExcel } from "../services/consolidatedExcelService.js";
import { normalizeResultsForConsolidated } from "../utils/consolidatedNormalizer.js";

/**
 * POST /api/search
 * Body: { keywords, query, pageSize, maxResults, phase, status, sponsor_type }
 *
 * Memory-efficient: fetchStudies now returns only formatted results (no raw data).
 * Results are formatted page-by-page in the service, raw API data is discarded immediately.
 */
export async function searchTrials(req, res) {
  try {
    let { keywords, query, pageSize, maxResults, phase, status: trialStatus, sponsor_type, intervention, condition } = req.body;

    // Sanitize keywords if they are objects (which happens from frontend)
    if (Array.isArray(keywords) && keywords.length > 0 && typeof keywords[0] === 'object') {
      keywords = keywords.map(k => k.value);
    }

    // Keywords are optional — allow searches with just date range or filters
    if (!Array.isArray(keywords)) {
      keywords = [];
    }

    // Parse limits
    const parsedMax = parseInt(maxResults || 10000, 10);
    const effectiveMax = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 10000;
    const parsedPageSize = parseInt(pageSize || 50, 10);
    const effectivePageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 50;

    logInfo(`[SearchController] Clinical search: query="${query}", maxResults=${effectiveMax}, phase=${phase}, status=${trialStatus}, intervention=${intervention}, condition=${condition}`);

    // fetchStudies returns { formatted, totalFetched, pageCount } — NO raw data
    const { formatted, totalFetched, pageCount } = await fetchStudies({
      keywords,
      customQuery: query,
      pageSize: effectivePageSize,
      maxResults: effectiveMax,
      phase,
      status: trialStatus,
      sponsor_type,
      intervention,
      condition
    });

    logInfo(`[SearchController] Received ${formatted.length} formatted results from ${pageCount} pages`);

    // Generate Excel buffer from formatted results
    const excelBuffer = await generateExcelBuffer(formatted);

    // Append to consolidated Excel in background (non-blocking)
    setImmediate(async () => {
      try {
        const normalized = normalizeResultsForConsolidated(formatted, 'ClinicalTrials');
        await saveToConsolidatedExcel(normalized, 'ClinicalTrials');
        logInfo(`Consolidated Excel updated: ClinicalTrials (${normalized.length} records)`);
      } catch (excelErr) {
        logError("Failed to save ClinicalTrials results to consolidated Excel", excelErr);
      }
    });

    // Send email if user email is present (in background)
    const userEmail = req.userEmail;
    if (userEmail) {
      // Fire-and-forget: don't block the response
      setImmediate(async () => {
        try {
          await sendEmailWithSendGrid(
            userEmail,
            "Clinical Trials Search Results",
            `<p>Your Clinical Trials search returned ${formatted.length} results across ${pageCount} pages.</p>
             <p>Please find the full results in the attached Excel file.</p>`,
            {
              content: excelBuffer,
              filename: "clinical_trials_results.xlsx",
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
          );
          logInfo(`Email sent to ${userEmail}`);
        } catch (emailErr) {
          logError("Failed to send email", emailErr);
        }
      });
    }

    // Return results to frontend immediately
    res.json({
      count: formatted.length,
      totalFetched,
      pageCount,
      results: formatted,
      message: `Found ${formatted.length} clinical trials across ${pageCount} pages.${userEmail ? ' Results will be emailed shortly.' : ''}`
    });
  } catch (err) {
    logError("searchTrials error", err);
    res.status(500).json({ error: "internal_server_error", details: err.message });
  }
}
