"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import {
  deleteEntityRow, getEntity, moveEntityRow, parseEntityForm, saveEntityRow, setEntityActive,
} from "@/server/admin/entities";
import { formValues } from "@/server/admin/validation";
import type { ActionState } from "@/lib/entity-types";

// Generic add / edit / delete / reorder / show-hide for the simple admin lists.
// The entity key selects a server-side definition; unknown keys are rejected.

function entityOrThrow(key: string) {
  const def = getEntity(key);
  if (!def) throw new Error("Unknown list");
  return def;
}

export async function saveEntityAction(entityKey: string, id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const def = entityOrThrow(entityKey);

  const { columns, errors } = await parseEntityForm(def, form);
  if (Object.keys(errors).length > 0) return { error: "Please fix the highlighted fields.", fieldErrors: errors, values: formValues(form) };

  try {
    await saveEntityRow(def, id, columns);
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return { error: `A ${def.singular} with that ${def.key === "coupons" ? "code" : "name"} already exists.`, values: formValues(form) };
    }
    console.error(`[admin] saving ${entityKey} failed:`, err);
    return { error: "Could not save. Please try again.", values: formValues(form) };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: id ? "Saved." : `The ${def.singular} was added.` };
}

export async function deleteEntityAction(entityKey: string, id: number): Promise<void> {
  await requireAdmin();
  await deleteEntityRow(entityOrThrow(entityKey), id);
  revalidatePath("/admin", "layout");
}

export async function toggleEntityAction(entityKey: string, id: number, value: boolean): Promise<void> {
  await requireAdmin();
  await setEntityActive(entityOrThrow(entityKey), id, value);
  revalidatePath("/admin", "layout");
}

export async function moveEntityAction(entityKey: string, id: number, direction: "up" | "down"): Promise<void> {
  await requireAdmin();
  await moveEntityRow(entityOrThrow(entityKey), id, direction === "up" ? "up" : "down");
  revalidatePath("/admin", "layout");
}
