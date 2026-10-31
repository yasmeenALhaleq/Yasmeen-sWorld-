"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { imageUrl } from "@/lib/images";
import { normalizeHex } from "@/lib/palette";
import { checkImageFile, uploadImage } from "@/components/admin/uploads";

/** Colour picker + hex text box that stay in sync. Submits the hex under `name`. */
export function ColorField({
  label, name, defaultValue = "#9B5275", error, help,
}: { label: string; name: string; defaultValue?: string; error?: string; help?: string }) {
  const id = useId();
  const [text, setText] = useState(normalizeHex(defaultValue) ?? "#9B5275");
  const valid = normalizeHex(text);
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={valid ?? "#000000"}
          onChange={(e) => setText(e.target.value.toUpperCase())}
          className="h-11 w-14 cursor-pointer rounded-lg border border-ink/25 bg-surface p-1"
        />
        <input id={id} name={name} value={text} onChange={(e) => setText(e.target.value)} className="input max-w-36 font-mono uppercase"
          maxLength={7} aria-invalid={!valid || undefined} spellCheck={false} />
      </div>
      {help && !error && <p className="help">{help}</p>}
      {(error || !valid) && <p className="field-error" role="alert">{error || "Enter a colour like #9B5275."}</p>}
    </div>
  );
}

/** Single image: pick a file, it uploads straight away, the key is submitted with the form. */
export function ImageUploadField({
  label, name, defaultKey, help, error,
}: { label: string; name: string; defaultKey?: string | null; help?: string; error?: string }) {
  const [key, setKey] = useState<string>(defaultKey ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  async function onFile(file: File | undefined) {
    if (!file) return;
    const bad = checkImageFile(file);
    if (bad) { setProblem(bad); return; }
    setBusy(true);
    setProblem("");
    try {
      setKey((await uploadImage(file)).key);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input type="hidden" name={name} value={key} />
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink/30 bg-primary/5">
          {key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(key, 400)} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="upload" className="h-6 w-6 text-ink/40" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-soft btn-sm cursor-pointer" aria-disabled={busy}>
              {busy ? "Uploading..." : key ? "Replace" : "Choose picture"}
              <input id={id} ref={input} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {key && !busy && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKey("")}>Remove</button>
            )}
          </div>
          {help && <p className="help !mt-0">{help}</p>}
        </div>
      </div>
      {(problem || error) && <p className="field-error" role="alert">{problem || error}</p>}
    </div>
  );
}
