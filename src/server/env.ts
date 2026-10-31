import "server-only";
import path from "node:path";
import { DEFAULT_TIMEZONE } from "@/lib/time";

/** Central place for server configuration read from environment variables. */
export const env = {
  isProduction: process.env.NODE_ENV === "production",
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  timeZone: process.env.STORE_TIMEZONE || DEFAULT_TIMEZONE,
  // A runtime folder (not bundled code), so the bundler must not trace it.
  uploadDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads"),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "yasmeenworld",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.MAIL_FROM || "Yasmeen World <no-reply@localhost>",
  },
};

export const smtpConfigured = () => Boolean(env.smtp.host);
