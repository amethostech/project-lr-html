import { executeFixedPipeline } from "../services/workflowService.js";
import { logInfo, logError } from "../utils/logger.js";
import { sendEmailWithSendGrid } from "../services/emailService.js";

export async function executeWorkflow(req, res) {
    const { target, therapeuticArea, affiliation } = req.body;
    const userEmail = req.userEmail;

    if (!target || !therapeuticArea || !affiliation) {
        return res.status(400).json({ error: "Missing required fields: target, therapeuticArea, affiliation" });
    }

    logInfo(`[WorkflowController] Starting pipeline execution request for ${userEmail}`);

    // Respond immediately because execution takes a long time
    res.status(202).json({
        message: "Pipeline execution started in the background. Results will be emailed to you."
    });

    // Background execution
    setImmediate(async () => {
        try {
            const excelBuffer = await executeFixedPipeline(target, therapeuticArea, affiliation);

            if (userEmail) {
                logInfo(`[WorkflowController] Emailing pipeline results to ${userEmail}`);
                await sendEmailWithSendGrid(
                    userEmail,
                    "AI Search Tool - Fixed Pipeline Results",
                    `<p>Your 13-step pipeline search for Target: <b>${target}</b>, Therapeutic Area: <b>${therapeuticArea}</b>, Affiliation: <b>${affiliation}</b> is complete.</p>
           <p>Please find the consolidated Excel file attached. It contains a separate sheet for each step of the pipeline, as well as python script output.</p>`,
                    {
                        content: excelBuffer,
                        filename: `Pipeline_Results_${target}.xlsx`,
                        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    }
                );
            } else {
                logInfo(`[WorkflowController] Completed pipeline, but no user email found to send results.`);
            }
        } catch (err) {
            logError("[WorkflowController] Error executing pipeline", err);
        }
    });
}
