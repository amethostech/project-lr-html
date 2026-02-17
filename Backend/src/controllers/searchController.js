import { fetchStudies } from "../services/clinicalService.js";
import { logInfo, logError } from "../utils/logger.js";
import { generateExcelBuffer } from "../services/excelService.js";
import { sendEmailWithSendGrid } from "../services/emailService.js";
import { saveToConsolidatedExcel } from "../services/consolidatedExcelService.js";
import { normalizeResultsForConsolidated } from "../utils/consolidatedNormalizer.js";

/**
 * Request body:
 * {
 *   "keywords": ["cancer","immunotherapy"],
 *   "maxPages": 2,
 *   "pageSize": 50
 * }
 */
export async function searchTrials(req, res) {
  try {
    let { keywords, query, pageSize, maxResults, phase, status: trialStatus, sponsor_type } = req.body;

    // Sanitize keywords if they are objects (which happens from frontend)
    if (Array.isArray(keywords) && keywords.length > 0 && typeof keywords[0] === 'object') {
      keywords = keywords.map(k => k.value);
    }

    // Keywords are optional — allow searches with just date range or filters
    if (!Array.isArray(keywords)) {
      keywords = [];
    }

    // Respect user-specified limits
    const parsedMax = parseInt(maxResults || 100, 10);
    const effectiveMax = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100;
    const parsedPageSize = parseInt(pageSize || 50, 10);
    const effectivePageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 50;

    // fetchStudies now paginates through ALL pages automatically
    const { raw, formatted } = await fetchStudies({
      keywords,
      customQuery: query,
      pageSize: effectivePageSize,
      phase,
      status: trialStatus,
      sponsor_type
    });

    // Use all fetched results (pagination already handles full retrieval)
    const limited = formatted;

    // Console log full raw backend response (for later inspection / saving to DB)
    logInfo("=== Full raw ClinicalTrials data (server console) ===");
    // print with some depth; Node console shows objects nicely
    console.dir(raw, { depth: 2, colors: true });

    // Generate Excel buffer
    const excelBuffer = await generateExcelBuffer(limited);

    // Also append to the single consolidated Excel file (normalized)
    try {
      const normalized = normalizeResultsForConsolidated(limited, 'ClinicalTrials');
      await saveToConsolidatedExcel(normalized, 'ClinicalTrials');
      logInfo(`Consolidated Excel updated: ClinicalTrials (${normalized.length} records)`);
    } catch (excelErr) {
      logError("Failed to save ClinicalTrials results to consolidated Excel", excelErr);
    }

    // Send email if user email is present
    const userEmail = req.userEmail;
    if (userEmail) {
      try {
        await sendEmailWithSendGrid(
          userEmail,
          "Clinical Trials Search Results",
          "<p>Please find attached the search results for your Clinical Trials query.</p>",
          {
            content: excelBuffer,
            filename: "clinical_trials_results.xlsx",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        );
        logInfo(`Email sent to ${userEmail}`);
      } catch (emailErr) {
        logError("Failed to send email", emailErr);
        // Don't fail the request if email fails, but maybe warn?
        // continuing...
      }
    }

    // Minimal response to client
    res.json({
      count: limited.length,
      results: limited,
      message: "Search successful. Results sent to your email."
    });
  } catch (err) {
    logError("searchTrials error", err);
    res.status(500).json({ error: "internal_server_error" });
  }
}
