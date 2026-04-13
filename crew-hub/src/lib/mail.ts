import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

export function isSmtpConfigured(): boolean {
  return smtpConfigured();
}

async function getTransporter() {
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER.trim(),
            pass: process.env.SMTP_PASS.trim(),
          }
        : undefined,
  });
}

export async function sendBillingEmail(opts: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!smtpConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM."
    );
  }
  const transporter = await getTransporter();
  await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!smtpConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM."
    );
  }

  const transporter = await getTransporter();
  const from = process.env.SMTP_FROM!.trim();

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your Crew password",
    text: `You asked to reset your Crew password.\n\nOpen this link (valid 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>You asked to reset your Crew password.</p><p><a href="${resetUrl}">Reset password</a> (valid 1 hour)</p><p>If you did not request this, ignore this email.</p>`,
  });
}
