// RFC 8785 (JSON Canonicalization Scheme) for the resend rule (AD-6): object keys sorted by their
// UTF-16 code units, recursively; arrays in order; strings, numbers and literals as ECMAScript's
// JSON writes them; no whitespace. Only JSON values: anything JSON cannot hold throws.

const fail = (what: string): never => {
  throw new TypeError(`RFC 8785: ${what} is not a JSON value`);
};

const scalar = (value: unknown): string => {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    // ECMAScript's Number serialization, which RFC 8785 adopts; -0 is written 0.
    return Number.isFinite(value) ? JSON.stringify(value) : fail(String(value));
  }
  return fail(typeof value);
};

export const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    // The default sort compares UTF-16 code units, as RFC 8785 asks.
    const keys = Object.keys(value).sort();
    const members = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`,
    );
    return `{${members.join(",")}}`;
  }
  return scalar(value);
};
