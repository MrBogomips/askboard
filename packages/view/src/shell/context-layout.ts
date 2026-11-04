// How a question card lays out its items (excerpts, design decision 7; view spec, "A question with
// context splits"): the context items, excerpts then references, go in the context column or under
// the question text; the options stay with the question; every other item, images included,
// follows below at the card's full width. Pure: the card renders what this sorts.

import type { Rendered } from "../catalog/components.ts";

export type ContextLayout = {
  /** The options, with the question text. */
  readonly main: readonly Rendered[];
  /** Excerpts, then references, each in the agent's order. */
  readonly context: readonly Rendered[];
  /** Images and widgets: the card's full width, below both columns. */
  readonly below: readonly Rendered[];
};

const ofType = (items: readonly Rendered[], type: string): Rendered[] =>
  items.filter(({ component }) => component === type);

/** Sorts a card's rendered items into its three places. */
export const layoutOf = (items: readonly Rendered[]): ContextLayout => {
  const isContext = ({ item }: Rendered) => item.type === "excerpt" || item.type === "reference";
  return {
    main: items.filter(({ component }) => component === "choice"),
    context: [...ofType(items, "excerpt"), ...ofType(items, "reference")],
    below: items.filter(
      ({ component, item }) => component !== "choice" && !isContext({ item, component }),
    ),
  };
};

// An excerpt the agent wrote has no status; a pointer's is resolved or unresolved.
const hasSource = ({ item, component }: Rendered): boolean => {
  if (component !== "excerpt") return false;
  const props = item.props;
  if (typeof props !== "object" || props === null) return false;
  return (props as { readonly status?: unknown }).status !== "unresolved";
};

/**
 * Whether the card could split: at least one excerpt is resolved or agent-written (FR-13). The
 * "Beside | Inline" control shows only then.
 */
export const couldSplit = (context: readonly Rendered[]): boolean => context.some(hasSource);
