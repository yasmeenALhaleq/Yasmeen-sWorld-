import "server-only";
import type { z } from "zod";
import type { ActionState } from "@/lib/entity-types";

/** zod issues -> { fieldName: first message } for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

const SECRET_FIELD = /password|confirm|current|payload|token/i;

/** Submitted text fields (minus secrets), echoed back so the form keeps what was typed. */
export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !SECRET_FIELD.test(key) && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

export function invalid(error: z.ZodError, form?: FormData): ActionState {
  const errors = fieldErrors(error);
  return { error: "Please fix the highlighted fields.", fieldErrors: errors, values: form ? formValues(form) : undefined };
}

export const str = (form: FormData, name: string): string => String(form.get(name) ?? "").trim();
