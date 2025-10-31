import sgMail from '@sendgrid/mail';
import { SENDER_EMAIL } from '../utils/constants.js'; 

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Sends an email using SendGrid with a retry mechanism.
 */
export async function sendEmailWithSendGrid(recipientEmail, subject, htmlContent, attachment = null, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📧 SendGrid attempt ${attempt}/${maxRetries} to ${recipientEmail}`);

            const msg = {
                to: recipientEmail,
                from: SENDER_EMAIL, 
                subject: subject,
                html: htmlContent,
            };
            // Add attachment if provided
            if (attachment) {
                msg.attachments = [
                    {
                        content: attachment.content.toString('base64'),
                        filename: attachment.filename,
                        type: attachment.contentType,
                        disposition: 'attachment',
                    }
                ];
            }

            await sgMail.send(msg);
            console.log(`Email sent successfully to ${recipientEmail}`);
            return { success: true };

        } catch (error) {
            console.error(`SendGrid attempt ${attempt} failed:`, error.message);
            
            if (error.response) {
                console.error('SendGrid error details:', error.response.body);
            }

            if (attempt === maxRetries) {
                throw new Error(`Failed to send email after ${maxRetries} attempts: ${error.message}`);
            }

            const delay = 5000 * attempt;
            console.log(`⏳ Waiting ${delay / 1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}