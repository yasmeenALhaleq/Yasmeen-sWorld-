// Serializable description of an admin "entity" (categories, coupons ...).
// The server builds one of these per page and hands it to <EntityManager/>.

export type FieldType =
  | "text" | "textarea" | "money" | "integer" | "checkbox" | "select" | "color" | "image" | "datetime";

export interface FieldOption {
  value: string;
  label: string;
}

export interface ClientField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  nullable?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: FieldOption[];
  defaultValue?: string | number | boolean | null;
  /** Only show (and require) this field when another field has a given value. */
  showWhen?: { field: string; equals: string };
  /** Show this column in the list table. */
  inList?: boolean;
  /** The field cannot be edited (e.g. a usage counter). */
  readOnly?: boolean;
}

export interface ClientEntity {
  key: string;
  title: string;
  singular: string;
  description?: string;
  fields: ClientField[];
  sortable: boolean;
  hasActive: boolean;
  /** Label for the usage column, e.g. "Products". */
  usageLabel?: string;
  /** Text used in the delete confirmation. */
  deleteHint?: string;
}

export type RowValue = string | number | boolean | null;

export interface EntityRow {
  id: number;
  usage?: number;
  values: Record<string, RowValue>;
}

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What the user typed, sent back with an error. React clears uncontrolled
   * form fields once an action finishes, so forms use this as their defaults
   * to keep the user's input. Passwords are never echoed.
   */
  values?: Record<string, string>;
}

/** Picks the submitted value after an error, falling back to the initial one. */
export function sticky(state: ActionState, name: string, fallback: string): string {
  return state.values && name in state.values ? state.values[name] : fallback;
}

/** Same for checkboxes: an unchecked box is absent from the submitted values. */
export function stickyChecked(state: ActionState, name: string, fallback: boolean): boolean {
  return state.values ? name in state.values : fallback;
}
