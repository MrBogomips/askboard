// The view build `board-host` serves (design decision 7): the manifest the view build wrote, every
// file it names read once and checked against its digest and size, and the board page's policy
// computed once from it by the contract's rule, which the view's test server shares (AD-8).

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BOARD_RESPONSES,
  boardPagePolicy,
  type ManifestFile,
  VIEW_MANIFEST_FILE,
  type ViewManifest,
} from "@askboard/contract";
import { validateViewManifest } from "@askboard/contract/validate";

/** A chunk's script or style as `/c/` serves it. */
export type ChunkFile = { readonly body: Buffer; readonly contentType: string };

export type LoadedView = {
  /** The manifest file's bytes, as the view build wrote them. */
  readonly manifest: Buffer;
  /** The board page as served, its script and styles inline. */
  readonly boardPage: Buffer;
  /** The board page's Content-Security-Policy: the contract's `boardPagePolicy` of the manifest. */
  readonly policy: string;
  /** Every chunk's script and styles, by SHA-256 in lowercase hex. */
  readonly chunks: ReadonlyMap<string, ChunkFile>;
};

export type ViewBuildCode =
  | "VIEW_MANIFEST_UNREADABLE"
  | "VIEW_MANIFEST_INVALID"
  | "VIEW_FILE_INVALID";

/** The view build cannot be served; no board opens without it. */
export class ViewBuildError extends Error {
  override readonly name = "ViewBuildError";
  readonly code: ViewBuildCode;
  constructor(code: ViewBuildCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const readManifest = async (folder: string): Promise<{ bytes: Buffer; manifest: ViewManifest }> => {
  let bytes: Buffer;
  try {
    bytes = await readFile(resolve(folder, VIEW_MANIFEST_FILE));
  } catch (error) {
    throw new ViewBuildError("VIEW_MANIFEST_UNREADABLE", `cannot read ${VIEW_MANIFEST_FILE}`, {
      cause: error,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ViewBuildError("VIEW_MANIFEST_INVALID", `${VIEW_MANIFEST_FILE} is not JSON`);
  }
  const checked = validateViewManifest(parsed);
  if (!checked.ok) {
    const [first] = checked.problems;
    const where = first === undefined ? "" : `: ${first.path} ${first.message}`;
    throw new ViewBuildError("VIEW_MANIFEST_INVALID", `${VIEW_MANIFEST_FILE} is invalid${where}`);
  }
  return { bytes, manifest: checked.value };
};

// A listed file, checked against its size and digest. The manifest schema's path pattern admits no
// segment that starts with a dot, so a listed path stays inside the folder.
const readListed = async (folder: string, file: ManifestFile): Promise<Buffer> => {
  let bytes: Buffer;
  try {
    bytes = await readFile(resolve(folder, file.path));
  } catch {
    throw new ViewBuildError("VIEW_FILE_INVALID", `cannot read ${file.path}`);
  }
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
    throw new ViewBuildError("VIEW_FILE_INVALID", `${file.path} does not match the manifest`);
  }
  return bytes;
};

// The board page holds its script and styles inline: their hashes in the policy are theirs only
// if the page holds them exactly.
const checkInline = (page: Buffer, inline: readonly Buffer[]): void => {
  for (const part of inline) {
    if (!page.includes(part)) {
      throw new ViewBuildError(
        "VIEW_FILE_INVALID",
        "the board page does not hold its script and styles inline",
      );
    }
  }
};

/** Reads and checks the view build in `folder`; any problem throws a `ViewBuildError`. */
export const loadView = async (folder: string): Promise<LoadedView> => {
  const root = resolve(folder);
  const { bytes, manifest } = await readManifest(root);
  const { boardPage } = manifest;
  const page = await readListed(root, boardPage.html);
  const inline = await Promise.all(
    [boardPage.script, ...boardPage.styles].map((file) => readListed(root, file)),
  );
  checkInline(page, inline);
  const chunks = new Map<string, ChunkFile>();
  for (const chunk of Object.values(manifest.chunks)) {
    const listed = [
      { file: chunk.script, contentType: BOARD_RESPONSES.script.contentType },
      ...chunk.styles.map((file) => ({ file, contentType: BOARD_RESPONSES.style.contentType })),
    ];
    for (const { file, contentType } of listed) {
      chunks.set(file.sha256, { body: await readListed(root, file), contentType });
    }
  }
  return { manifest: bytes, boardPage: page, policy: boardPagePolicy(manifest), chunks };
};
