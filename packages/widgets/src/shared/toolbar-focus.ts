// The roving focus of a toolbar (the Tree's, since widget-editing; the Ranking's, since
// approval-scale-ranking; the Kanban's and the Timeline's, since latex-kanban-timeline), pure: which tool a key moves to and which holds the Tab stop, skipping
// disabled tools and stopping at the ends (Tree open question 10).

/** A focus move among the toolbar's tools. */
export type ToolbarMove = "previous" | "next" | "first" | "last";

const TOOLBAR_KEYS: Readonly<Record<string, ToolbarMove>> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  Home: "first",
  End: "last",
};

/** The move among a toolbar's tools a key makes, or none: the horizontal arrows, Home and End. */
export const toolbarMoveOf = (key: string): ToolbarMove | undefined =>
  Object.hasOwn(TOOLBAR_KEYS, key) ? TOOLBAR_KEYS[key] : undefined;

const enabledAt = (enabled: readonly boolean[]): number[] =>
  enabled.flatMap((on, at) => (on ? [at] : []));

/**
 * The tool the toolbar's focus moves to from `current` on `move`, skipping disabled tools and
 * stopping at the ends (open question 10); `current` when no other tool fits.
 */
export const toolbarFocus = (
  enabled: readonly boolean[],
  current: number,
  move: ToolbarMove,
): number => {
  const tools = enabledAt(enabled);
  switch (move) {
    case "previous":
      return tools.findLast((at) => at < current) ?? current;
    case "next":
      return tools.find((at) => at > current) ?? current;
    case "first":
      return tools[0] ?? current;
    case "last":
      return tools.at(-1) ?? current;
  }
};

/**
 * The tool that holds the toolbar's Tab stop: `current` while enabled, else the nearest enabled
 * tool after it, else before it; `undefined` when every tool is disabled, as in a read-only Tree.
 */
export const toolbarStop = (enabled: readonly boolean[], current: number): number | undefined => {
  if (enabled[current] === true) return current;
  const tools = enabledAt(enabled);
  return tools.find((at) => at > current) ?? tools.findLast((at) => at < current);
};
