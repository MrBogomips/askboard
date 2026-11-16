// The theme (EXPERIENCE.md, Dark theme and Board page or view): DESIGN.md's tokens are CSS
// variables that a `.dark` class on the document's root switches, which Tailwind's `dark:` variant
// follows too. E1 follows the system's preference: the board page reads it and sends it to the
// view, which sets its own class; a view with no host, as in a Snapshot, reads it itself. Plain
// ECMAScript: the board page and the shell both bundle it.

import { type Density, PALETTES, type Palette, type ThemePreference } from "@askboard/contract";

export type Theme = "light" | "dark";

/** The media query that says the system prefers a dark scheme. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

const DARK_CLASS = "dark";

/** What the theme uses of a `MediaQueryList`. */
export type SchemeQuery = {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
};

/** What the theme uses of the root element. */
export type ThemeRoot = { readonly classList: { toggle(name: string, force: boolean): unknown } };

export const systemTheme = (query: Pick<SchemeQuery, "matches">): Theme =>
  query.matches ? "dark" : "light";

export const applyTheme = (root: ThemeRoot, theme: Theme): void => {
  root.classList.toggle(DARK_CLASS, theme === "dark");
};

/** The theme a preference gives when the system prefers dark or not. */
export const resolveTheme = (preference: ThemePreference, systemDark: boolean): Theme =>
  preference === "system" ? (systemDark ? "dark" : "light") : preference;

/** A followed preference: `prefer` sets it, `current` is the theme now in effect. */
export type ThemeFollower = {
  prefer(preference: ThemePreference): void;
  current(): Theme;
};

/**
 * Calls `apply` with the theme the preference gives now and whenever it changes: the preference
 * itself, and, under `system` only, the system's scheme. The preference is `system` until set.
 */
export const followTheme = (query: SchemeQuery, apply: (theme: Theme) => void): ThemeFollower => {
  let preference: ThemePreference = "system";
  const current = () => resolveTheme(preference, query.matches);
  apply(current());
  query.addEventListener("change", () => {
    if (preference === "system") apply(current());
  });
  return {
    prefer: (next) => {
      preference = next;
      apply(current());
    },
    current,
  };
};

const COMFORTABLE_CLASS = "comfortable";

/** Compact is the base tokens; a `.comfortable` class on the root re-points spacing and type. */
export const applyDensity = (root: ThemeRoot, density: Density): void => {
  root.classList.toggle(COMFORTABLE_CLASS, density === "comfortable");
};

/** A theme as the host context carries it; anything else is no theme. */
export const readTheme = (value: unknown): Theme | undefined =>
  value === "light" || value === "dark" ? value : undefined;

/** The media query that says the system asks for more contrast. */
export const CONTRAST_QUERY = "(prefers-contrast: more)";

/**
 * The palette in effect (palettes, design decision D5): Contrasto when the theme preference is
 * System and the system asks for more contrast, whatever palette is chosen, else the palette.
 */
export const resolvePalette = (
  palette: Palette,
  preference: ThemePreference,
  contrastMore: boolean,
): Palette => (preference === "system" && contrastMore ? "contrasto" : palette);

/** What the palette uses of the root element. */
export type PaletteRoot = {
  setAttribute(name: string, value: string): unknown;
  removeAttribute(name: string): unknown;
};

const PALETTE_ATTRIBUTE = "data-palette";

/**
 * Sets `data-palette`, and removes it for Carta, whose tokens are the base. Only a name the
 * contract lists reaches the attribute; any other value leaves no attribute (AD-8).
 */
export const applyPalette = (root: PaletteRoot, palette: Palette): void => {
  if (palette !== "carta" && PALETTES.includes(palette)) {
    root.setAttribute(PALETTE_ATTRIBUTE, palette);
  } else {
    root.removeAttribute(PALETTE_ATTRIBUTE);
  }
};

/** A followed palette: `prefer` sets the choice and the theme preference, `current` is in effect. */
export type PaletteFollower = {
  prefer(palette: Palette, preference: ThemePreference): void;
  current(): Palette;
};

/**
 * Calls `apply` with the palette in effect now and whenever it changes: the choice, the theme
 * preference, and, under System only, the system's contrast. Carta and System until set.
 */
export const followPalette = (
  query: SchemeQuery,
  apply: (palette: Palette) => void,
): PaletteFollower => {
  let palette: Palette = "carta";
  let preference: ThemePreference = "system";
  const current = () => resolvePalette(palette, preference, query.matches);
  apply(current());
  query.addEventListener("change", () => {
    if (preference === "system") apply(current());
  });
  return {
    prefer: (nextPalette, nextPreference) => {
      palette = nextPalette;
      preference = nextPreference;
      apply(current());
    },
    current,
  };
};
