// The `SourceFiles` adapter (excerpts, design decision 3): each operation runs the steps in order,
// confinement (`confine.ts`), the open and the read (`open.ts`), then decoding and the anchor
// (`text.ts`, `image.ts`, `anchor.ts`). With no project root, every pointer is `no-root`, whatever
// root the call names, and the file system is never called: the composition passes the real path
// of `CLAUDE_PROJECT_DIR` or nothing, and this is the second guard behind ask-core's (XC-A1).
// The budget and the bound on reads at once are ask-core's, so the adapter stays plain.

import { isAbsolute } from "node:path";
import {
  ANCHOR_FILE_MAX_BYTES,
  IMAGE_MAX_BYTES,
  type LineRange,
  SOURCE_VIEW_MAX_BYTES,
  SOURCE_VIEW_MAX_LINES,
  type UnresolvedReason,
} from "@askboard/contract";
import type {
  EditorTarget,
  ExcerptResolution,
  ImageResolution,
  ReferenceResolution,
  SourceFiles,
  SourceState,
  SourceText,
  SourceUnavailable,
  UnresolvedPointer,
} from "@askboard/core";
import { excerptOf, findAnchor } from "./anchor.ts";
import { type AnchorRule, type Located, locate } from "./confine.ts";
import { nodeSourceFs, type SourceFs } from "./fs.ts";
import { imageMediaTypeOf } from "./image.ts";
import { type RegularFile, readAtMost, withRegularFile } from "./open.ts";
import { isRefused, type Refused } from "./refused.ts";
import { decodeText, splitLines, textMediaTypeOf } from "./text.ts";

export type SourceFilesOptions = {
  /** The real path of `CLAUDE_PROJECT_DIR`, or undefined when the session has no project root. */
  readonly projectRoot: string | undefined;
  readonly fs?: SourceFs;
};

const unresolved = (reason: UnresolvedReason): UnresolvedPointer => ({
  status: "unresolved",
  reason,
});

// The reading panel's lines: "not available" for a file missing or outside the root, "cannot be
// shown as text" for one that is not a regular text file.
const unavailable = (reason: UnresolvedReason): SourceUnavailable => {
  if (reason === "outside-root") return { status: "outside-root" };
  if (reason === "not-a-file" || reason === "not-text") return { status: "not-text" };
  return { status: "missing" };
};

// How much of a file's start tells whether it is text: no NUL byte and valid UTF-8, a character
// cut at the end of the prefix allowed.
const TEXT_PROBE_BYTES = 8192;
const PROBE_DECODER = new TextDecoder("utf-8", { fatal: true });

const looksLikeText = async ({ handle, size }: RegularFile): Promise<boolean> => {
  const buffer = new Uint8Array(Math.min(size, TEXT_PROBE_BYTES));
  try {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const prefix = buffer.subarray(0, bytesRead);
    if (prefix.includes(0)) return false;
    PROBE_DECODER.decode(prefix, { stream: true });
    return true;
  } catch {
    // Invalid UTF-8 (a TypeError), or a read that failed: not a file to hand to an editor.
    return false;
  }
};

/** The lines of a regular file read up to `limit`, or why not. */
const linesOf = async (file: RegularFile, limit: number): Promise<string[] | Refused> => {
  const bytes = await readAtMost(file, limit);
  if (isRefused(bytes)) return bytes;
  const text = decodeText(bytes);
  return text === undefined ? { refused: "not-text" } : splitLines(text);
};

const anchorIn = (located: Located, lines: readonly string[]): LineRange | undefined => {
  const anchor = located.pointer.anchor;
  if (anchor === undefined) return undefined;
  return findAnchor(lines, anchor, textMediaTypeOf(located.realPath) === "text/markdown");
};

type Source =
  | { readonly status: "available"; readonly lines: readonly string[]; readonly hit?: LineRange }
  | SourceUnavailable;

// A source as the source view shows it, within its own limits.
const sourceFrom = async (fs: SourceFs, located: Located): Promise<Source> => {
  const source = await withRegularFile<Source>(fs, located.realPath, async (file) => {
    const lines = await linesOf(file, SOURCE_VIEW_MAX_BYTES);
    if (isRefused(lines)) {
      if (lines.refused !== "too-large") return lines;
      return { status: "too-large", size: Math.max(file.size, SOURCE_VIEW_MAX_BYTES + 1) };
    }
    if (lines.length > SOURCE_VIEW_MAX_LINES) return { status: "too-large", size: file.size };
    const hit = anchorIn(located, lines);
    return { status: "available", lines, ...(hit === undefined ? {} : { hit }) };
  });
  return isRefused(source) ? unavailable(source.refused) : source;
};

