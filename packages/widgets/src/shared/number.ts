// AskBoard's own en-US number entry (EXPERIENCE, Input atoms; design decision 5): a widget reads
// a number typed in a text input, never the browser's number input, with an optional sign, digits
// with commas only between groups of three, and an optional decimal part. An ambiguous or
// malformed entry is refused with a reason the field error shows, and the parsed value is echoed.

export type NumberEntry =
  | { readonly kind: "number"; readonly value: number }
  /** Nothing typed: the field is empty. */
  | { readonly kind: "empty" }
  | { readonly kind: "refused"; readonly reason: string };

const EMPTY: NumberEntry = Object.freeze({ kind: "empty" });

const refused = (reason: string): NumberEntry => Object.freeze({ kind: "refused", reason });

const OTHER = /[^0-9,.+-]/;
const EXPONENT = /^[+-]?[0-9,.]+e[+-]?[0-9]+$/i;
const ONE_LEADING_SIGN = /^[+-]?[^+-]*$/;
const GROUPED = /^[1-9][0-9]{0,2}(,[0-9]{3})+$/;

// The first rule an entry breaks, in the order a reader would fix it.
const problemOf = (text: string): string | undefined => {
  if (EXPONENT.test(text)) return "Write the number in full, without an exponent.";
  const other = OTHER.exec(text);
  if (other !== null) return `"${other[0]}" is not part of a number: use digits, as in 1,234.5.`;
  if (!ONE_LEADING_SIGN.test(text)) return "Put at most one sign, before the digits.";
  if (!/[0-9]/.test(text)) return "Type digits, as in 1,234.5.";
  const [whole = "", ...decimals] = text.replace(/^[+-]/, "").split(".");
  if (decimals.length > 1) return "Use one decimal point at most.";
  if (whole === "" || decimals[0] === "") {
    return "Put digits on both sides of the decimal point, as in 0.5.";
  }
  if (decimals[0]?.includes(",") || (whole.includes(",") && !GROUPED.test(whole))) {
    return "Use commas only between groups of three digits, as in 1,234.5.";
  }
  return undefined;
};

/** Reads an en-US entry: a number, an empty field, or a refusal with its reason. */
export const parseNumber = (input: string): NumberEntry => {
  const text = input.trim();
  if (text === "") return EMPTY;
  const problem = problemOf(text);
  if (problem !== undefined) return refused(problem);
  const value = Number(text.replaceAll(",", ""));
  if (!Number.isFinite(value)) return refused("The number is too large.");
  // Minus zero is zero: the two are one JSON number.
  return Object.freeze({ kind: "number", value: value === 0 ? 0 : value });
};

const SCIENTIFIC = /^(-?)([0-9])(?:\.([0-9]+))?e([+-][0-9]+)$/;

/** A number as the parser reads it back: no grouping and no exponent, as in 1234.5. */
export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) throw new RangeError(`${value} is not a finite number`);
  const text = String(value);
  const scientific = SCIENTIFIC.exec(text);
  if (scientific === null) return text;
  const [, sign = "", first = "", rest = "", exponent = "0"] = scientific;
  const digits = `${first}${rest}`;
  const point = 1 + Number(exponent);
  // `String` writes an exponent only from 1e21 up and below 1e-6: the point is outside the digits.
  return point <= 0
    ? `${sign}0.${"0".repeat(-point)}${digits}`
    : `${sign}${digits}${"0".repeat(point - digits.length)}`;
};

/** The echo beside a number field: the value it holds, as in "= 1234.5". */
export const numberEcho = (value: number): string => `= ${formatNumber(value)}`;
