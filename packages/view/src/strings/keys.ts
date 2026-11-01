// The keys of every string the view and the board page show (settings-languages design decision
// 9). Each table holds each key once; agent content is never a string here (FR-34).

export const STRING_KEYS = [
  // The board page.
  "tab.title",
  "banner.connectionLost",
  "banner.moved",
  "banner.continueHere",
  "banner.discarded",
  "banner.unsentNotSent",
  "board.loadError",
  // The view.
  "header.ask",
  "state.waiting",
  "state.answered",
  "state.discarded",
  "question.answer",
  "question.options",
  "question.optionsPickOne",
  "receipt.notSentYet",
  "receipt.sent",
  "receipt.delivered",
  "item.error",
  "item.loading",
] as const;

export type StringKey = (typeof STRING_KEYS)[number];

/**
 * A string: a template whose named slots, as in `{title}`, are filled as text, or a pair for a
 * count, `one` for 1 and `other` for any other count, each holding `{count}`.
 */
export type Template = string | { readonly one: string; readonly other: string };

export type StringTable = Readonly<Record<StringKey, Template>>;
