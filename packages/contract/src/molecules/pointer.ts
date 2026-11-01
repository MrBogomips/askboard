// RFC 6901 JSON Pointers, as a definition's fills write them (design decisions 2 and 3): the
// contract's checks resolve them in a composition, and `ask-core`'s fills write through them.
// A place is found through own properties only, so that no pointer reaches a prototype. Plain
// ECMAScript.

const ESCAPE = /~(?![01])/;
const INDEX = /^(0|[1-9][0-9]*)$/;

/** The reference tokens of a JSON Pointer, `~1` read as `/` and `~0` as `~`; `undefined` when it is none. */
export const pointerTokens = (pointer: string): readonly string[] | undefined => {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return undefined;
  const tokens = pointer.slice(1).split("/");
  if (tokens.some((token) => ESCAPE.test(token))) return undefined;
  return tokens.map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
};

/** The JSON Pointer of reference tokens: `~` written `~0` and `/` written `~1`. */
export const pointerOf = (tokens: readonly (string | number)[]): string =>
  tokens.map((token) => `/${String(token).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

export type Located = { readonly found: true; readonly value: unknown } | { readonly found: false };

const NOTHING: Located = { found: false };

/** The value a pointer's tokens name in `root`: an own key of an object, or an index a list has. */
export const valueAt = (root: unknown, tokens: readonly string[]): Located => {
  let value = root;
  for (const token of tokens) {
    if (Array.isArray(value)) {
      if (!INDEX.test(token) || Number(token) >= value.length) return NOTHING;
      value = value[Number(token)];
    } else if (typeof value === "object" && value !== null && Object.hasOwn(value, token)) {
      value = (value as Readonly<Record<string, unknown>>)[token];
    } else {
      return NOTHING;
    }
  }
  return { found: true, value };
};
