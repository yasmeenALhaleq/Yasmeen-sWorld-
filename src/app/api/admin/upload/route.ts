import { NextResponse } from "next/server";
import { assertAdmin, UnauthorizedError } from "@/server/auth/session";
import { isSameOrigin } from "@/server/request";
import { allow } from "@/server/rate-limit";
import { ImageError, MAX_UPLOAD_BYTES, saveImage, saveLogo } from "@/server/services/images";
import { imageUrl, logoUrl } from "@/lib/images";

// Admin-only image upload. Images are compressed, resized and re-encoded by
// sharp (see services/images.ts) before anything is stored.
//   POST /api/admin/upload?kind=image   -> { key, url }
//   POST /api/admin/upload?kind=logo    -> { key, url }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let admin;
  try {
    admin = await assertAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    throw err;
  }
  if (!allow(`upload:${admin.adminId}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many uploads. Please wait a moment." }, { status: 429 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 512 * 1024) {
    return NextResponse.json({ error: "The image is larger than 12 MB." }, { status: 413 });
  }

  const kind = new URL(request.url).searchParams.get("kind") === "logo" ? "logo" : "image";
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (kind === "logo") {
      const { key } = await saveLogo(buffer);
      return NextResponse.json({ key, url: logoUrl(key) });
    }
    const { key } = await saveImage(buffer);
    return NextResponse.json({ key, url: imageUrl(key, 400) });
  } catch (err) {
    if (err instanceof ImageError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[upload] failed:", err);
    return NextResponse.json({ error: "The image could not be processed." }, { status: 500 });
  }
}
