const BRAND_NAME = 'TechFusion AI';
const BRAND_COLOR = '#6366f1';
const TEXT_COLOR = '#1f2937';
const BG_COLOR = '#f9fafb';
const BORDER_COLOR = '#e5e7eb';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function buildBaseHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid ${BORDER_COLOR};overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${escapeHtml(BRAND_NAME)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:${BG_COLOR};border-top:1px solid ${BORDER_COLOR};text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;">&copy; ${new Date().getFullYear()} ${escapeHtml(BRAND_NAME)}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface TemplateData {
  recipientName: string;
  actionUrl?: string;
  expiresIn?: string;
  eventDescription?: string;
  timestamp?: string;
}

export interface RenderedEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
}

export function renderTemplate(templateId: string, data: TemplateData): RenderedEmail {
  switch (templateId) {
    case 'password-reset':
      return renderPasswordReset(data);
    case 'email-verification':
      return renderEmailVerification(data);
    case 'security-notification':
      return renderSecurityNotification(data);
    default:
      throw new Error(`Unsupported template ID: "${templateId}"`);
  }
}

function renderPasswordReset(data: TemplateData): RenderedEmail {
  const subject = `Reset your ${BRAND_NAME} password`;
  const textBody = [
    `Hello ${data.recipientName},`,
    '',
    'We received a request to reset your password.',
    '',
    `Click the link below to reset your password. This link expires in ${data.expiresIn}.`,
    '',
    data.actionUrl,
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  const bodyContent = `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:18px;">Reset your password</h2>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">Hello ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">We received a request to reset your password. Click the button below to set a new password.</p>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">This link expires in <strong>${escapeHtml(data.expiresIn || '')}</strong>.</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(data.actionUrl || '#')}" style="display:inline-block;padding:12px 24px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reset Password</a>
    </p>
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 16px;word-break:break-all;color:#6b7280;font-size:13px;line-height:1.6;">${escapeHtml(data.actionUrl || '')}</p>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If you did not request a password reset, you can safely ignore this email.</p>`;

  return { subject, textBody, htmlBody: buildBaseHtml(subject, bodyContent) };
}

function renderEmailVerification(data: TemplateData): RenderedEmail {
  const subject = `Verify your ${BRAND_NAME} email address`;
  const textBody = [
    `Hello ${data.recipientName},`,
    '',
    'Welcome to TechFusion AI!',
    '',
    `Please verify your email address by clicking the link below. This link expires in ${data.expiresIn}.`,
    '',
    data.actionUrl,
    '',
    'If you did not create an account, you can safely ignore this email.',
    '',
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  const bodyContent = `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:18px;">Verify your email address</h2>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">Hello ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">Welcome to TechFusion AI! Please verify your email address to get started.</p>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">This link expires in <strong>${escapeHtml(data.expiresIn || '')}</strong>.</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(data.actionUrl || '#')}" style="display:inline-block;padding:12px 24px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Verify Email</a>
    </p>
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 16px;word-break:break-all;color:#6b7280;font-size:13px;line-height:1.6;">${escapeHtml(data.actionUrl || '')}</p>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If you did not create an account, you can safely ignore this email.</p>`;

  return { subject, textBody, htmlBody: buildBaseHtml(subject, bodyContent) };
}

function renderSecurityNotification(data: TemplateData): RenderedEmail {
  const subject = `Security alert — ${data.eventDescription}`;
  const textBody = [
    `Hello ${data.recipientName},`,
    '',
    'A security-related event was detected on your account:',
    '',
    data.eventDescription,
    '',
    `Time: ${data.timestamp}`,
    '',
    'If this was you, no action is needed. If you do not recognize this activity, please change your password immediately and review your account settings.',
    '',
    `The ${BRAND_NAME} Team`,
  ].join('\n');

  const bodyContent = `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:18px;">Security alert</h2>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">Hello ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">A security-related event was detected on your account:</p>
    <table role="presentation" width="100%" cellpadding="12" cellspacing="0" style="background-color:${BG_COLOR};border-radius:6px;margin:0 0 16px;">
      <tr>
        <td style="font-size:14px;color:${TEXT_COLOR};"><strong>Event:</strong> ${escapeHtml(data.eventDescription || '')}</td>
      </tr>
      <tr>
        <td style="font-size:14px;color:${TEXT_COLOR};"><strong>Time:</strong> ${escapeHtml(data.timestamp || '')}</td>
      </tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If this was you, no action is needed. If you do not recognize this activity, please change your password immediately and review your account settings.</p>`;

  return { subject, textBody, htmlBody: buildBaseHtml(subject, bodyContent) };
}
