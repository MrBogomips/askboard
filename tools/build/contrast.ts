// The contrast and role report (palettes, design decision D10): WCAG 2 ratios of DESIGN.md's
// Contrast table and of the pairs the board's layout adds, for each palette and scheme, and the
// hue distances the colour role rules ask for. Pure and reporting: it names each pair under its
// minimum and each rule not met, and fails only on a pair naming a role a palette lacks.
// `bun tools/build/contrast.ts` prints the tables DESIGN.md's Contrast section takes.

import { PALETTES } from "@askboard/contract";
import { DESIGN_FILE } from "./paths.ts";
import { type DesignTokens, readDesignTokens } from "./tokens.ts";

export type Scheme = "light" | "dark";
export type PairKind = "text" | "mark";

const DARK = "-dark";

/** One pair: a foreground role on a background role, or on the lowest of a list of backgrounds. */
export type ContrastPair = {
  readonly name: string;
  readonly kind: PairKind;
  readonly foreground: string;
  readonly background: string | readonly string[];
};

const SURFACES = ["card", "diff-add", "diff-del"] as const;

/** DESIGN.md's Contrast table, row by row, then the pairs the board's layout adds. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { name: "Primary text / page", kind: "text", foreground: "foreground", background: "background" },
  { name: "Primary text / surface", kind: "text", foreground: "foreground", background: "card" },
  {
    name: "Secondary text / surface",
    kind: "text",
    foreground: "foreground-secondary",
    background: "card",
  },
  {
    name: "Muted text / page",
    kind: "text",
    foreground: "muted-foreground",
    background: "background",
  },
  {
    name: "Muted text / sunken",
    kind: "text",
    foreground: "muted-foreground",
    background: "muted",
  },
  { name: "Accent text / surface", kind: "text", foreground: "primary-text", background: "card" },
  {
    name: "Accent text / pressed fill",
    kind: "text",
    foreground: "primary-text",
    background: "primary-subtle",
  },
  {
    name: "On-accent / accent",
    kind: "text",
    foreground: "primary-foreground",
    background: "primary",
  },
  {
    name: "On-danger / danger",
    kind: "text",
    foreground: "destructive-foreground",
    background: "destructive",
  },
  {
    name: "Error text / surface",
    kind: "text",
    foreground: "destructive-text",
    background: "card",
  },
  { name: "Input border / surface", kind: "mark", foreground: "border-strong", background: "card" },
  { name: "Focus ring / surface", kind: "mark", foreground: "ring", background: "card" },
  {
    name: "Hover outline / surface",
    kind: "mark",
    foreground: "border-strong",
    background: "card",
  },
  { name: "Selected underline / track", kind: "mark", foreground: "primary", background: "muted" },
  { name: "Change line, pin / surface", kind: "mark", foreground: "change", background: "card" },
  {
    name: "Change text / change bg",
    kind: "text",
    foreground: "change-text",
    background: "change-subtle",
  },
  { name: "Pin label / pin", kind: "text", foreground: "change-foreground", background: "change" },
  {
    name: "Success text / subtle",
    kind: "text",
    foreground: "success-text",
    background: "success-subtle",
  },
  {
    name: "Danger text / subtle",
    kind: "text",
    foreground: "destructive-text",
    background: "destructive-subtle",
  },
  {
    name: "Warning text / subtle",
    kind: "text",
    foreground: "warning-text",
    background: "warning-subtle",
  },
  { name: "Warning mark / surface", kind: "mark", foreground: "warning", background: "card" },
  { name: "Info text / subtle", kind: "text", foreground: "info-text", background: "info-subtle" },
  {
    name: "Agent text / agent bg",
    kind: "text",
    foreground: "agent-text",
    background: "agent-subtle",
  },
  { name: "Agent dot / agent bg", kind: "mark", foreground: "agent", background: "agent-subtle" },
  {
    name: "Partly answered marker / surface",
    kind: "mark",
    foreground: "ask-partial",
    background: "card",
  },
  { name: "Critical path / surface", kind: "mark", foreground: "critical", background: "card" },
  {
    name: "Critical bar / task bar",
    kind: "mark",
    foreground: "foreground",
    background: "gantt-bar",
  },
  { name: "Text / diff added", kind: "text", foreground: "foreground", background: "diff-add" },
  { name: "Text / diff removed", kind: "text", foreground: "foreground", background: "diff-del" },
  {
    name: "Syntax keyword / surface, diff added, diff removed (lowest)",
    kind: "text",
    foreground: "syntax-keyword",
    background: SURFACES,
  },
  {
    name: "Syntax string (lowest of the three)",
    kind: "text",
    foreground: "syntax-string",
    background: SURFACES,
  },
  {
    name: "Syntax number (lowest of the three)",
    kind: "text",
    foreground: "syntax-number",
    background: SURFACES,
  },
  {
    name: "Syntax function (lowest of the three)",
    kind: "text",
    foreground: "syntax-function",
    background: SURFACES,
  },
  {
    name: "Syntax comment (lowest of the three)",
    kind: "text",
    foreground: "syntax-comment",
    background: SURFACES,
  },
  // The pairs the board's layout adds (answering-flow-visual's ledger, stripes and segments).
  { name: "Ledger count / surface", kind: "text", foreground: "success-text", background: "card" },
  { name: "Stripe, primary / surface", kind: "mark", foreground: "primary", background: "card" },
  { name: "Stripe, success / surface", kind: "mark", foreground: "success", background: "card" },
  {
    name: "Stripe, muted / surface",
    kind: "mark",
    foreground: "muted-foreground",
    background: "card",
  },
  {
    name: "Segment underline, primary / fill",
    kind: "mark",
    foreground: "primary",
    background: "primary-subtle",
  },
  {
    name: "Segment underline, success / fill",
    kind: "mark",
    foreground: "success",
    background: "success-subtle",
  },
  { name: "Border / sunken", kind: "mark", foreground: "border-strong", background: "muted" },
  { name: "Ring / page", kind: "mark", foreground: "ring", background: "background" },
  // The arrival mark's fill and edge (answer-moves-to-top, D6).
  {
    name: "Text / arrival fill",
    kind: "text",
    foreground: "foreground",
    background: "primary-subtle",
  },
  {
    name: "Secondary text / arrival fill",
    kind: "text",
    foreground: "foreground-secondary",
    background: "primary-subtle",
  },
  {
    name: "Muted text / arrival fill",
    kind: "text",
    foreground: "muted-foreground",
    background: "primary-subtle",
  },
  {
    name: "Arrival edge / fill",
    kind: "mark",
    foreground: "primary",
    background: "primary-subtle",
  },
];

// ---- colour arithmetic ----

type Rgb = readonly [number, number, number];

const channels = (hex: string): Rgb => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match?.[1] === undefined) throw new Error(`"${hex}" is not a #rrggbb colour`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const linear = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** The WCAG 2 contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export const contrastRatio = (a: string, b: string): number => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** A colour's OKLCh hue in degrees, 0 to 360. */
export const oklchHue = (hex: string): number => {
  const [r, g, b] = channels(hex).map(linear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
};

const hueDistance = (a: string, b: string): number => {
  const gap = Math.abs(oklchHue(a) - oklchHue(b));
  return Math.min(gap, 360 - gap);
};

// ---- palettes ----

/** One role's colour in a palette and scheme; aliases resolve to their target in the same scheme. */
export const roleValue = (
  tokens: DesignTokens,
  palette: string,
  scheme: Scheme,
  role: string,
): string => {
  const target = Object.hasOwn(tokens.aliases, role) ? tokens.aliases[role] : undefined;
  if (target !== undefined) return roleValue(tokens, palette, scheme, target);
  const key = scheme === "dark" ? `${role}${DARK}` : role;
  const source = palette === "carta" ? tokens.colors : tokens.palettes[palette];
  const value = source !== undefined && Object.hasOwn(source, key) ? source[key] : undefined;
  if (value === undefined) {
    throw new Error(`the palette "${palette}" has no role "${role}" in the ${scheme} scheme`);
  }
  return value;
};

/** The ratio a pair gives in a palette and scheme; the lowest over a list of backgrounds. */
export const pairRatio = (
  tokens: DesignTokens,
  palette: string,
  scheme: Scheme,
  pair: ContrastPair,
): number => {
  const foreground = roleValue(tokens, palette, scheme, pair.foreground);
  const backgrounds = typeof pair.background === "string" ? [pair.background] : pair.background;
  return Math.min(
    ...backgrounds.map((background) =>
      contrastRatio(foreground, roleValue(tokens, palette, scheme, background)),
    ),
  );
};

/** A pair's minimum: 4.5:1 text and 3:1 marks; Contrasto 7:1 and 4.5:1. */
export const minimumOf = (palette: string, kind: PairKind): number =>
  palette === "contrasto" ? (kind === "text" ? 7 : 4.5) : kind === "text" ? 4.5 : 3;

export type PairResult = {
  readonly palette: string;
  readonly scheme: Scheme;
  readonly pair: string;
  readonly kind: PairKind;
  readonly ratio: number;
  readonly minimum: number;
  readonly met: boolean;
};

const SCHEMES: readonly Scheme[] = ["light", "dark"];

/** Every pair for each palette and scheme, in the contract's palette order. */
export const contrastReport = (
  tokens: DesignTokens,
  palettes: readonly string[] = PALETTES,
): PairResult[] =>
  palettes.flatMap((palette) =>
    SCHEMES.flatMap((scheme) =>
      CONTRAST_PAIRS.map((pair): PairResult => {
        const ratio = pairRatio(tokens, palette, scheme, pair);
        const minimum = minimumOf(palette, pair.kind);
        return {
          palette,
          scheme,
          pair: pair.name,
          kind: pair.kind,
          ratio,
          minimum,
          met: ratio >= minimum,
        };
      }),
    ),
  );

export type RoleResult = {
  readonly palette: string;
  readonly scheme: Scheme;
  readonly rule: string;
  readonly degrees: number;
  readonly minimum: number;
  readonly met: boolean;
};

const ROLE_RULES: readonly [string, string, string, number][] = [
  ["agent to change", "agent", "change", 60],
  ["agent to primary", "agent", "primary", 20],
  ["change to primary", "change", "primary", 60],
];

/** The hue distances (OKLCh) the colour role rules ask for, for each palette and scheme. */
export const roleReport = (
  tokens: DesignTokens,
  palettes: readonly string[] = PALETTES,
): RoleResult[] =>
  palettes.flatMap((palette) =>
    SCHEMES.flatMap((scheme) =>
      ROLE_RULES.map(([rule, a, b, minimum]): RoleResult => {
        const degrees = hueDistance(
          roleValue(tokens, palette, scheme, a),
          roleValue(tokens, palette, scheme, b),
        );
        return { palette, scheme, rule, degrees, minimum, met: degrees >= minimum };
      }),
    ),
  );

/** The pairs under their minimum and the rules not met, one line each, for the test's output. */
export const reportLines = (tokens: DesignTokens): string[] => [
  ...contrastReport(tokens)
    .filter((result) => !result.met)
    .map(
      (r) =>
        `${r.palette} ${r.scheme}: ${r.pair} is ${r.ratio.toFixed(2)}:1, under ${r.minimum}:1 (${r.kind})`,
    ),
  ...roleReport(tokens)
    .filter((result) => !result.met)
    .map(
      (r) =>
        `${r.palette} ${r.scheme}: ${r.rule} is ${r.degrees.toFixed(0)} degrees, under ${r.minimum}`,
    ),
];

/** One palette's Markdown table: each pair with its kind and minimum, light and dark. */
export const contrastTable = (tokens: DesignTokens, palette: string): string => {
  const results = contrastReport(tokens, [palette]);
  const cell = (pair: string, scheme: Scheme) => {
    const result = results.find((r) => r.pair === pair && r.scheme === scheme);
    return result === undefined ? "" : result.ratio.toFixed(2);
  };
  const rows = CONTRAST_PAIRS.map((pair) => {
    const kind = pair.kind === "text" ? "text" : "UI mark";
    return `| ${pair.name} | ${kind}, ${minimumOf(palette, pair.kind)}:1 | ${cell(pair.name, "light")} | ${cell(pair.name, "dark")} |`;
  });
  return ["| Pair | Kind, minimum | Light | Dark |", "|---|---|---|---|", ...rows].join("\n");
};

if (import.meta.main) {
  const tokens = readDesignTokens(await Bun.file(DESIGN_FILE).text());
  for (const palette of PALETTES) {
    console.log(`#### ${palette[0]?.toUpperCase()}${palette.slice(1)}\n`);
    console.log(`${contrastTable(tokens, palette)}\n`);
  }
  const lines = reportLines(tokens);
  console.log(lines.length === 0 ? "Every pair meets its minimum." : lines.join("\n"));
}
