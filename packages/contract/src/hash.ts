// The view manifest names each file's SHA-256 in lowercase hex, the chunk route's key. A CSP names
// the same digest in base64: `board-host` builds the board page's policy and `assemble` the
// view's from one conversion, written in plain ECMAScript so that every unit can run it.

import type { ManifestFile, ViewManifest } from "./schemas/view-manifest/index.ts";

export const SHA256_HEX_PATTERN = "^[0-9a-f]{64}$";

const SHA256_HEX = new RegExp(SHA256_HEX_PATTERN);
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const base64 = (bytes: readonly number[]): string => {
  let text = "";
  for (let at = 0; at < bytes.length; at += 3) {
    const [a = 0, b = 0, c = 0] = bytes.slice(at, at + 3);
    const word = (a << 16) | (b << 8) | c;
    const left = bytes.length - at;
    text += BASE64[(word >> 18) & 63];
    text += BASE64[(word >> 12) & 63];
    text += left > 1 ? BASE64[(word >> 6) & 63] : "=";
    text += left > 2 ? BASE64[word & 63] : "=";
  }
  return text;
};

/** `'sha256-<base64>'` for a lowercase hex SHA-256, as a CSP `script-src` or `style-src` names it. */
export const cspHashSource = (sha256: string): string => {
  if (!SHA256_HEX.test(sha256)) {
    throw new Error(`not a SHA-256 in lowercase hex: ${JSON.stringify(sha256)}`);
  }
  const bytes = sha256.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? [];
  return `'sha256-${base64(bytes)}'`;
};

const hashSources = (files: readonly ManifestFile[]): string => {
  const sources = [...new Set(files.map((file) => cspHashSource(file.sha256)))];
  return sources.length === 0 ? "'none'" : sources.join(" ");
};

/**
 * The board page's Content-Security-Policy (AD-8, design decision 5): scripts and styles only by the
 * hashes of the board page's code and of every chunk the manifest lists, which the view's srcdoc
 * inherits; `connect-src 'self'` for its socket and its manifest and chunk fetches; the view's media
 * sources; nothing else. `frame-src 'self'` waits for the reading panel (E5). One rule for
 * `board-host` and the view's test server, so that the browser tests meet the policy the session
 * process sends.
 */
export const boardPagePolicy = (manifest: ViewManifest): string => {
  const chunks = Object.values(manifest.chunks);
  const scripts = [manifest.boardPage.script, ...chunks.map((chunk) => chunk.script)];
  const styles = [...manifest.boardPage.styles, ...chunks.flatMap((chunk) => chunk.styles)];
  return [
    "default-src 'none'",
    `script-src ${hashSources(scripts)}`,
    `style-src ${hashSources(styles)}`,
    "connect-src 'self'",
    "img-src data: blob:",
    "font-src data:",
  ].join("; ");
};
