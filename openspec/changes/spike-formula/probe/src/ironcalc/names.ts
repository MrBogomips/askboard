// Criterion 6: AskBoard reference text -> an Excel defined name, injective and case-safe.
// AskBoard IDs are case-sensitive [A-Za-z0-9_-]{1,64}; Excel names are case-insensitive,
// start with a letter or "_", hold letters, digits, "_" and ".", must not read as an A1 or
// R1C1 reference, and are at most 255 characters. The encoding keeps lower-case letters,
// digits and ".", and escapes everything else behind "_", so the output has no upper-case
// letter (case cannot collide) and decoding is a function (injective). The "n_" prefix
// makes every name start with a letter and never read as a cell, R1C1, TRUE or a function.

export const NAME_PREFIX = "n_";
export const MAX_NAME_LENGTH = 255;

const ESCAPES: Readonly<Record<string, string>> = { _: "_0", "-": "_1", "*": "_2", ":": "_3" };
const UNESCAPES: Readonly<Record<string, string>> = { "0": "_", "1": "-", "2": "*", "3": ":" };

/** Encodes reference text (IDs, ".", "*", ":"); throws on a character outside that set. */
export function encodeName(text: string): string {
  let out = NAME_PREFIX;
  for (const c of text) {
    if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === ".") out += c;
    else if (c >= "A" && c <= "Z") out += `_${c.toLowerCase()}`;
    else {
      const e = ESCAPES[c];
      if (e === undefined) throw new Error(`character "${c}" cannot be encoded`);
      out += e;
    }
  }
  return out;
}

/** The inverse of encodeName, or null when the name is not one of its outputs. */
export function decodeName(name: string): string | null {
  if (!name.startsWith(NAME_PREFIX)) return null;
  let out = "";
  for (let i = NAME_PREFIX.length; i < name.length; i++) {
    const c = name[i] as string;
    if (c !== "_") {
      if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === ".")) return null;
      out += c;
      continue;
    }
    const next = name[++i];
    if (next === undefined) return null;
    if (next >= "a" && next <= "z") out += next.toUpperCase();
    else if (UNESCAPES[next] !== undefined) out += UNESCAPES[next];
    else return null;
  }
  return out;
}
