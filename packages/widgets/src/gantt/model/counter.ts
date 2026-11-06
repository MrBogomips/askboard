// The Gantt toolbar's counter text (EXPERIENCE State Patterns, Widget; design decision 11): "No
// changes", "Your changes: N" and, in a plan, "· M follow from the WBS". It is made from the view's
// catalogue through the lookup the caller passes, so that the language is the ask's.

/** The lookup of a string by key, as the view's catalogue gives it. */
export type Lookup = (
  key: "gantt.counter.none" | "gantt.counter.yours" | "gantt.counter.follows",
  slots?: { readonly count: number },
) => string;

export const COUNTER_SEPARATOR = " · ";

/** What the counter reads for `count` changes of the user's and `derived` tasks that follow the WBS. */
export const counterText = (count: number, derived: number, text: Lookup): string => {
  const own = count === 0 ? text("gantt.counter.none") : text("gantt.counter.yours", { count });
  return derived === 0
    ? own
    : `${own}${COUNTER_SEPARATOR}${text("gantt.counter.follows", { count: derived })}`;
};
