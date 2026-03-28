const { Resend } = require('resend');

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a welcome email to a new user
 * @param {string} toEmail - Recipient email address
 * @param {string} name - User's first name
 * @param {string} institutionName - Name of the institution (optional)
 * @returns {Promise<object>} - Resend API response
 */
async function sendWelcomeEmail(toEmail, name, institutionName = 'Hayford Global Learning Hub') {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Hayford Hub <onboarding@hayfordacademy.com>',
      to: [toEmail],
      subject: `Welcome to ${institutionName}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #800020 0%, #4A1410 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
                border-radius: 0 0 10px 10px;
              }
              .button {
                display: inline-block;
                background: #800020;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Welcome to ${institutionName}! 🎉</h1>
            </div>
            <div class="content">
              <p style="font-size: 18px; margin-top: 0;">Hi ${name},</p>
              
              <p>We're thrilled to have you join our learning community! Your account has been successfully created.</p>
              
              <p><strong>What's next?</strong></p>
              <ul>
                <li>Complete your profile to personalize your experience</li>
                <li>Explore our IELTS Writing & Speaking tools</li>
                <li>Practice grammar with our interactive Grammar World</li>
                <li>Build your academic vocabulary</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://hub.hayfordacademy.com'}/login" class="button">
                  Get Started →
                </a>
              </div>
              
              <p style="margin-top: 30px;">If you have any questions, our support team is here to help!</p>
              
              <p>Happy learning! 📚<br>
              <strong>The ${institutionName} Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${institutionName}. All rights reserved.</p>
              <p>This email was sent to ${toEmail}</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Failed to send welcome email:', error);
      throw error;
    }

    console.log('✅ Welcome email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in sendWelcomeEmail:', error);
    throw error;
  }
}

/**
 * Send a password reset email with secure token link
 * @param {string} toEmail - Recipient email address
 * @param {string} resetLink - Full password reset URL with token
 * @returns {Promise<object>} - Resend API response
 */
async function sendPasswordResetEmail(toEmail, resetLink) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Hayford Hub <security@hayfordacademy.com>',
      to: [toEmail],
      subject: 'Reset Your Password - Hayford Hub',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
                border-radius: 0 0 10px 10px;
              }
              .button {
                display: inline-block;
                background: #1e3a8a;
                color: white;
                padding: 14px 40px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                margin: 20px 0;
              }
              .warning-box {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p style="font-size: 18px; margin-top: 0;">Hello,</p>
              
              <p>We received a request to reset your password for your Hayford Hub account.</p>
              
              <p>Click the button below to create a new password. This link will expire in <strong>1 hour</strong> for security reasons.</p>
              
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">
                  Reset My Password
                </a>
              </div>
              
              <div class="warning-box">
                <p style="margin: 0; font-size: 14px;"><strong>⚠️ Security Notice:</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 14px;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
              </div>
              
              <p style="font-size: 13px; color: #666; margin-top: 30px;">
                <strong>Link not working?</strong><br>
                Copy and paste this URL into your browser:<br>
                <span style="word-break: break-all; color: #1e3a8a;">${resetLink}</span>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Hayford Global Learning Hub. All rights reserved.</p>
              <p>This email was sent to ${toEmail}</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }

    console.log('✅ Password reset email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in sendPasswordResetEmail:', error);
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
