import { createTransport, type Transporter } from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailService {
  send(options: EmailOptions): Promise<boolean>;
}

// ── SMTP implementation (Microsoft 365) ──

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export const smtpEmailService: EmailService = {
  async send(options: EmailOptions): Promise<boolean> {
    const from = process.env.EMAIL_FROM || "AICE Hub <noreply@hubaice.com>";
    try {
      await getTransporter().sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      return true;
    } catch (err) {
      console.error("[EMAIL] Failed to send:", err);
      return false;
    }
  },
};

// ── Console implementation (development fallback) ──

export const consoleEmailService: EmailService = {
  async send(options: EmailOptions): Promise<boolean> {
    console.log(`[EMAIL-DEV] To: ${options.to}`);
    console.log(`[EMAIL-DEV] Subject: ${options.subject}`);
    console.log(`[EMAIL-DEV] Body: ${options.html.slice(0, 200)}...`);
    return true;
  },
};

// ── Factory ──

export function getEmailService(): EmailService {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return smtpEmailService;
  }
  console.warn("[EMAIL] No SMTP credentials configured, using console fallback");
  return consoleEmailService;
}
