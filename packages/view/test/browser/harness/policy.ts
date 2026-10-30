// The board page's CSP as `board-host` computes it once from the manifest (AD-8, design decision
// 5): scripts and styles only by the hashes of the board page's code and of every view chunk,
// `connect-src 'self'` for the WebSocket, the view's media sources, which the srcdoc inherits,
// no base URL, form post or page framing the board (AD-11), and nothing else. `frame-src 'self'`
// is left out until the reading panel needs it (E5). `board-host` sends the same nine directives;
// once the contract's `boardPagePolicy` is merged, this copy goes (track-b-requests.md, 1).

import { cspHashSource, type ViewManifest } from "@askboard/contract";

const sources = (hashes: readonly string[]): string =>
  hashes.length === 0 ? "'none'" : [...new Set(hashes)].map(cspHashSource).join(" ");

/** The board page's policy: the board page's own hashes first, then the chunks' by name. */
export const boardPagePolicy = (manifest: ViewManifest): string => {
  const chunks = Object.entries(manifest.chunks)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, chunk]) => chunk);
  const scripts = [manifest.boardPage.script, ...chunks.map((chunk) => chunk.script)];
  const styles = [...manifest.boardPage.styles, ...chunks.flatMap((chunk) => chunk.styles)];
  return [
    "default-src 'none'",
    `script-src ${sources(scripts.map((file) => file.sha256))}`,
    `style-src ${sources(styles.map((file) => file.sha256))}`,
    "connect-src 'self'",
    "img-src data: blob:",
    "font-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
};

/** A policy's directives in order, each with its sources. */
export const parsePolicy = (policy: string): Map<string, string[]> =>
  new Map(
    policy
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name !== undefined && name !== "")
      .map(([name = "", ...values]) => [name, values]),
  );

/**
 * A policy's directives by name, each with its sources sorted: two policies that say the same
 * compare equal, whatever order `board-host` writes them in.
 */
export const policyDirectives = (policy: string): Record<string, string[]> =>
  Object.fromEntries(
    [...parsePolicy(policy)]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, sources]) => [name, [...sources].sort()]),
  );

// What the engines log when a policy blocks something. WebKit reports some blocks only in the
// console, among them a refused WebAssembly compile, so the console counts (renderer row 17).
const CSP_LINE = /Content Security Policy|Content-Security-Policy|Refused to/i;

/** Whether a console line reports something a CSP blocked. */
export const isCspConsoleLine = (text: string): boolean => CSP_LINE.test(text);
