// The two policies of AD-8, as written in the spine on 2026-10-29. The board page's policy names
// no image or font source: the srcdoc inherits it, so a blocked `blob:` image or `data:` font is
// a finding for AD-8, not something this stand-in adds.
//
// A run may add named variants (`--variants`): each is a candidate amendment of AD-8, measured
// as input to a proposed outcome, and never part of the policy as written.

type Directives = Record<string, string[]>;

export const VARIANTS: Record<string, { view?: Directives; board?: Directives }> = {
  // The board page's policy allows `blob:` images, so the view's diagram images can load.
  "board-img-blob": { board: { "img-src": ["blob:"] } },
  // Both policies allow WebAssembly, for Graphviz in PlantUML's `viz-global.js`.
  wasm: {
    view: { "script-src": ["'wasm-unsafe-eval'"] },
    board: { "script-src": ["'wasm-unsafe-eval'"] },
  },
};

const sources = (hashes: readonly string[]): string[] =>
  hashes.length === 0 ? ["'none'"] : hashes.map((hash) => `'sha256-${hash}'`);

const serialize = (base: Directives, side: "view" | "board", variants: readonly string[]): string => {
  const directives: Directives = { ...base };
  for (const name of variants) {
    const variant = VARIANTS[name];
    if (!variant) throw new Error(`unknown policy variant ${name}`);
    for (const [directive, added] of Object.entries(variant[side] ?? {})) {
      const current = (directives[directive] ?? []).filter((source) => source !== "'none'");
      directives[directive] = [...added, ...current];
    }
  }
  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
};

export const viewPolicy = (
  scripts: readonly string[],
  styles: readonly string[],
  variants: readonly string[] = [],
): string =>
  serialize(
    {
      "default-src": ["'none'"],
      "script-src": sources(scripts),
      "style-src": sources(styles),
      "img-src": ["data:", "blob:"],
      "font-src": ["data:"],
      "connect-src": ["'none'"],
      "object-src": ["'none'"],
      "frame-src": ["'none'"],
      "form-action": ["'none'"],
      "base-uri": ["'none'"],
    },
    "view",
    variants,
  );

export const boardPolicy = (
  scripts: readonly string[],
  styles: readonly string[],
  variants: readonly string[] = [],
): string =>
  serialize(
    {
      "default-src": ["'none'"],
      "script-src": sources(scripts),
      "style-src": sources(styles),
      "connect-src": ["'self'"],
      "frame-src": ["'self'"],
    },
    "board",
    variants,
  );
