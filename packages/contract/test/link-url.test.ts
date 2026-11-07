// The one check of a Markdown link's URL (atoms, task 5.9; view-and-widgets spec: Markdown links in
// the view, The board page opens Markdown links): the view decides whether to draw an anchor and the
// board page whether to open it with this predicate, so no URL is drawn as a link that the page
// would refuse.

import { describe, expect, test } from "bun:test";
import { LINK_URL_TABLE, LONGEST_LINK_URL } from "../src/fixtures/index.ts";
import { isLinkUrl, LINK_URL_MAX_CHARS } from "../src/index.ts";

describe("the link URL predicate", () => {
  test("the bound is the context limit's URL length", () => {
    expect(LINK_URL_MAX_CHARS).toBe(2_048);
    expect(LONGEST_LINK_URL).toHaveLength(2_048);
  });

  for (const [url, verdict] of LINK_URL_TABLE) {
    const shown = url.length > 60 ? `${url.slice(0, 40)}... (${url.length})` : url;
    test(`${JSON.stringify(shown)} is ${verdict ? "" : "no "}link`, () => {
      expect(isLinkUrl(url)).toBe(verdict);
    });
  }
});
