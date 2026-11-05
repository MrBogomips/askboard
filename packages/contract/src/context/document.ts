// What the board document's schema cannot say of its context items (excerpts, design decision 2;
// contract spec, Resolved context in the board document): a line range starts at most where it
// ends. Problems read as schema errors, at the range.

import { isRecord } from "../problems.ts";
import type { Problem } from "../validate.ts";

const listOf = (value: unknown): readonly unknown[] =>
  isRecord(value) && isRecord(value.props) && Array.isArray(value.props.items)
    ? value.props.items
    : [];

// Each question of a board document, with its JSON Pointer: at the top level, or in an area.
const questionsOf = (document: unknown): (readonly [unknown, string])[] => {
  const items = isRecord(document) && Array.isArray(document.items) ? document.items : [];
  return items.flatMap((item, index): (readonly [unknown, string])[] => {
    const at = `/items/${index}`;
    if (!isRecord(item) || item.type !== "area") return [[item, at]];
    return listOf(item).map((question, inner) => [question, `${at}/props/items/${inner}`] as const);
  });
};

const reversed = (lines: unknown): boolean =>
  isRecord(lines) &&
  typeof lines.start === "number" &&
  typeof lines.end === "number" &&
  lines.start > lines.end;

/** Every context item's line range that starts after it ends, in document order. */
export const contextDocumentProblems = (document: unknown): Problem[] =>
  questionsOf(document).flatMap(([question, at]) =>
    listOf(question).flatMap((item, index) => {
      const lines = isRecord(item) && isRecord(item.props) ? item.props.lines : undefined;
      if (!reversed(lines)) return [];
      const path = `${at}/props/items/${index}/props/lines`;
      return [{ path, message: "the line range starts after it ends" }];
    }),
  );
