// Board tokens never stay in what the benchmark keeps (early-benchmark design decision 11; AD-11):
// the token of a board link's `t=` parameter and of a `connect` message, plain or inside JSON that
// a transcript escapes once more. Tokens are base64url, at least 22 characters (contract).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const REDACTED = "<redacted>";

const TOKEN = "[A-Za-z0-9_-]{16,}";
const LINK_TOKEN = new RegExp(`([?&]t=)${TOKEN}`, "g");
// "token":"…", with the quotes escaped any number of times.
const MESSAGE_TOKEN = new RegExp(`(\\\\*"token\\\\*"\\s*:\\s*\\\\*")${TOKEN}`, "g");

export const redact = (text: string): string =>
  text.replace(LINK_TOKEN, `$1${REDACTED}`).replace(MESSAGE_TOKEN, `$1${REDACTED}`);

/** Redacts every file under a folder in place; returns how many files held a token. */
export const redactTree = (root: string): number =>
  readdirSync(root, { withFileTypes: true }).reduce((changed, entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return changed + redactTree(path);
    if (!entry.isFile()) return changed;
    const text = readFileSync(path, "utf8");
    const clean = redact(text);
    if (clean === text) return changed;
    writeFileSync(path, clean);
    return changed + 1;
  }, 0);
