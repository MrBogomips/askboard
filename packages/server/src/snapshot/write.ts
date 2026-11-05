// Writing a Snapshot's file without ever overwriting one (snapshot design decision 6, open
// question B10). The bytes go to a dot-prefixed `.partial` file, created exclusively and synced,
// which is then hard-linked to the final name: `link` fails on an existing name, so no file is
// replaced, and an agent scanning the folder never sees a half-written Snapshot under its final
// name. A taken name draws another, up to five. Where the file system refuses hard links, the final
// name is created exclusively and written in place. The partial file is always removed.

import { join } from "node:path";
import { type Randomness, SnapshotWriteError } from "@askboard/core";
import { codeOf, failureLine, leftoverLine, type ReportLine } from "./diagnostics.ts";
import { fileSystemOf, type SnapshotFileHandle, type SnapshotFileSystem } from "./file-system.ts";
import { type SnapshotNames, snapshotNames } from "./name.ts";

/** One Snapshot's file: the folder's real path, what names it, and the assembled page. */
export type SnapshotFile = {
  readonly folder: string;
  readonly askId: string;
  /** RFC 3339 UTC, as the Snapshot data records it. */
  readonly takenAt: string;
  readonly html: string;
};

export type SnapshotFileOptions = {
  readonly randomness: Randomness;
  readonly report: ReportLine;
  readonly fs?: Partial<SnapshotFileSystem>;
};

/** What `link` answers where the file system has no hard links, or none across these folders. */
const LINK_REFUSED: ReadonlySet<string> = new Set(["EPERM", "ENOTSUP", "EXDEV"]);

/** The next name to try, or the error that ended the last try once every name is used. */
const nextName = (names: SnapshotNames, error: unknown): string => {
  const name = names.next();
  if (name === undefined) throw error;
  return name;
};

/** Writes and syncs the whole page, closing the file whatever happens. */
const writeAll = async (handle: SnapshotFileHandle, html: string): Promise<void> => {
  try {
    await handle.writeFile(html, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
};

/**
 * Creates the file `pathOf` gives for the first free name, exclusively, and writes the page into
 * it; a failed write removes it. The failure that ends the write is the one reported, so a failed
 * removal after it is not.
 */
const createExclusive = async (
  first: string,
  names: SnapshotNames,
  pathOf: (name: string) => string,
  html: string,
  fs: SnapshotFileSystem,
): Promise<{ readonly name: string; readonly path: string }> => {
  let name = first;
  for (;;) {
    const path = pathOf(name);
    let handle: SnapshotFileHandle;
    try {
      handle = await fs.open(path, "wx");
    } catch (error) {
      if (codeOf(error) !== "EEXIST") throw error;
      name = nextName(names, error);
      continue;
    }
    try {
      await writeAll(handle, html);
    } catch (error) {
      await fs.unlink(path).catch(() => undefined);
      throw error;
    }
    return { name, path };
  }
};

/** Links the complete partial file to the first free final name, or writes in place without links. */
const linkToFreeName = async (
  partial: string,
  first: string,
  names: SnapshotNames,
  { folder, html }: SnapshotFile,
  fs: SnapshotFileSystem,
): Promise<string> => {
  let name = first;
  for (;;) {
    const path = join(folder, name);
    try {
      await fs.link(partial, path);
      return path;
    } catch (error) {
      const code = codeOf(error);
      if (code === "EEXIST") {
        name = nextName(names, error);
        continue;
      }
      if (!LINK_REFUSED.has(code)) throw error;
      const inPlace = await createExclusive(name, names, (next) => join(folder, next), html, fs);
      return inPlace.path;
    }
  }
};

/**
 * Writes one Snapshot's file into its folder and gives the file's path. A malformed ask ID or time
 * throws a `RangeError` before any file-system call; any other failure leaves no file under a final
 * name, reports one line and rejects with a `SnapshotWriteError` naming the folder and the code.
 */
export const writeSnapshotFile = async (
  file: SnapshotFile,
  options: SnapshotFileOptions,
): Promise<string> => {
  const names = snapshotNames(file.askId, file.takenAt, options.randomness);
  const fs = fileSystemOf(options.fs);
  const partialOf = (name: string) => join(file.folder, `.${name}.partial`);
  let partial: { readonly name: string; readonly path: string } | undefined;
  let path: string;
  try {
    partial = await createExclusive(names.first, names, partialOf, file.html, fs);
    path = await linkToFreeName(partial.path, partial.name, names, file, fs);
  } catch (error) {
    if (partial !== undefined) await fs.unlink(partial.path).catch(() => undefined);
    const failure = SnapshotWriteError.inFolder(file.folder, codeOf(error), { cause: error });
    options.report(failureLine(failure));
    throw failure;
  }
  await fs.unlink(partial.path).catch((error: unknown) => {
    options.report(leftoverLine(file.folder, codeOf(error)));
  });
  return path;
};
