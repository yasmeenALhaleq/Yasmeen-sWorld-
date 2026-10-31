import { getEntity, listEntityRows, toClientEntity } from "@/server/admin/entities";
import { EntityManager } from "@/components/admin/EntityManager";

/** Loads one admin list from the database and renders its manager. */
export async function EntitySection({ entityKey }: { entityKey: string }) {
  const def = getEntity(entityKey);
  if (!def) throw new Error(`Unknown entity: ${entityKey}`);
  const [entity, rows] = await Promise.all([toClientEntity(def), listEntityRows(def)]);
  return <EntityManager entity={entity} rows={rows} />;
}

export function entityTitle(entityKey: string): { title: string; description?: string } {
  const def = getEntity(entityKey);
  return { title: def?.title ?? entityKey, description: def?.description };
}
