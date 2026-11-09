// The view's check and the board page's give one verdict on every URL (atoms, task 5.9; view-and-
// widgets spec: Markdown links in the view, A link too long): both call the contract's predicate.

import { describe, expect, test } from "bun:test";
import { LINK_URL_TABLE } from "@askboard/contract/fixtures";
import { isOpenableUrl } from "./board-page/markdown-links.ts";
import { isMarkdownLinkUrl } from "./markdown/markdown.ts";

describe("one link check for the view and the board page", () => {
  test("both give the table's verdict for every URL", () => {
    for (const [url, verdict] of LINK_URL_TABLE) {
      expect({ url: url.slice(0, 60), view: isMarkdownLinkUrl(url) }).toEqual({
        url: url.slice(0, 60),
        view: verdict,
      });
      expect({ url: url.slice(0, 60), page: isOpenableUrl(url) }).toEqual({
        url: url.slice(0, 60),
        page: verdict,
      });
    }
  });
});
