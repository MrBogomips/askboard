// The theme (EXPERIENCE.md, Dark theme and Board page or view): DESIGN.md's tokens are CSS
// variables that a `.dark` class on the document's root switches, which Tailwind's `dark:` variant
// follows too. E1 follows the system's preference: the board page reads it and sends it to the
// view, which sets its own class; a view with no host, as in a Snapshot, reads it itself. Plain
// ECMAScript: the board page and the shell both bundle it.

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

/** Calls `apply` with the system's theme now and on each change; returns the current one. */
export const followSystemTheme = (
  query: SchemeQuery,
  apply: (theme: Theme) => void,
): (() => Theme) => {
  apply(systemTheme(query));
  query.addEventListener("change", () => apply(systemTheme(query)));
  return () => systemTheme(query);
};

/** A theme as the host context carries it; anything else is no theme. */
export const readTheme = (value: unknown): Theme | undefined =>
  value === "light" || value === "dark" ? value : undefined;
