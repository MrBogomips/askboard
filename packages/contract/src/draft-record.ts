// A draft record checked against its ask's board document (contract spec, Draft record message):
// what the board protocol's schema cannot see, since the record and the document come apart.

import { isRecord } from "./problems.ts";
import type { BoardQuestion, LifecycleBoardDocument } from "./schemas/board-document/index.ts";
import type { DraftRecord } from "./schemas/board-protocol/index.ts";
import type { Problem } from "./validate.ts";

const pointerPart = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");

// Each question of a board document, in board order, areas' included.
const boardQuestions = (document: LifecycleBoardDocument): readonly BoardQuestion[] =>
  document.items.flatMap((item) => (item.type === "area" ? item.props.items : [item]));

// The items a question's draft values may name: the question itself, and its widget items once the
// input format admits them.
const draftItemsOf = (question: BoardQuestion): ReadonlySet<string> => {
  const widgets = (question.props as { readonly items?: unknown }).items;
  const ids = Array.isArray(widgets)
    ? widgets.flatMap((item) => (isRecord(item) && typeof item.id === "string" ? [item.id] : []))
    : [];
  return new Set([question.id, ...ids]);
};

/**
 * What a draft record the board protocol accepts says that its ask's board document cannot hold
 * (contract spec, Draft record message): a question key, a question in view, or a value, result or entry key that
 * names no question or item of the ask, or a revision past the question's. Keys are read as own
 * properties and looked up in sets, so an inherited name such as `constructor` is an unknown ID.
 * Paths are JSON Pointers into the record.
 */
export const draftRecordProblems = (
  record: DraftRecord,
  document: LifecycleBoardDocument,
): Problem[] => {
  const questions = new Map(boardQuestions(document).map((question) => [question.id, question]));
  const problems: Problem[] = [];
  const { inView } = record;
  if (inView !== undefined && !questions.has(inView)) {
    problems.push({ path: "/inView", message: `"${inView}" names no question of the ask` });
  }
  for (const [key, draft] of Object.entries(record.questions)) {
    const at = `/questions/${pointerPart(key)}`;
    const question = questions.get(key);
    if (question === undefined) {
      problems.push({ path: at, message: `${JSON.stringify(key)} names no question of the ask` });
      continue;
    }
    if (draft.rev > question.rev) {
      const message = `the question is at revision ${question.rev}, not ${draft.rev}`;
      problems.push({ path: `${at}/rev`, message });
    }
    const items = draftItemsOf(question);
    for (const field of ["values", "results", "entries"] as const) {
      for (const itemId of Object.keys(draft[field] ?? {})) {
        if (items.has(itemId)) continue;
        const message = `${JSON.stringify(itemId)} names no item of the question "${key}"`;
        problems.push({ path: `${at}/${field}/${pointerPart(itemId)}`, message });
      }
    }
  }
  return problems;
};
