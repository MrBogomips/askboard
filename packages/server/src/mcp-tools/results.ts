// Tool results (AD-6): one text block carrying JSON in its envelope, or `isError` text that names
// the item ID and the expected shape, puts the first problems first and stays under 4,000
// characters.

import { ERROR_TEXT_MAX_CHARS } from "@askboard/contract";
import type { RequestProblem } from "@askboard/contract/validate";

export type ToolResult = {
  readonly content: { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
};

/** The longest single problem line: one problem never crowds out the others. */
const LINE_MAX_CHARS = 600;

export const jsonResult = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

const capped = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/** An error the agent must act on, as one line of text under the error-text limit. */
export const errorResult = (text: string): ToolResult => ({
  content: [{ type: "text", text: capped(text, ERROR_TEXT_MAX_CHARS - 1) }],
  isError: true,
});

const more = (count: number): string =>
  `- and ${count} more ${count === 1 ? "problem" : "problems"}; fix these first and send it again`;

/**
 * An error listing a request's problems in the order given, the first first, as many as fit under
 * the error-text limit, with a count of the rest.
 */
export const problemsResult = (
  heading: string,
  problems: readonly RequestProblem[],
): ToolResult => {
  const lines = [heading];
  let length = heading.length;
  const budget = ERROR_TEXT_MAX_CHARS - 1 - more(problems.length).length - 1;
  let shown = 0;
  for (const problem of problems) {
    const line = `- ${capped(problem.message, LINE_MAX_CHARS)}`;
    if (length + 1 + line.length > budget) break;
    lines.push(line);
    length += 1 + line.length;
    shown += 1;
  }
  if (shown < problems.length) lines.push(more(problems.length - shown));
  return errorResult(lines.join("\n"));
};
