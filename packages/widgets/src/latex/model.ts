// The LaTeX's model (latex-kanban-timeline, design decision 7), pure: the value the draft holds
// for an edited source. The text is the whole expression as the user wrote it, which may not
// parse; its limit is the component's, through the contract's `cutLatexExpression`.

import { LATEX_DEFINING_COMMANDS, type LatexProps } from "@askboard/contract";
import type { Rendered } from "./render.ts";

/**
 * The props with `text` as the expression, or `undefined` when `text` is the expression as sent,
 * so that an edit back to the agent's expression leaves no value for the item.
 */
export const valueFor = (props: LatexProps, text: string): LatexProps | undefined =>
  text === props.expression ? undefined : { ...props, expression: text };

/** The string keys of a field error. */
export type FieldErrorKey =
  | "latex.parseError"
  | "latex.drawFailed"
  | "latex.macroDefinition"
  | "latex.internalCommand"
  | "latex.refusedCommand"
  | "latex.tooDeep";

/**
 * A field error as the string tables take it: the key and the values of its slots. The model
 * imports nothing of the view: the component passes both to its `t`.
 */
export type FieldError = {
  readonly key: FieldErrorKey;
  readonly values: Readonly<Record<string, string | number>>;
};

/**
 * The field error of what `renderInto` gave back, or none for a drawn expression (design decision
 * 7): the refusal of a definition, of an internal command (a name holding `@`) or of another
 * command the scan refuses (`\show`, `\char` with a backquote), each naming the command; a nest
 * past the limit naming its depth and the limit; KaTeX's own message; and the fixed text for a failure that carries none. The message is KaTeX's,
 * untranslated, and the component shows it as text.
 */
export const fieldErrorOf = (rendered: Rendered): FieldError | undefined => {
  const { refused, error } = rendered;
  if (refused !== undefined) {
    if ("depth" in refused) {
      return { key: "latex.tooDeep", values: { depth: refused.depth, limit: refused.limit } };
    }
    const { command } = refused;
    if (LATEX_DEFINING_COMMANDS.includes(command)) {
      return { key: "latex.macroDefinition", values: { command } };
    }
    if (command.includes("@")) return { key: "latex.internalCommand", values: { command } };
    return { key: "latex.refusedCommand", values: { command } };
  }
  if (error === undefined) return undefined;
  return error === ""
    ? { key: "latex.drawFailed", values: {} }
    : { key: "latex.parseError", values: { message: error } };
};
