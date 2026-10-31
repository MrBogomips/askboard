// Loading the view (design decision 8, AD-9): the manifest from `/m`, then the sources of the
// chunks the board needs, each by its hash from `/c/<sha256>`, every request with the token header
// (AD-11), and `assemble` builds the srcdoc. The view's CSP admits each source only by the hash the
// manifest gives it (AD-8), and `assemble` checks each source's size. The board page cannot compile
// the manifest's schema under its own CSP: it checks the version and the shape it reads.

import {
  BOARD_TOKEN_HEADER,
  chunkPath,
  manifestPath,
  unsupportedVersion,
  VIEW_MANIFEST_VERSION,
  type ViewManifest,
} from "@askboard/contract";
import { type Assembled, assemble, selectChunks, sourcesToFetch } from "../assemble/index.ts";
import type { BootData } from "../boot-data.ts";

/** A GET of a board route, answering its status and its text. */
export type FetchText = (
  url: string,
  headers: Readonly<Record<string, string>>,
) => Promise<{ readonly status: number; readonly text: string }>;

/** `fetch` on the board page's origin: same-origin routes, no credentials (AD-20). */
export const fetchText: FetchText = async (url, headers) => {
  const response = await fetch(url, { headers, credentials: "omit", cache: "no-store" });
  return { status: response.status, text: await response.text() };
};

const VIEW_MANIFEST = { title: "view manifest", version: VIEW_MANIFEST_VERSION };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readManifest = (text: string): ViewManifest => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("the view manifest is not JSON");
  }
  if (!isRecord(value)) throw new Error("the view manifest is not a JSON object");
  const unsupported = unsupportedVersion(VIEW_MANIFEST, value.version);
  if (unsupported !== undefined) throw new Error(unsupported);
  if (!isRecord(value.chunks)) throw new Error("the view manifest lists no chunks");
  return value as ViewManifest;
};

/** The view's srcdoc for the board, from the manifest and the chunk sources `board-host` serves. */
export const loadView = async (
  data: BootData,
  token: string,
  get: FetchText = fetchText,
): Promise<Assembled> => {
  const headers = { [BOARD_TOKEN_HEADER]: token };
  const text = async (url: string): Promise<string> => {
    const response = await get(url, headers);
    if (response.status !== 200) throw new Error(`${url} answered ${response.status}`);
    return response.text;
  };
  const manifest = readManifest(await text(manifestPath()));
  const files = sourcesToFetch(selectChunks(data.document, manifest));
  const texts = await Promise.all(files.map((file) => text(chunkPath(file.sha256))));
  const sources = Object.fromEntries(files.map((file, index) => [file.sha256, texts[index] ?? ""]));
  return assemble(data, manifest, sources);
};
