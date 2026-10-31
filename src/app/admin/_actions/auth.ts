"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession, requireAdmin } from "@/server/auth/session";
import { attemptLogin, changePassword, requestPasswordReset, resetPasswordWithToken } from "@/server/services/admin-auth";
import { allow } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { formValues, invalid, str } from "@/server/admin/validation";
import { passwordProblem } from "@/lib/password-policy";
import type { ActionState } from "@/lib/entity-types";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(190),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: str(form, "email"), password: String(form.get("password") ?? "") });
  if (!parsed.success) return invalid(parsed.error, form);

  const result = await attemptLogin(parsed.data.email, parsed.data.password, form.get("remember") === "on");
  if (!result.ok) return { error: result.error, values: formValues(form) };
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

export async function forgotPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.string().trim().email("Enter a valid email address.").max(190) }).safeParse({ email: str(form, "email") });
  if (!parsed.success) return invalid(parsed.error, form);

  // Slow down automated attempts (per connection) without revealing anything about the account.
  if (allow(`forgot:${await getClientIp()}`, 5, 15 * 60_000)) {
    await requestPasswordReset(parsed.data.email);
  }
  return { ok: true, message: "If that email belongs to an administrator, a reset link is on its way. It works for 1 hour." };
}

export async function resetPasswordAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { error: "The two passwords do not match.", fieldErrors: { confirm: "The two passwords do not match." } };
  const problem = passwordProblem(password);
  if (problem) return { error: problem, fieldErrors: { password: problem } };

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) return { error: result.error };
  redirect("/admin/login?reset=1");
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next !== confirm) return { error: "The two new passwords do not match.", fieldErrors: { confirm: "The two passwords do not match." } };

  const result = await changePassword(admin.adminId, current, next);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "Your password was changed. Other devices have been signed out." };
}
