import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpConfigured } from "@/server/env";
import { execute } from "@/server/db/pool";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** e.g. "order_confirmation" | "password_reset" */
  kind: string;
  orderId?: number | null;
  /** Set for messages containing secrets (reset links): the body is not stored. */
  sensitive?: boolean;
}

export type MailStatus = "sent" | "failed" | "not_configured";

const g = globalThis as unknown as { __bwMailer?: Transporter };

function transporter(): Transporter {
  if (!g.__bwMailer) {
    g.__bwMailer = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      connectionTimeout: 6_000,
      greetingTimeout: 6_000,
      socketTimeout: 12_000,
    });
  }
  return g.__bwMailer;
}

/**
 * Sends an email and records the real outcome in `email_outbox`.
 *
 * It never throws and never pretends: without SMTP settings the status is
 * "not_configured", and "sent" only appears once the SMTP server accepted the
 * message. Callers use the returned status to decide what to tell the user.
 */
export async function sendMail(input: MailInput): Promise<{ status: MailStatus; error?: string }> {
  let status: MailStatus;
  let error: string | undefined;

  if (!smtpConfigured()) {
    status = "not_configured";
  } else {
    try {
      await transporter().sendMail({
        from: env.smtp.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      status = "sent";
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message.slice(0, 480) : "Unknown email error";
      console.error(`[email] ${input.kind} to ${input.to} failed:`, error);
    }
  }

  try {
    await execute(
      "INSERT INTO email_outbox (kind, to_email, subject, body_html, status, error, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [input.kind, input.to, input.subject, input.sensitive ? null : input.html, status, error ?? null, input.orderId ?? null],
    );
  } catch (err) {
    console.error("[email] could not write email_outbox:", err);
  }
  return { status, error };
}
