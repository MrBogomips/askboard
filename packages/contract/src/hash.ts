// The view manifest names each file's SHA-256 in lowercase hex, the chunk route's key. A CSP names
// the same digest in base64: `board-host` builds the board page's policy and `assemble` the
// view's from one conversion, written in plain ECMAScript so that every unit can run it.

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
