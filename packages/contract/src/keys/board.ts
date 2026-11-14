// The widget types whose chunk registers its key table with the board (keyboard-shortcuts-help,
// design decisions 9, 14 and 20; review 5.6, S-31). The board shows a Keys button and a keys panel
// for these types only and takes the user's key changes there only. The tables of the other types
// feed the generated skills as default keys and nothing else, so the skills claim the panel and the
// user's keys for the listed types alone. A retrofit that registers its types' tables as
// `ComponentFacts.keys` appends them here (the Ranking's chunk registered its table first); the
// widgets' test `component-facts.test.ts` ties this list to the chunks.

/** The registered type names whose chunk registers a key table with the board. Frozen. */
export const KEY_TABLES_ON_BOARD: readonly string[] = Object.freeze(["ranking"]);
