import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";
import { UPLOAD_FILE_PATTERN } from "@/lib/images";

// Serves uploaded images from the upload folder. Files are named after a random
// key and never change, so they can be cached forever. Only filenames matching
// the exact pattern are served, which also rules out path traversal.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!UPLOAD_FILE_PATTERN.test(file)) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(env.uploadDir, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.endsWith(".png") ? "image/png" : "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
