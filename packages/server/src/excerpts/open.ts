// Opening and reading, steps 4 and 5 of design decision 3 (proposal B3; board-host spec, Only
// regular files are read). The real path's own stats are taken first, and anything but a regular
// file is refused before it is opened, so no FIFO, socket or device is ever opened through it.
// The open follows no final link and never blocks, and the handle's device and inode must be
// those the real path named, so a file swapped between the real path and the open is refused.
// A folder swapped for a symlink in that window is the residual race (design, Risks).

import { constants } from "node:fs";
import type { SourceFs, SourceHandle } from "./fs.ts";
import { isRefused, type Refused, refusedBy, systemCode, unless } from "./refused.ts";

/** Read-only, no final link followed, and no wait on a FIFO swapped in. */
export const OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

// How much one read takes after the first, which asks for the whole file as its stats give it.
const READ_CHUNK_BYTES = 64 * 1024;

/** An open regular file, the one its real path named, and its size when opened. */
export type RegularFile = { readonly handle: SourceHandle; readonly size: number };

// A final link where the real path had none was swapped in after it was taken: refused as outside.
const openRefusal = (error: unknown): Refused =>
  refusedBy(error, systemCode(error) === "ELOOP" ? "outside-root" : "not-found");

/**
 * Opens the file at `realPath` when it is a regular file, runs `use` on it and closes it, whatever
 * `use` gives or throws.
 */
export const withRegularFile = async <T>(
  fs: SourceFs,
  realPath: string,
  use: (file: RegularFile) => Promise<T | Refused>,
): Promise<T | Refused> => {
  const named = await unless(() => fs.lstat(realPath), "not-found");
  if (isRefused(named)) return named;
  if (!named.isFile()) return { refused: "not-a-file" };
  let handle: SourceHandle;
  try {
    handle = await fs.open(realPath, OPEN_FLAGS);
  } catch (error) {
    return openRefusal(error);
  }
  try {
    const opened = await unless(() => handle.stat(), "not-found");
    if (isRefused(opened)) return opened;
    if (opened.dev !== named.dev || opened.ino !== named.ino) return { refused: "outside-root" };
    if (!opened.isFile()) return { refused: "not-a-file" };
    return await use({ handle, size: Number(opened.size) });
  } finally {
    await handle.close();
  }
};

const joined = (chunks: readonly Uint8Array[], total: number): Uint8Array => {
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
};

/**
 * The file's bytes, or `too-large` when it holds more than `limit`: refused from its size alone,
 * or, for a file that grows while read or has no size, after reading at most `limit + 1` bytes.
 */
export const readAtMost = async (
  { handle, size }: RegularFile,
  limit: number,
): Promise<Uint8Array | Refused> => {
  if (size > limit) return { refused: "too-large" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total <= limit) {
      const wanted = total === 0 ? size + 1 : READ_CHUNK_BYTES;
      const buffer = new Uint8Array(Math.min(wanted, limit + 1 - total));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, total);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
  } catch (error) {
    return refusedBy(error, "not-found");
  }
  return total > limit ? { refused: "too-large" } : joined(chunks, total);
};