/** The `SourceFiles` port over this machine's file system. */
export const createSourceFiles = ({
  projectRoot,
  fs = nodeSourceFs,
}: SourceFilesOptions): SourceFiles => {
  const rooted = projectRoot !== undefined && isAbsolute(projectRoot);
  const find = (root: string, pointer: string, rule?: AnchorRule) =>
    locate(fs, rooted ? root : undefined, pointer, rule);

  const inspect = async (root: string, pointer: string): Promise<Source> => {
    const located = await find(root, pointer);
    return isRefused(located) ? unavailable(located.refused) : sourceFrom(fs, located);
  };

  return {
    resolveExcerpt: async (root, pointer): Promise<ExcerptResolution> => {
      const located = await find(root, pointer, "required");
      if (isRefused(located)) return unresolved(located.refused);
      const result = await withRegularFile<ExcerptResolution>(
        fs,
        located.realPath,
        async (file) => {
          const lines = await linesOf(file, ANCHOR_FILE_MAX_BYTES);
          if (isRefused(lines)) return lines;
          const range = anchorIn(located, lines);
          if (range === undefined) return { refused: "anchor-not-found" };
          const excerpt = excerptOf(lines, range);
          if (isRefused(excerpt)) return excerpt;
          const mediaType = textMediaTypeOf(located.realPath);
          return { status: "resolved", text: excerpt.text, mediaType, lines: range };
        },
      );
      return isRefused(result) ? unresolved(result.refused) : result;
    },

    resolveImage: async (root, pointer): Promise<ImageResolution> => {
      const located = await find(root, pointer, "forbidden");
      if (isRefused(located)) return unresolved(located.refused);
      const result = await withRegularFile<ImageResolution>(fs, located.realPath, async (file) => {
        const bytes = await readAtMost(file, IMAGE_MAX_BYTES);
        if (isRefused(bytes)) return bytes;
        const mediaType = imageMediaTypeOf(bytes);
        if (mediaType === undefined) return { refused: "not-image" };
        const base64 = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return { status: "resolved", mediaType, bytes: base64.toString("base64") };
      });
      return isRefused(result) ? unresolved(result.refused) : result;
    },

    resolveReference: async (root, pointer): Promise<ReferenceResolution> => {
      const located = await find(root, pointer);
      if (isRefused(located)) return unresolved(located.refused);
      const result = await withRegularFile<ReferenceResolution>(
        fs,
        located.realPath,
        async (file) => {
          if (located.pointer.anchor === undefined) return { status: "resolved" };
          const lines = await linesOf(file, ANCHOR_FILE_MAX_BYTES);
          if (isRefused(lines)) return lines;
          const range = anchorIn(located, lines);
          return range === undefined
            ? { refused: "anchor-not-found" }
            : { status: "resolved", lines: range };
        },
      );
      return isRefused(result) ? unresolved(result.refused) : result;
    },

    sourceState: async (root, pointer, sentText): Promise<SourceState> => {
      const source = await inspect(root, pointer);
      if (source.status !== "available") return source;
      const { hit, lines } = source;
      const changed =
        sentText === undefined
          ? undefined
          : hit === undefined || lines.slice(hit.start - 1, hit.end).join("\n") !== sentText;
      return {
        status: "available",
        ...(hit === undefined ? {} : { line: hit.start }),
        ...(changed === undefined ? {} : { changed }),
      };
    },

    readSource: async (root, pointer): Promise<SourceText> => {
      const source = await inspect(root, pointer);
      if (source.status !== "available") return source;
      const text = source.lines.join("\n");
      return {
        status: "available",
        text,
        ...(source.hit === undefined ? {} : { hit: source.hit }),
      };
    },

    editorTarget: async (root, pointer): Promise<EditorTarget | undefined> => {
      const located = await find(root, pointer);
      if (isRefused(located)) return undefined;
      const target = await withRegularFile<EditorTarget>(fs, located.realPath, async (file) => {
        // Only a text file goes to the editor: a command such as `open` would launch any other
        // file by its association. A file past the source view's limit is still text.
        if (!(await looksLikeText(file))) return { refused: "not-text" };
        const lines =
          located.pointer.anchor === undefined
            ? undefined
            : await linesOf(file, ANCHOR_FILE_MAX_BYTES);
        const range =
          lines === undefined || isRefused(lines) ? undefined : anchorIn(located, lines);
        return { file: located.realPath, ...(range === undefined ? {} : { line: range.start }) };
      });
      return isRefused(target) ? undefined : target;
    },
  };
};
