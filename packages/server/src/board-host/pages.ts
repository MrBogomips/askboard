// The invalid-link pages (EXPERIENCE, Invalid-link page; AD-21): fixed text that says why the link
// opens no board and what to do, with no board content and no script. A discarded ask's link says
// only that the ask was discarded.

const page = (title: string, text: string): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    "</head>",
    "<body>",
    `<h1>${title}</h1>`,
    `<p>${text}</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");

export const INVALID_LINK_PAGES = {
  /** `/b/<askId>` without `t`. */
  incomplete: page(
    "This board link is incomplete",
    "The link has no token, so it opens no board. Open the full link the agent gave you, from the conversation or the terminal.",
  ),
  /** A token that does not open that ask's board, or an ask this session process does not hold. */
  invalid: page(
    "This link opens no board",
    "Its token does not open a board of this AskBoard session, or the ask belongs to a session that has ended. Ask the agent for the board's link again.",
  ),
  /** A discarded ask's link, with its token. */
  discarded: page("Ask discarded", "This ask was discarded."),
} as const;

/** The policy of every response but the board page: nothing loads, and no page may frame it. */
export const PLAIN_POLICY =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
