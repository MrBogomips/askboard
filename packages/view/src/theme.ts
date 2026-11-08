// The theme (EXPERIENCE.md, Dark theme and Board page or view): DESIGN.md's tokens are CSS
// variables that a `.dark` class on the document's root switches, which Tailwind's `dark:` variant
// follows too. E1 follows the system's preference: the board page reads it and sends it to the
// view, which sets its own class; a view with no host, as in a Snapshot, reads it itself. Plain
// ECMAScript: the board page and the shell both bundle it.

import type { Density, ThemePreference } from "@askboard/contract";

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
