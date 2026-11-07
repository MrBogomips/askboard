// The LaTeX's model (latex-kanban-timeline, design decision 7), pure: the value the draft holds
// for an edited source. The text is the whole expression as the user wrote it, which may not
// parse; its limit is the component's, through the contract's `cutLatexExpression`.

import type { LatexProps } from "@askboard/contract";

/**
 * The props with `text` as the expression, or `undefined` when `text` is the expression as sent,
 * so that an edit back to the agent's expression leaves no value for the item.
 */
export const valueFor = (props: LatexProps, text: string): LatexProps | undefined =>
  text === props.expression ? undefined : { ...props, expression: text };
