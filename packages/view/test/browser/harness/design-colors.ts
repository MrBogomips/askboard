// DESIGN.md's colour tokens as a computed style reads them (DESIGN.md, Colors): each token's value
// in the light scheme, and its `-dark` value in the dark one, as `rgb(r, g, b)`.

import { join } from "node:path";

const design = await Bun.file(
  join(import.meta.dir, "../../../../../docs/ux-askboard-2026-10-27/DESIGN.md"),
).text();

const colors = (
  Bun.YAML.parse(/^---\n([\s\S]*?)\n---$/m.exec(design)?.[1] ?? "") as {
    colors: Record<string, string>;
  }
).colors;

/** A colour token's value in a scheme, as a computed style reads it: `rgb(r, g, b)`. */
export const tokenColor = (name: string, scheme: "light" | "dark"): string => {
  const hex = colors[scheme === "dark" ? `${name}-dark` : name];
  if (hex === undefined || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`DESIGN.md has no six-digit colour "${name}" in the ${scheme} scheme`);
  }
  const channels = (hex.slice(1).match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
  return `rgb(${channels.join(", ")})`;
};
