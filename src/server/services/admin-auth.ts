import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/server/env";
import { execute, query, queryOne } from "@/server/db/pool";
import { createSession, destroyAllSessions } from "@/server/auth/session";
import { getClientIp } from "@/server/request";
import { sendMail } from "@/server/services/email";
import { renderPasswordReset } from "@/server/email-templates";
import { getSettings } from "@/server/services/settings";
import { passwordProblem } from "@/lib/password-policy";

const BCRYPT_COST = 12;
const LOCK_WINDOW_MIN = 15;
const MAX_FAILS_PER_EMAIL_AND_IP = 5;
const MAX_FAILS_PER_EMAIL = 10; // stops attackers rotating IP addresses
const MAX_FAILS_PER_IP = 40;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_RESETS_PER_HOUR = 3;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

// Compared against when the email is unknown, so "no such account" takes as long
// as "wrong password" and cannot be told apart by timing.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("not-a-real-password", BCRYPT_COST));

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

interface AdminRow {
  id: number;
  email: string;
  password_hash: string;
  is_active: number;
}

async function failureCount(where: string, params: unknown[]): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM login_attempts
      WHERE success = 0 AND created_at > (UTC_TIMESTAMP() - INTERVAL ${LOCK_WINDOW_MIN} MINUTE) AND ${where}`,
    params,
  );
  return row?.n ?? 0;
}

async function isLockedOut(email: string, ip: string): Promise<boolean> {
  const [byPair, byEmail, byIp] = await Promise.all([
    failureCount("email = ? AND ip = ?", [email, ip]),
    failureCount("email = ?", [email]),
    failureCount("ip = ?", [ip]),
  ]);
  return byPair >= MAX_FAILS_PER_EMAIL_AND_IP || byEmail >= MAX_FAILS_PER_EMAIL || byIp >= MAX_FAILS_PER_IP;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function attemptLogin(rawEmail: string, password: string, remember: boolean): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail).slice(0, 190);
  const ip = await getClientIp();

  if (await isLockedOut(email, ip)) {
    return { ok: false, error: `Too many failed attempts. Please wait ${LOCK_WINDOW_MIN} minutes and try again.` };
  }

  const admin = await queryOne<AdminRow>("SELECT id, email, password_hash, is_active FROM admins WHERE email = ?", [email]);
  const hash = admin?.password_hash ?? (await getDummyHash());
  const passwordOk = await bcrypt.compare(password.slice(0, 200), hash);

  if (!admin || !admin.is_active || !passwordOk) {
    await execute("INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, 0)", [email, ip]);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  // Success: forget this person's earlier failures, start the session.
  await execute("DELETE FROM login_attempts WHERE email = ? AND ip = ?", [email, ip]);
  await execute("UPDATE admins SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [admin.id]);
  await createSession(admin.id, remember);

  // Light housekeeping (about 1 login in 10).
  if (Math.random() < 0.1) {
    await execute("DELETE FROM login_attempts WHERE created_at < (UTC_TIMESTAMP() - INTERVAL 7 DAY)");
    await execute("DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()");
    await execute("DELETE FROM password_resets WHERE expires_at < (UTC_TIMESTAMP() - INTERVAL 1 DAY)");
  }
  return { ok: true };
}

/**
 * Starts a password reset. Always behaves the same from the outside, whether
 * or not the email belongs to an admin, so it cannot be used to discover accounts.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail).slice(0, 190);
  const admin = await queryOne<{ id: number; email: string }>(
    "SELECT id, email FROM admins WHERE email = ? AND is_active = 1",
    [email],
  );
  if (!admin) return;

  const recent = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM password_resets WHERE admin_id = ? AND created_at > (UTC_TIMESTAMP() - INTERVAL 1 HOUR)",
    [admin.id],
  );
  if ((recent?.n ?? 0) >= MAX_RESETS_PER_HOUR) return;

  const token = crypto.randomBytes(32).toString("base64url");
  await execute("INSERT INTO password_resets (admin_id, token_hash, expires_at) VALUES (?, ?, ?)", [
    admin.id,
    sha256(token),
    new Date(Date.now() + RESET_TTL_MS),
  ]);

  const url = `${env.siteUrl}/admin/reset-password/${token}`;
  const mail = renderPasswordReset(url, await getSettings());
  const result = await sendMail({ to: admin.email, ...mail, kind: "password_reset", sensitive: true });

  // With no mail server configured the only way to finish a local reset is the
  // server log. Never in production, where logs may be shared.
  if (result.status !== "sent" && !env.isProduction) {
    console.log(`\n[admin] Password reset link for ${admin.email} (email is not configured):\n  ${url}\n`);
  }
}

/** True if the token is valid, unused and unexpired (used to show the reset form). */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [sha256(token)],
  );
  return Boolean(row);
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<ResetResult> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, error: "This reset link is not valid." };
  const reset = await queryOne<{ id: number; admin_id: number; email: string }>(
    `SELECT r.id, r.admin_id, a.email FROM password_resets r JOIN admins a ON a.id = r.admin_id
      WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > UTC_TIMESTAMP()`,
    [sha256(token)],
  );
  if (!reset) return { ok: false, error: "This reset link has expired or was already used. Please request a new one." };

  const problem = passwordProblem(newPassword, reset.email);
  if (problem) return { ok: false, error: problem };

  const hash = await hashPassword(newPassword);
  // Claim the token first; if two requests race, only one wins.
  const claimed = await execute("UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [reset.id]);
  if (claimed.affectedRows !== 1) return { ok: false, error: "This reset link was already used." };

  await execute("UPDATE admins SET password_hash = ? WHERE id = ?", [hash, reset.admin_id]);
  await execute("UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE admin_id = ? AND used_at IS NULL", [reset.admin_id]);
  await execute("DELETE FROM login_attempts WHERE email = ?", [reset.email]);
  await destroyAllSessions(reset.admin_id); // sign out every device
  return { ok: true };
}

export async function changePassword(adminId: number, current: string, next: string): Promise<ResetResult> {
  const admin = await queryOne<AdminRow>("SELECT id, email, password_hash, is_active FROM admins WHERE id = ?", [adminId]);
  if (!admin) return { ok: false, error: "Account not found." };
  if (!(await bcrypt.compare(current.slice(0, 200), admin.password_hash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  const problem = passwordProblem(next, admin.email);
  if (problem) return { ok: false, error: problem };

  await execute("UPDATE admins SET password_hash = ? WHERE id = ?", [await hashPassword(next), adminId]);
  await destroyAllSessions(adminId, true); // keep this browser, sign out the others
  return { ok: true };
}

export async function listAdmins() {
  return query<{ id: number; email: string; name: string; last_login_at: Date | null }>(
    "SELECT id, email, name, last_login_at FROM admins ORDER BY id",
  );
}
