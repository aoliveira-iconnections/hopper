import { mkdir, unlink } from "node:fs/promises";
import { createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? "/app/uploads";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_REQUEST = 5;

export const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/json",
]);

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/json": "json",
};

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function makeStorageKey(bugId: number, mime: string): string {
  const ext = MIME_EXT[mime] ?? "bin";
  return path.posix.join("bugs", String(bugId), `${randomUUID()}.${ext}`);
}

export function absolutePath(storageKey: string): string {
  // storageKey is always relative (we control its construction).
  return path.join(UPLOAD_ROOT, storageKey);
}

export async function writeStreamToStorage(
  storageKey: string,
  source: Readable,
): Promise<void> {
  const dest = absolutePath(storageKey);
  await mkdir(path.dirname(dest), { recursive: true });
  let out: WriteStream | undefined;
  try {
    out = createWriteStream(dest);
    await pipeline(source, out);
  } catch (err) {
    if (out) out.destroy();
    // Best-effort cleanup of any partial file.
    await unlink(dest).catch(() => {});
    throw err;
  }
}

export async function deleteStorageFile(storageKey: string): Promise<void> {
  await unlink(absolutePath(storageKey)).catch(() => {});
}
