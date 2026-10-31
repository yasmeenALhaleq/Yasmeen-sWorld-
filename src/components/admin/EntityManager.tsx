"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteEntityAction, moveEntityAction, saveEntityAction, toggleEntityAction,
} from "@/app/admin/_actions/entities";
import { ColorField, ImageUploadField } from "@/components/admin/AdminFields";
import { CheckboxField, FormAlert, SelectField, TextAreaField, TextField } from "@/components/ui/Fields";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatMoney } from "@/lib/money";
import { imageUrl } from "@/lib/images";
import { sticky, stickyChecked, type ActionState, type ClientEntity, type ClientField, type EntityRow, type RowValue } from "@/lib/entity-types";

const initial: ActionState = {};

function defaultFor(field: ClientField): RowValue {
  if (field.defaultValue !== undefined) return field.defaultValue;
  return field.type === "checkbox" ? false : "";
}

/** One input, chosen by field type. */
function FieldInput({ field, value, error }: { field: ClientField; value: RowValue; error?: string }) {
  const str = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "checkbox":
      return <CheckboxField label={field.label} name={field.name} help={field.help} defaultChecked={value === true} />;
    case "textarea":
      return <TextAreaField label={field.label} name={field.name} defaultValue={str} required={field.required} maxLength={field.maxLength} placeholder={field.placeholder} help={field.help} error={error} rows={3} />;
    case "select":
      return (
        <SelectField label={field.label} name={field.name} defaultValue={str} required={field.required} help={field.help} error={error}>
          {(!field.required || field.nullable) && <option value="">{field.required ? "Choose..." : "None"}</option>}
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
      );
    case "color":
      return <ColorField label={field.label} name={field.name} defaultValue={str || "#9B5275"} error={error} help={field.help} />;
    case "image":
      return <ImageUploadField label={field.label} name={field.name} defaultKey={str || null} help={field.help} error={error} />;
    case "datetime":
      return <TextField label={field.label} name={field.name} type="datetime-local" defaultValue={str} help={field.help} error={error} />;
    case "money":
      return <TextField label={field.label} name={field.name} inputMode="decimal" defaultValue={typeof value === "number" ? value.toFixed(3).replace(/\.?0+$/, "") : str} required={field.required} placeholder={field.placeholder ?? "0.000"} help={field.help} error={error} autoComplete="off" />;
    case "integer":
      return <TextField label={field.label} name={field.name} type="number" step={1} min={field.min} max={field.max} defaultValue={str} required={field.required} placeholder={field.placeholder} help={field.help} error={error} />;
    default:
      return <TextField label={field.label} name={field.name} defaultValue={str} required={field.required} maxLength={field.maxLength} placeholder={field.placeholder} help={field.help} error={error} autoComplete="off" />;
  }
}

