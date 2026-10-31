"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/ui/Icon";
import { imageUrl } from "@/lib/images";
import { checkImageFile, uploadImage } from "@/components/admin/uploads";

export interface GalleryImage {
  key: string;
  alt: string;
}

/**
 * Multiple product pictures: drop files (or click) to upload, drag thumbnails
 * to reorder, first picture = main picture. Buttons offer the same actions for
 * keyboard and touch users.
 */
export function ImageGalleryEditor({
  images, setImages, max = 12,
}: { images: GalleryImage[]; setImages: Dispatch<SetStateAction<GalleryImage[]>>; max?: number }) {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | File[]) {
    const files = [...list];
    const room = max - images.length - pending;
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const bad = checkImageFile(file);
      if (bad) problems.push(`${file.name}: ${bad}`);
      else accepted.push(file);
    }
    if (accepted.length > room) problems.push(`Only ${max} pictures are allowed per product.`);
    const toUpload = accepted.slice(0, Math.max(room, 0));

    setErrors(problems);
    setPending((n) => n + toUpload.length);
    // Upload a few at a time so a big batch does not flood the server.
    const queue = [...toUpload];
    const worker = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          const { key } = await uploadImage(file);
          setImages((prev) => [...prev, { key, alt: "" }]);
        } catch (err) {
          setErrors((prev) => [...prev, `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`]);
        } finally {
          setPending((n) => n - 1);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (input.current) input.current.value = "";
  }

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropActive(true); }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            setDropActive(false);
            void addFiles(e.dataTransfer.files);
          }
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
          dropActive ? "border-primary bg-primary/10" : "border-ink/25 bg-primary/[0.03]"
        }`}
      >
        <Icon name="upload" className="h-7 w-7 text-primary" />
        <p className="text-sm font-semibold">Drag pictures here, or</p>
        <label className="btn btn-soft btn-sm cursor-pointer">
          Choose pictures
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
        </label>
        <p className="help !mt-0">JPG, PNG or WebP up to 12 MB each. They are resized and compressed automatically.</p>
      </div>

      {errors.length > 0 && (
        <ul className="alert alert-error list-disc ps-8" role="alert">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {(images.length > 0 || pending > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Product pictures">
          {images.map((img, i) => (
            <li
              key={img.key}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
              onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); setOverIndex(i); } }}
              onDrop={(e) => { if (dragIndex !== null) { e.preventDefault(); move(dragIndex, i); } setDragIndex(null); setOverIndex(null); }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              className={`card overflow-hidden transition ${overIndex === i && dragIndex !== i ? "ring-2 ring-primary" : ""} ${dragIndex === i ? "opacity-50" : ""}`}
            >
              <div className="relative aspect-square cursor-grab bg-primary/5 active:cursor-grabbing">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(img.key, 400)} alt={img.alt || `Product picture ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                {i === 0 && <span className="badge absolute start-2 top-2 bg-primary text-on-primary">Main</span>}
              </div>
              <div className="space-y-2 p-2">
                <input
                  className="input !min-h-9 !px-3 !py-1.5 !text-sm"
                  placeholder="Describe the picture"
                  aria-label={`Description of picture ${i + 1}`}
                  maxLength={200}
                  value={img.alt}
                  onChange={(e) => setImages((prev) => prev.map((p, idx) => (idx === i ? { ...p, alt: e.target.value } : p)))}
                />
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex gap-0.5">
                    <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier"><Icon name="chevron-left" className="h-4 w-4" /></button>
                    <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label="Move later"><Icon name="chevron-right" className="h-4 w-4" /></button>
                  </div>
                  {i !== 0 && <button type="button" className="btn btn-soft btn-sm" onClick={() => move(i, 0)}>Make main</button>}
                  <button type="button" className="btn btn-danger btn-sm !px-2" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove picture"><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <li key={`pending-${i}`} className="card flex aspect-square items-center justify-center bg-primary/5" aria-label="Uploading">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
