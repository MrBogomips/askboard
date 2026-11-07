// The Chart's tokens as the theme in effect resolves them (design decision 4; DESIGN, Colors and
// Chart): read from the resolved custom properties, which hold the light or the dark value
// according to the `dark` class, so a switch of theme is a new read. A token with no value is a
// failure, not a default colour: the item's error boundary fails the Chart (AD-10).

import type { ChartTokens } from "./option.ts";

const SERIES_VARIABLES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const;

const present = (read: (name: string) => string, name: string): string => {
  const value = read(name).trim();
  if (value === "") throw new Error(`the theme gives no value for ${name}`);
  return value;
};

/** The tokens, reading each custom property by name. */
export const tokensFrom = (read: (name: string) => string): ChartTokens => {
  const badge = present(read, "--fs-badge");
  const badgeSize = /^[0-9]+(\.[0-9]+)?px$/.test(badge) ? Number.parseFloat(badge) : Number.NaN;
  if (Number.isNaN(badgeSize)) {
    throw new Error(`the theme gives --fs-badge as "${badge}", which is no size in pixels`);
  }
  return {
    chart: SERIES_VARIABLES.map((name) => present(read, name)),
    border: present(read, "--border"),
    mutedForeground: present(read, "--muted-foreground"),
    popover: present(read, "--popover"),
    popoverForeground: present(read, "--popover-foreground"),
    change: present(read, "--change"),
    card: present(read, "--card"),
    fontSans: present(read, "--font-sans"),
    badgeSize,
  };
};

type StyleOf = (element: Element) => { getPropertyValue(name: string): string };

/** The tokens as `element` sees them, in the theme in effect now. */
export const chartTokens = (
  element: Element,
  styleOf: StyleOf = (each) => getComputedStyle(each),
): ChartTokens => {
  const style = styleOf(element);
  return tokensFrom((name) => style.getPropertyValue(name));
};
