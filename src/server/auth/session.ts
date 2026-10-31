import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/server/env";
import { execute, queryOne } from "@/server/db/pool";
import { getClientIp, getUserAgent } from "@/server/request";

// Admin sessions: a random token in an HttpOnly cookie; only its SHA-256 is
// stored in the database. Two lifetimes apply to every session:
//   idle timeout     - signed out after this long without any admin request
//   absolute limit   - signed out after this long no matter what
export const SESSION_RULES = {
  idleMs: 30 * 60 * 1000, //            normal sign-in: 30 minutes idle
  absoluteMs: 12 * 60 * 60 * 1000, //   ... and at most 12 hours
  rememberIdleMs: 14 * 24 * 60 * 60 * 1000, //   "Remember me": 14 days idle
  rememberAbsoluteMs: 30 * 24 * 60 * 60 * 1000, //   ... and at most 30 days
} as const;

export const SESSION_COOKIE = "bw_admin";

export interface AdminSession {
  adminId: number;
  email: string;
  name: string;
  remember: boolean;
  /** Idle limit for this session, so the browser can warn / sign out in step. */
  idleMs: number;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Starts a session for `adminId` and sets the cookie. Call from a Server Action / route handler. */
export async function createSession(adminId: number, remember: boolean): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const lifetime = remember ? SESSION_RULES.rememberAbsoluteMs : SESSION_RULES.absoluteMs;
  const expires = new Date(Date.now() + lifetime);

  await execute(
    "INSERT INTO admin_sessions (id, admin_id, remember, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    [sha256(token), adminId, remember ? 1 : 0, await getClientIp(), await getUserAgent(), expires],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.siteUrl.startsWith("https://"),
    path: "/",
    // "Remember me" = persistent cookie; otherwise a session cookie that dies with the browser.
    ...(remember ? { expires } : {}),
  });
}

/** The signed-in admin for this request, or null. Expired sessions are deleted. */
export const getCurrentAdmin = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const id = sha256(token);
  const row = await queryOne<{
    admin_id: number; remember: number; last_seen_at: Date; expires_at: Date;
    email: string; name: string; is_active: number;
  }>(
    `SELECT s.admin_id, s.remember, s.last_seen_at, s.expires_at, a.email, a.name, a.is_active
       FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.id = ?`,
    [id],
  );
  if (!row) return null;

  const now = Date.now();
  const remember = row.remember === 1;
  const idleMs = remember ? SESSION_RULES.rememberIdleMs : SESSION_RULES.idleMs;
  const dead =
    !row.is_active ||
    row.expires_at.getTime() <= now ||
    now - row.last_seen_at.getTime() > idleMs;
  if (dead) {
    await execute("DELETE FROM admin_sessions WHERE id = ?", [id]);
    return null;
  }

  // Slide the idle window, but write at most once a minute.
  if (now - row.last_seen_at.getTime() > 60_000) {
    await execute("UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
  }
  return { adminId: row.admin_id, email: row.email, name: row.name, remember, idleMs };
});

/** For pages / layouts: redirects to the login page when not signed in. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For Server Actions / route handlers: throws instead of redirecting. */
export async function assertAdmin(): Promise<AdminSession> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await execute("DELETE FROM admin_sessions WHERE id = ?", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Signs an admin out everywhere (after a password change / reset). */
export async function destroyAllSessions(adminId: number, exceptCurrentToken = false): Promise<void> {
  if (exceptCurrentToken) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      await execute("DELETE FROM admin_sessions WHERE admin_id = ? AND id <> ?", [adminId, sha256(token)]);
      return;
    }
  }
  await execute("DELETE FROM admin_sessions WHERE admin_id = ?", [adminId]);
}
