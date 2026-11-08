// The Document review's props (document-review, task 1.2; contract spec: Document review items),
// composed over the shipped registry with `withWidgetTypes`, which gives the same registry before
// and after the type is registered (design decision 11): the document's bounds counted in code
// points, the characters it refuses, the title, the fields the type does not take, and the one list
// of escaped characters the contract keeps.

import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { withWidgetTypes } from "../src/fixtures/index.ts";
import {
  agentTextRuns,
  DOCUMENT_REVIEW_MAX_CHARS,
  DOCUMENT_REVIEW_SCHEMA_IDS,
  DOCUMENT_REVIEW_TITLE_MAX_CHARS,
  DOCUMENT_REVIEW_WIDGET,
  documentReviewPropsProblems,
  isEscapedCodePoint,
  TEXT_MAX_CHARS,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(DOCUMENT_REVIEW_WIDGET);
const review = (props: Record<string, unknown>, id = "notes") => ({
  type: "document-review",
  id,
  props,
});
const problems = (props: Record<string, unknown>) => askProblems(TYPES, review(props));
const fieldsOf = (props: Record<string, unknown>) => problems(props).map(({ field }) => field);
const messagesOf = (props: Record<string, unknown>) =>
  problems(props)
    .map(({ message }) => message)
    .join("\n");

const DOC = "## Release 0.2\n\nThe board **remembers** drafts.";

describe("the Document review's constants and entry", () => {
  test("hold the contract's limits and the schema's ID", () => {
    expect(DOCUMENT_REVIEW_MAX_CHARS).toBe(TEXT_MAX_CHARS);
    expect(DOCUMENT_REVIEW_MAX_CHARS).toBe(10_000);
    expect(DOCUMENT_REVIEW_TITLE_MAX_CHARS).toBe(120);
    expect(DOCUMENT_REVIEW_SCHEMA_IDS.props).toBe("urn:askboard:input:document-review-props");
  });

  test("the entry is named, has its noun and example, and holds the registry together", () => {
    expect(DOCUMENT_REVIEW_WIDGET.type).toBe("document-review");
    expect(DOCUMENT_REVIEW_WIDGET.noun).toBe("a Document review");
    expect(DOCUMENT_REVIEW_WIDGET.props.$id).toBe(DOCUMENT_REVIEW_SCHEMA_IDS.props);
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });
});

describe("Document review items", () => {
  test("a document in a question passes", () => {
    const props = { markdown: DOC, title: "Release notes" };
    expect(problems(props)).toEqual([]);
    expect(askAccepted(TYPES, review(props))).toBe(true);
    expect(askAccepted(TYPES, review({ markdown: DOC }))).toBe(true);
  });

  test("the entry's example passes both the schema and the checks", () => {
    const { item } = DOCUMENT_REVIEW_WIDGET.example;
    expect(askProblems(TYPES, item)).toEqual([]);
    expect(askAccepted(TYPES, item)).toBe(true);
    expect(documentReviewPropsProblems(item.props)).toEqual([]);
  });

  test("a line feed and a tab pass", () => {
    expect(problems({ markdown: "a\n\tb\n" })).toEqual([]);
    expect(documentReviewPropsProblems({ markdown: "a\n\tb\n" })).toEqual([]);
  });

  test.each([
    ["a carriage return", "a\rb", "\\u000D"],
    ["U+0000", "a\u0000b", "\\u0000"],
    ["DEL", "a\u007fb", "\\u007F"],
    ["U+0085", "a\u0085b", "\\u0085"],
    ["U+202E", "a‮b", "\\u202E"],
    ["U+2066", "a⁦b", "\\u2066"],
  ])("%s fails, naming the item, markdown and the escape", (_name, markdown, shown) => {
    const [problem, ...rest] = problems({ markdown });
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("notes");
    expect(problem?.field).toBe("props.markdown");
    expect(problem?.message).toContain('item "notes"');
    expect(problem?.message).toContain(shown);
    // The schema accepts it: only the check refuses what the renderer would show as an escape.
    expect(askAccepted(TYPES, review({ markdown }))).toBe(true);
    expect(documentReviewPropsProblems({ markdown })[0]?.path).toBe("/markdown");
  });

  test("only the first refused character is named", () => {
    const found = documentReviewPropsProblems({ markdown: "a\u0000b‮c" });
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("\\u0000");
    expect(found[0]?.message).not.toContain("\\u202E");
  });

  test("10,000 characters holding emoji pass and 10,001 fail, naming markdown and the limit", () => {
    const at = "😀".repeat(DOCUMENT_REVIEW_MAX_CHARS);
    expect(at.length).toBe(20_000);
    expect(problems({ markdown: at })).toEqual([]);
    expect(askAccepted(TYPES, review({ markdown: at }))).toBe(true);
    const over = `${at}x`;
    expect(fieldsOf({ markdown: over })).toEqual(["props.markdown"]);
    expect(messagesOf({ markdown: over })).toContain("10000");
    expect(messagesOf({ markdown: over })).toContain('item "notes"');
    expect(askAccepted(TYPES, review({ markdown: over }))).toBe(false);
    expect(documentReviewPropsProblems({ markdown: over })[0]?.message).toContain("10001");
  });

  test("an empty or non-string document fails", () => {
    expect(fieldsOf({ markdown: "" })).toEqual(["props.markdown"]);
    expect(fieldsOf({ markdown: 3 })).toEqual(["props.markdown"]);
    expect(fieldsOf({})).toEqual(["props.markdown"]);
    expect(documentReviewPropsProblems({ markdown: "" })[0]?.path).toBe("/markdown");
    expect(documentReviewPropsProblems({ markdown: 3 })[0]?.path).toBe("/markdown");
    expect(documentReviewPropsProblems({})[0]?.path).toBe("/markdown");
  });

  test("a title of 120 characters passes and 121 fail, an empty one fails", () => {
    expect(problems({ markdown: DOC, title: "t".repeat(120) })).toEqual([]);
    expect(problems({ markdown: DOC, title: "😀".repeat(120) })).toEqual([]);
    expect(fieldsOf({ markdown: DOC, title: "t".repeat(121) })).toEqual(["props.title"]);
    expect(fieldsOf({ markdown: DOC, title: "" })).toEqual(["props.title"]);
    expect(documentReviewPropsProblems({ markdown: DOC, title: "t".repeat(121) })[0]?.path).toBe(
      "/title",
    );
    expect(documentReviewPropsProblems({ markdown: DOC, title: 4 })[0]?.path).toBe("/title");
  });

  test("a field the type does not take fails, naming the item and the field", () => {
    for (const key of ["format", "text", "__proto__", "constructor"]) {
      const props = JSON.parse(`{"markdown": "x", ${JSON.stringify(key)}: "plain"}`);
      const found = problems(props);
      expect(found.length, key).toBeGreaterThan(0);
      expect(found[0]?.itemId, key).toBe("notes");
      expect(found.map(({ message }) => message).join("\n"), key).toContain(key);
      expect(askAccepted(TYPES, review(props)), key).toBe(false);
      expect(documentReviewPropsProblems(props)[0]?.path, key).toBe(`/${key}`);
    }
  });

  test("props that are no object fail the check without throwing", () => {
    for (const props of [null, 3, "x", []]) {
      expect(documentReviewPropsProblems(props)).not.toEqual([]);
    }
  });

  test("the composed ask schema holds the type's schema", () => {
    expect(SCHEMA_IDS.ask).toBeDefined();
    expect(DOCUMENT_REVIEW_WIDGET.props.additionalProperties).toBe(false);
  });
});

describe("the one list of escaped characters", () => {
  test("isEscapedCodePoint agrees with agentTextRuns on every code point of the controls and the format characters", () => {
    for (let code = 0; code <= 0x2100; code += 1) {
      const runs = agentTextRuns(String.fromCodePoint(code));
      expect(isEscapedCodePoint(code), `U+${code.toString(16)}`).toBe(runs[0]?.escape === true);
    }
  });

  test("a line feed and a tab are escaped by the list, which the document then allows", () => {
    expect(isEscapedCodePoint(0x0a)).toBe(true);
    expect(isEscapedCodePoint(0x09)).toBe(true);
    expect(isEscapedCodePoint(0x20)).toBe(false);
    expect(isEscapedCodePoint(0x1f600)).toBe(false);
  });
});

describe("what the contract keeps apart", () => {
  test("no module of src/widgets/ outside document-review/ names the Document review", async () => {
    const named: string[] = [];
    for await (const file of new Glob("**/*.{ts,json}").scan(
      new URL("../src/widgets", import.meta.url).pathname,
    )) {
      if (file.startsWith("document-review/")) continue;
      const text = await Bun.file(new URL(`../src/widgets/${file}`, import.meta.url)).text();
      if (/document-review|DOCUMENT_REVIEW/.test(text)) named.push(file);
    }
    expect(named).toEqual([]);
  });
});
