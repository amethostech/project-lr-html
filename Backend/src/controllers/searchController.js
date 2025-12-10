import { fetchStudies } from "../services/clinicalService.js";
import { logInfo, logError } from "../utils/logger.js";
import { generateExcelBuffer } from "../services/excelService.js";
import { sendEmailWithSendGrid } from "../services/emailService.js";

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
    let { keywords, query, maxPages, pageSize } = req.body;

    // Sanitize keywords if they are objects (which happens from frontend)
    if (Array.isArray(keywords) && keywords.length > 0 && typeof keywords[0] === 'object') {
      keywords = keywords.map(k => k.value);
    }

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: "keywords must be a non-empty array" });
    }

    // fetchStudies returns { raw: [...], formatted: [...] }
    const { raw, formatted } = await fetchStudies({
      keywords,
      customQuery: query,
      maxPages: maxPages ?? undefined,
      pageSize: pageSize ?? undefined
    });

    // Console log full raw backend response (for later inspection / saving to DB)
    logInfo("=== Full raw ClinicalTrials data (server console) ===");
    // print with some depth; Node console shows objects nicely
    console.dir(raw, { depth: 2, colors: true });

    // Generate Excel buffer
    const excelBuffer = await generateExcelBuffer(formatted);

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
      count: formatted.length,
      results: formatted,
      message: "Search successful. Results sent to your email."
    });
  } catch (err) {
    logError("searchTrials error", err);
    res.status(500).json({ error: "internal_server_error" });
  }
}
