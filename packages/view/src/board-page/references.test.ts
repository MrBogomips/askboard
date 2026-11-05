import { describe, expect, test } from "bun:test";
import { contextBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../view-document.ts";
import { boardItemOf, webUrlOf } from "./references.ts";

const document = contextBoardDocument as unknown as ViewDocument;

describe("what the board page opens for a reference (excerpts, task 6.5; AD-8)", () => {
  test("a GITHUB or WEB reference of the board document gives its URL", () => {
    expect(webUrlOf(document, "pr")).toBe("https://github.com/acme/pay/pull/12");
    expect(webUrlOf(document, "runbook")).toBe("https://acme.atlassian.net/wiki/runbook");
  });

  test("an item that is no web reference gives none: a FILE reference, an image, an excerpt, a question, an unknown ID", () => {
    for (const itemId of [
      "retry-src",
      "shot",
      "retry-adr",
      "fix",
      "no-such-item",
      "__proto__",
      "constructor",
    ]) {
      expect(webUrlOf(document, itemId)).toBeUndefined();
    }
    expect(webUrlOf(undefined, "pr")).toBeUndefined();
  });

  test("a URL that is not http or https gives none", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      "ftp://x.test/",
      "//x.test/",
      "",
    ]) {
      const odd = swapUrl(url);
      expect(webUrlOf(odd, "pr")).toBeUndefined();
    }
  });

  test("the item is found in an area's question as well", () => {
    const [first] = contextBoardDocument.items;
    const inArea = {
      ...document,
      items: [{ type: "area", id: "a", props: { title: "A", items: [first] } }],
    } as unknown as ViewDocument;
    expect(webUrlOf(inArea, "pr")).toBe("https://github.com/acme/pay/pull/12");
    expect(boardItemOf(inArea, "pr")?.type).toBe("reference");
  });
});

// The context document with the `pr` reference's URL replaced.
function swapUrl(url: string): ViewDocument {
  return {
    ...document,
    items: contextBoardDocument.items.map((question) => ({
      ...question,
      props: {
        ...question.props,
        items: question.props.items?.map((item) =>
          item.id === "pr" ? { ...item, props: { ...(item.props as object), url } } : item,
        ),
      },
    })),
  } as unknown as ViewDocument;
}
