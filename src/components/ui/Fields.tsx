"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ActionState } from "@/lib/entity-types";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">;

interface FieldBase {
  label: string;
  name: string;
  error?: string;
  help?: string;
}

/** Label + input + help + error message, wired together for screen readers. */
export function TextField({ label, name, error, help, required, className = "", ...rest }: FieldBase & InputProps) {
  const id = useId();
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-800" aria-hidden="true"> *</span>}
      </label>
      <input id={id} name={name} required={required} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {help && !error && <p id={`${id}-help`} className="help">{help}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function PasswordField({ label, name, error, help, required, ...rest }: FieldBase & InputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-800" aria-hidden="true"> *</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          required={required}
          type={visible ? "text" : "password"}
          className="input pe-12"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-ink/60 hover:text-ink"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          <Icon name={visible ? "eye-off" : "eye"} />
        </button>
      </div>
      {help && !error && <p id={`${id}-help`} className="help">{help}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function TextAreaField({
  label, name, error, help, required, className = "", ...rest
}: FieldBase & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> & { className?: string }) {
  const id = useId();
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-800" aria-hidden="true"> *</span>}
      </label>
      <textarea id={id} name={name} required={required} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {help && !error && <p id={`${id}-help`} className="help">{help}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function SelectField({
  label, name, error, help, required, children, className = "", ...rest
}: FieldBase & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const id = useId();
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-800" aria-hidden="true"> *</span>}
      </label>
      <select id={id} name={name} required={required} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest}>
        {children}
      </select>
      {help && !error && <p id={`${id}-help`} className="help">{help}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function CheckboxField({
  label, name, help, defaultChecked, ...rest
}: { label: string; name: string; help?: string; defaultChecked?: boolean } & Omit<InputProps, "type" | "defaultChecked">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm font-semibold">
        <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="checkbox mt-0.5" {...rest} />
        <span>
          {label}
          {help && <span className="help block font-normal">{help}</span>}
        </span>
      </label>
    </div>
  );
}

/** Shows the error / success message returned by a form action. */
export function FormAlert({ state }: { state: ActionState }) {
  if (state.error) return <p className="alert alert-error" role="alert">{state.error}</p>;
  if (state.message) return <p className="alert alert-success" role="status">{state.message}</p>;
  return null;
}
