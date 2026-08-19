/**
 * Manual SMTP smoke test for transactional email foundation.
 *
 * Usage (local):
 *   MAIL_SMOKE_CONFIRM=SEND \
 *   MAIL_SMOKE_TO=your@email.com \
 *   SMTP_HOST=smtp.example.com \
 *   SMTP_PORT=587 \
 *   SMTP_USER=user \
 *   SMTP_PASS=pass \
 *   MAIL_FROM_ADDRESS=noreply@techfusion.ai \
 *   ts-node apps/api-gateway/src/mail/smoke-test.ts
 *
 * Usage (Railway):
 *   Set MAIL_SMOKE_CONFIRM=SEND and MAIL_SMOKE_TO as env vars, then run via CLI.
 *
 * This script:
 *   - Requires explicit MAIL_SMOKE_CONFIRM=SEND
 *   - Requires explicit MAIL_SMOKE_TO recipient
 *   - Renders a harmless foundation-test email
 *   - Contains no password reset or verification token
 *   - Never prints credentials, full recipient, or body
 *   - Returns non-zero exit code on failure
 */

const CONFIRMATION_VALUE = 'SEND';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '****';
  const head = (local || '').slice(0, 2);
  const tail = domain.split('.').slice(-2).join('.');
  return `${head}***@${tail}`;
}

async function main() {
  const confirm = process.env.MAIL_SMOKE_CONFIRM;
  if (confirm !== CONFIRMATION_VALUE) {
    console.error('[SMOKE TEST] Refusing to run. Set MAIL_SMOKE_CONFIRM=SEND to confirm.');
    process.exit(1);
  }

  const to = process.env.MAIL_SMOKE_TO;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error('[SMOKE TEST] MAIL_SMOKE_TO must be a valid email address.');
    process.exit(1);
  }

  const maskedRecipient = maskEmail(to);
  console.log(`[SMOKE TEST] Target: ${maskedRecipient}`);

  const config = {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM_ADDRESS || 'noreply@techfusion.ai',
    fromName: process.env.MAIL_FROM_NAME || 'TechFusion AI',
    connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || '10000', 10),
    greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS || '10000', 10),
    socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || '30000', 10),
  };

  try {
    const nodemailer = await import('nodemailer');

    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: config.connectionTimeout,
      greetingTimeout: config.greetingTimeout,
      socketTimeout: config.socketTimeout,
      tls: { rejectUnauthorized: true },
    });

    const subject = 'TechFusion AI — SMTP Foundation Smoke Test';
    const textBody = [
      'This is a harmless smoke test email from the TechFusion AI transactional email foundation.',
      '',
      'If you received this, the SMTP transport is working correctly.',
      '',
      'No action required.',
    ].join('\n');

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
        <tr><td style="background:#6366f1;padding:24px 32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:20px;">TechFusion AI</h1></td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#1f2937;font-size:18px;">SMTP Foundation Smoke Test</h2>
          <p style="margin:0 0 16px;color:#1f2937;font-size:14px;line-height:1.6;">This is a harmless smoke test email from the transactional email foundation.</p>
          <p style="margin:0;color:#1f2937;font-size:14px;line-height:1.6;">If you received this, the SMTP transport is working correctly. No action required.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const info = await transport.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });

    await transport.close();

    console.log('[SMOKE TEST] SUCCESS — Email sent');
    console.log(`[SMOKE TEST] Provider message ID: ${info.messageId ? 'present' : 'absent'}`);
    console.log('[SMOKE TEST] PRODUCTION SMTP CONNECTION CERTIFIED: YES (manual verification required)');
  } catch (err: any) {
    console.error('[SMOKE TEST] FAILED');
    console.error(`[SMOKE TEST] Error category: ${err?.code || 'unknown'}`);
    console.error('[SMOKE TEST] PRODUCTION SMTP CONNECTION CERTIFIED: NO');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[SMOKE TEST] FATAL ERROR');
  process.exit(1);
});