function EntityForm({ entity, row, onDone }: { entity: ClientEntity; row: EntityRow | null; onDone: () => void }) {
  const [state, action] = useActionState(saveEntityAction.bind(null, entity.key, row?.id ?? null), initial);

  const initialValues = useMemo(() => {
    const v: Record<string, RowValue> = {};
    for (const f of entity.fields) v[f.name] = row ? row.values[f.name] : defaultFor(f);
    return v;
  }, [entity.fields, row]);

  // Track the fields that other fields depend on (e.g. "applies to" -> product / category).
  const watched = useMemo(() => new Set(entity.fields.flatMap((f) => (f.showWhen ? [f.showWhen.field] : []))), [entity.fields]);
  const [watch, setWatch] = useState<Record<string, string>>(
    Object.fromEntries([...watched].map((n) => [n, String(initialValues[n] ?? "")])),
  );

  // React resets a form after its action finishes, and an uncontrolled <select>
  // goes back to its ORIGINAL option. Remounting the fields after every result
  // makes them start from the values the user submitted, and the "watched"
  // fields are re-synced so hidden / shown fields match what the selects show.
  const [seenState, setSeenState] = useState(state);
  const [round, setRound] = useState(0);
  if (state !== seenState) {
    setSeenState(state);
    setRound((r) => r + 1);
    if (state.values) setWatch((w) => ({ ...w, ...Object.fromEntries([...watched].map((n) => [n, state.values?.[n] ?? w[n]])) }));
  }

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="space-y-4"
      noValidate
      onChange={(e) => {
        const target = e.target as unknown as HTMLInputElement;
        if (watched.has(target.name)) setWatch((w) => ({ ...w, [target.name]: target.value }));
      }}
    >
      <FormAlert state={state} />
      <div key={round} className="grid gap-4 sm:grid-cols-2">
        {entity.fields.filter((f) => !f.readOnly).map((f) => {
          if (f.showWhen && watch[f.showWhen.field] !== f.showWhen.equals) return null;
          const wide = f.type === "textarea" || f.type === "image" || f.type === "checkbox";
          return (
            <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
              <FieldInput
                field={f}
                value={f.type === "checkbox" ? stickyChecked(state, f.name, initialValues[f.name] === true) : sticky(state, f.name, initialValues[f.name] === null || initialValues[f.name] === undefined ? "" : typeof initialValues[f.name] === "number" ? String(initialValues[f.name]) : String(initialValues[f.name]))}
                error={state.fieldErrors?.[f.name]}
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Saving...">{row ? "Save changes" : `Add ${entity.singular}`}</SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function CellValue({ entity, field, row }: { entity: ClientEntity; field: ClientField; row: EntityRow }) {
  const v = row.values[field.name];
  if (field.type === "checkbox") return v ? <span className="badge badge-ok">Yes</span> : <span className="badge badge-soft">No</span>;
  if (v === null || v === "") return <span className="text-ink/40">—</span>;
  if (field.type === "money") {
    // Coupons / discounts store a percentage or an amount depending on their type.
    if (field.name === "value" && entity.fields.some((f) => f.name === "type") && row.values.type === "percent") return <>{Number(v)}%</>;
    return <>{formatMoney(Number(v))}</>;
  }
  if (field.type === "select") return <>{field.options?.find((o) => o.value === String(v))?.label ?? String(v)}</>;
  if (field.type === "color") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-5 w-5 rounded-full border border-ink/20" style={{ background: String(v) }} />
        <span className="font-mono text-xs">{String(v)}</span>
      </span>
    );
  }
  if (field.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl(String(v), 400)} alt="" className="h-10 w-10 rounded-lg object-cover" />;
  }
  if (field.type === "textarea") return <span className="line-clamp-2 max-w-xs">{String(v)}</span>;
  return <>{String(v)}</>;
}

/** Table + add/edit form for one admin list. */
export function EntityManager({ entity, rows }: { entity: ClientEntity; rows: EntityRow[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const columns = entity.fields.filter((f) => f.inList && f.type !== "image");
  const imageField = entity.fields.find((f) => f.type === "image");
  const close = useMemo(() => () => setEditing(null), []);
  const editingRow = typeof editing === "number" ? rows.find((r) => r.id === editing) ?? null : null;

  return (
    <section aria-label={entity.title} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/70">{rows.length} {rows.length === 1 ? entity.singular : `${entity.singular}s`}</p>
        {editing === null && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Icon name="plus" className="h-4 w-4" /> Add {entity.singular}
          </button>
        )}
      </div>

      {editing === "new" && (
        <div className="card card-pad">
          <h3 className="mb-4 !text-2xl capitalize">New {entity.singular}</h3>
          <EntityForm entity={entity} row={null} onDone={close} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="alert alert-info">Nothing here yet. Use “Add {entity.singular}” to create the first one.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {imageField && <th scope="col" className="w-14"><span className="sr-only">Picture</span></th>}
                {columns.map((f) => <th key={f.name} scope="col">{f.label}</th>)}
                {entity.usageLabel && <th scope="col">{entity.usageLabel}</th>}
                {entity.hasActive && <th scope="col">Status</th>}
                <th scope="col" className="text-end"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isActive = row.values.isActive === true;
                return (
                  <tr key={row.id} className={editing === row.id ? "bg-primary/5" : undefined}>
                    {imageField && (
                      <td>
                        {row.values[imageField.name]
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={imageUrl(String(row.values[imageField.name]), 400)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          : <span className="block h-10 w-10 rounded-lg bg-primary/10" />}
                      </td>
                    )}
                    {columns.map((f) => (
                      <td key={f.name} className={f === columns[0] ? "font-semibold" : undefined}><CellValue entity={entity} field={f} row={row} /></td>
                    ))}
                    {entity.usageLabel && <td>{row.usage ?? 0}</td>}
                    {entity.hasActive && (
                      <td>
                        <form action={toggleEntityAction.bind(null, entity.key, row.id, !isActive)}>
                          <button type="submit" className={`badge ${isActive ? "badge-ok" : "badge-soft"} cursor-pointer`} title={isActive ? "Click to hide" : "Click to show"}>
                            {isActive ? "Active" : "Hidden"}
                          </button>
                        </form>
                      </td>
                    )}
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {entity.sortable && (
                          <>
                            <form action={moveEntityAction.bind(null, entity.key, row.id, "up")}>
                              <button type="submit" className="btn btn-ghost btn-sm !px-2" disabled={index === 0} aria-label="Move up"><Icon name="arrow-up" className="h-4 w-4" /></button>
                            </form>
                            <form action={moveEntityAction.bind(null, entity.key, row.id, "down")}>
                              <button type="submit" className="btn btn-ghost btn-sm !px-2" disabled={index === rows.length - 1} aria-label="Move down"><Icon name="arrow-down" className="h-4 w-4" /></button>
                            </form>
                          </>
                        )}
                        <button type="button" className="btn btn-soft btn-sm" onClick={() => setEditing(row.id)}>
                          <Icon name="edit" className="h-4 w-4" /> Edit
                        </button>
                        <form action={deleteEntityAction.bind(null, entity.key, row.id)}>
                          <ConfirmButton
                            message={`Delete this ${entity.singular}? This cannot be undone.${row.usage ? ` It is used by ${row.usage} ${(entity.usageLabel ?? "item").toLowerCase()}.` : ""}${entity.deleteHint ? ` ${entity.deleteHint}` : ""}`}
                            className="btn btn-danger btn-sm !px-2"
                            title={`Delete ${entity.singular}`}
                          >
                            <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Delete</span>
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingRow && (
        <div className="card card-pad">
          <h3 className="mb-4 !text-2xl capitalize">Edit {entity.singular}</h3>
          <EntityForm key={editingRow.id} entity={entity} row={editingRow} onDone={close} />
        </div>
      )}
    </section>
  );
}
