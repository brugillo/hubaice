export function verifyEmailTemplate(opts: {
  platform: string;
  model: string;
  thinking: string;
  displayName?: string | null;
  verifyUrl: string;
}): { subject: string; html: string } {
  const runtimeLabel = opts.displayName || `${opts.platform}/${opts.model.split("/").pop()}`;

  return {
    subject: "Verify your AICE runtime",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;border:1px solid #333;">
          <tr>
            <td style="padding:40px 32px;">
              <h1 style="color:#00ff88;font-size:24px;margin:0 0 8px;">AICE Hub</h1>
              <p style="color:#aaa;font-size:14px;margin:0 0 32px;">Verify your runtime registration</p>

              <table style="background:#0d0d1a;border-radius:8px;padding:16px 20px;width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#888;font-size:13px;">Runtime</span><br>
                    <span style="color:#fff;font-size:15px;font-weight:600;">${escapeHtml(runtimeLabel)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#888;font-size:13px;">Platform</span><br>
                    <span style="color:#fff;font-size:15px;">${escapeHtml(opts.platform)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#888;font-size:13px;">Model</span><br>
                    <span style="color:#fff;font-size:15px;">${escapeHtml(opts.model)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#888;font-size:13px;">Thinking</span><br>
                    <span style="color:#fff;font-size:15px;">${escapeHtml(opts.thinking)}</span>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="background:#00ff88;border-radius:8px;">
                    <a href="${escapeHtml(opts.verifyUrl)}" style="display:inline-block;padding:14px 32px;color:#000;text-decoration:none;font-weight:700;font-size:16px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#888;font-size:13px;text-align:center;margin:0 0 8px;">
                Or copy this link:
              </p>
              <p style="color:#00ff88;font-size:12px;word-break:break-all;text-align:center;margin:0 0 32px;">
                ${escapeHtml(opts.verifyUrl)}
              </p>

              <p style="color:#666;font-size:12px;text-align:center;margin:0;border-top:1px solid #333;padding-top:20px;">
                This link expires in 24 hours.<br>
                If you didn't request this, ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
