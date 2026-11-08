// The Document review's props (document-review, tasks 1.2 and 1.3; contract spec: Document review items, Document review
// results),
// composed over the shipped registry with `withWidgetTypes`, which gives the same registry before
// and after the type is registered (design decision 11): the document's bounds counted in code
// points, the characters it refuses, the title, the fields the type does not take, and the one list
// of escaped characters the contract keeps.

import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import {
  DOCUMENT_REVIEW_FIXTURE_ITEM,
  DOCUMENT_REVIEW_RESULTS,
  DOCUMENT_REVIEW_TYPES,
  documentReviewAct,
  documentReviewAnswerEvent,
  documentReviewFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  agentTextRuns,
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  DOCUMENT_REVIEW_MAX_CHARS,
  DOCUMENT_REVIEW_SCHEMA_IDS,
  DOCUMENT_REVIEW_TITLE_MAX_CHARS,
  DOCUMENT_REVIEW_WIDGET,
  documentReviewPropsProblems,
  documentReviewResultProblems,
  documentReviewResultShape,
  isEscapedCodePoint,
  TEXT_MAX_CHARS,
  WIDGET_TYPES,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { validateBoardMessage } from "../src/validate.ts";
import { EMPTY_RESULTS } from "../src/widgets/registry-check.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems, resultProblemsOf } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...DOCUMENT_REVIEW_TYPES);
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

describe("Document review results", () => {
  const ITEM = DOCUMENT_REVIEW_FIXTURE_ITEM;
  const check = (result: unknown, item: { type: string; id: string; props: unknown } = ITEM) =>
    resultProblemsOf(TYPES, item, result);
  const text = (result: unknown, item: { type: string; id: string; props: unknown } = ITEM) =>
    check(result, item)
      .map(({ message }) => message)
      .join("\n");
  const quote = (exact: string, extra: Record<string, unknown> = {}) => ({
    type: "quote",
    exact,
    ...extra,
  });
  const comment = (id: string, exact = "remembers", body: unknown = { text: "Say how long." }) => ({
    id,
    target: { selector: quote(exact) },
    body,
  });
  const result = (...annotations: unknown[]) => ({ annotations });
  const small = (markdown: string) => ({ ...ITEM, props: { markdown } });

  test("a comment and a suggested edit pass for the item", () => {
    const both = result(
      {
        id: "u-1",
        target: { selector: quote("remembers", { prefix: "The board ", suffix: " drafts." }) },
        body: { text: "Say how long." },
      },
      { id: "u-2", target: { selector: quote("drafts") }, body: { replacement: "unsent answers" } },
    );
    expect(check(both)).toEqual([]);
    expect(documentReviewResultShape(both)).toBe(true);
    expect(documentReviewResultProblems(both, ITEM.props)).toEqual([]);
  });

  test("a deletion, an empty replacement, passes, and so does a note beside a replacement", () => {
    expect(check(result(comment("u-1", "drafts", { replacement: "" })))).toEqual([]);
    expect(check(result(comment("u-1", "drafts", { replacement: "x", text: "Clearer." })))).toEqual(
      [],
    );
  });

  test("another selector fails at the selector's type, naming the item", () => {
    for (const selector of [
      { type: "position", start: 0, end: 3 },
      { type: "region", value: "xywh=percent:1,1,10,10" },
      { type: "element", id: "n1" },
    ]) {
      const bad = result({ id: "u-1", target: { selector }, body: { text: "x" } });
      const found = check(bad);
      expect(found.length, selector.type).toBeGreaterThan(0);
      expect(found.every(({ path }) => path.startsWith("/annotations/0/target/selector"))).toBe(
        true,
      );
      expect(
        found.map(({ path }) => path),
        selector.type,
      ).toContain("/annotations/0/target/selector/type");
      expect(text(bad), selector.type).toContain(`item ${ITEM.id}`);
      expect(documentReviewResultShape(bad), selector.type).toBe(false);
    }
  });

  test.each([["c1"], ["__proto__"], ["constructor"], ["U-1"], ["u"]])(
    "the ID %s is refused for its missing prefix, naming the annotation",
    (id) => {
      const found = check(result(comment(id)));
      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe("/annotations/0/id");
      expect(found[0]?.message).toContain(`annotation "${id}"`);
      expect(found[0]?.message).toContain("u-");
      expect(found[0]?.message).toContain(`item ${ITEM.id}`);
    },
  );

  test("an ID held twice is refused at the second, naming it", () => {
    const found = check(result(comment("u-1"), comment("u-2"), comment("u-1", "drafts")));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/annotations/2/id");
    expect(found[0]?.message).toContain('annotation "u-1"');
    expect(found[0]?.message).toContain("twice");
  });

  test("an ID that is no ID fails by the schema", () => {
    expect(check(result(comment("u 1")))).not.toEqual([]);
    expect(check(result(comment("u-".padEnd(65, "x"))))).not.toEqual([]);
    expect(documentReviewResultShape(result(comment("u 1")))).toBe(false);
  });

  test("names every object inherits are IDs and passages like any other", () => {
    const found = check(
      result(
        comment("u-1", "__proto__"),
        comment("u-2", "constructor"),
        comment("u-1", "toString"),
      ),
      small("__proto__ constructor toString"),
    );
    expect(found.map(({ path }) => path)).toEqual(["/annotations/2/id"]);
    expect(Object.keys(Object.prototype)).toEqual([]);
  });

  test.each([
    ["a space", " "],
    ["a line feed", "\n"],
    ["an ideographic space", "\u3000"],
    ["a tab and a no-break space", "\t\u00a0"],
  ])("an exact of %s only is refused, naming the annotation", (_name, exact) => {
    const found = check(result(comment("u-1", exact)));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/annotations/0/target/selector/exact");
    expect(found[0]?.message).toContain('annotation "u-1"');
    expect(found[0]?.message).toContain("white space");
  });

  test("an exact one character longer than the document is refused, and one as long passes", () => {
    const doc = small("abc");
    expect(check(result(comment("u-1", "abc")), doc)).toEqual([]);
    const found = check(result(comment("u-1", "abcd")), doc);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/annotations/0/target/selector/exact");
    expect(found[0]?.message).toContain("longer than the document");
    // Code points, not UTF-16 units: two emoji are as long as two letters.
    expect(check(result(comment("u-1", "😀😀")), small("😀😀"))).toEqual([]);
    expect(check(result(comment("u-1", "😀😀😀")), small("😀😀"))).not.toEqual([]);
  });

  test("U+202E in the exact, the prefix or the suffix is refused, naming the field", () => {
    for (const field of ["exact", "prefix", "suffix"]) {
      const selector = quote("remembers", { [field]: "a\u202eb" });
      const found = check(result({ id: "u-1", target: { selector }, body: { text: "x" } }));
      expect(found, field).toHaveLength(1);
      expect(found[0]?.path).toBe(`/annotations/0/target/selector/${field}`);
      expect(found[0]?.message).toContain("\\u202E");
      expect(found[0]?.message).toContain('annotation "u-1"');
    }
  });

  test("a line feed and a tab inside a quote are the document's own and pass", () => {
    const selector = quote("a\nb\tc", { prefix: "x\n", suffix: "\ty" });
    const ok = result({ id: "u-1", target: { selector }, body: { text: "x" } });
    expect(check(ok, small("x\na\nb\tc\ty"))).toEqual([]);
  });

  test("a replacement equal to its exact is refused, naming the annotation", () => {
    const found = check(result(comment("u-1", "drafts", { replacement: "drafts" })));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/annotations/0/body/replacement");
    expect(found[0]?.message).toContain('annotation "u-1"');
    expect(found[0]?.message).toContain("changes nothing");
    // A comment equal to the passage is a comment like another.
    expect(check(result(comment("u-1", "drafts", { text: "drafts" })))).toEqual([]);
  });

  test("nothing annotated fails at /annotations", () => {
    const found = check({ annotations: [] });
    expect(found.map(({ path }) => path)).toContain("/annotations");
    expect(documentReviewResultShape({ annotations: [] })).toBe(false);
  });

  test("100 annotations pass and 101 fail at the schema", () => {
    const many = (count: number) =>
      result(...Array.from({ length: count }, (_, at) => comment(`u-${at + 1}`)));
    expect(DOCUMENT_REVIEW_ANNOTATIONS_MAX).toBe(100);
    expect(check(many(100))).toEqual([]);
    expect(documentReviewResultShape(many(100))).toBe(true);
    const over = check(many(101));
    expect(over.map(({ path }) => path)).toContain("/annotations");
    expect(documentReviewResultShape(many(101))).toBe(false);
  });

  test("a result of the wrong shape fails by the schema", () => {
    for (const bad of [
      {},
      null,
      [],
      "a",
      { annotations: "a" },
      { annotations: [null] },
      { annotations: [{ id: "u-1" }] },
      { annotations: [{ id: "u-1", target: { selector: quote("a") } }] },
      { annotations: [{ id: "u-1", target: {}, body: { text: "x" } }] },
      { annotations: [{ id: "u-1", target: { selector: quote("a") }, body: {} }] },
      {
        annotations: [
          { id: "u-1", target: { selector: quote("a") }, body: { text: "x", motivation: "y" } },
        ],
      },
      { annotations: [{ ...comment("u-1"), extra: 1 }] },
      { annotations: [comment("u-1")], extra: 1 },
    ]) {
      expect(check(bad), JSON.stringify(bad)).not.toEqual([]);
      expect(documentReviewResultShape(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  test("a result is refused, never thrown on, against props it cannot read", () => {
    for (const props of [null, undefined, {}, { markdown: 3 }, []]) {
      const item = { ...ITEM, props };
      expect(() => check(result(comment("u-1")), item)).not.toThrow();
      expect(check(result(comment("u-1")), item).length).toBeGreaterThan(0);
    }
    const garbled = result(null, 3, { id: 4 }, { id: "u-1", target: 3, body: [] });
    expect(() => documentReviewResultProblems(garbled, ITEM.props)).not.toThrow();
    expect(() => documentReviewResultProblems(null, ITEM.props)).not.toThrow();
  });

  test("the shape and the problems never throw, on any JSON value at any level", () => {
    const values = [
      null,
      0,
      3.5,
      "text",
      true,
      [],
      [null, 1, "a"],
      {},
      { toString: 1 },
      { type: { toString: 1 } },
      JSON.parse('{"__proto__": 1, "constructor": {"prototype": 2}}'),
    ];
    const selectors = [
      ...values,
      JSON.parse('{"type":{"toString":1}}'),
      JSON.parse('{"type":{"toString":1},"exact":{"toString":1}}'),
      JSON.parse('{"type":"position","start":{"toString":1}}'),
      JSON.parse('{"type":["quote"],"exact":"a"}'),
      JSON.parse('{"type":"quote","exact":{"toString":1},"prefix":[],"suffix":{}}'),
    ];
    const annotation = (field: string, value: unknown) => ({
      annotations: [
        {
          id: "u-1",
          target: { selector: quote("remembers") },
          body: { text: "x" },
          [field]: value,
        },
      ],
    });
    const results: unknown[] = [...values];
    for (const value of values) {
      results.push({ annotations: value });
      results.push({ annotations: [value] });
      for (const field of ["id", "target", "body"]) results.push(annotation(field, value));
      results.push({
        annotations: [{ id: value, target: { selector: quote("a") }, body: { text: "x" } }],
      });
      results.push({
        annotations: [{ id: "u-1", target: { selector: quote("a") }, body: value }],
      });
    }
    for (const selector of selectors) {
      results.push({ annotations: [{ id: "u-1", target: { selector }, body: { text: "x" } }] });
      results.push({ annotations: [{ id: "u-1", target: { selector } }] });
    }
    for (const one of results) {
      expect(() => documentReviewResultShape(one), JSON.stringify(one)).not.toThrow();
      expect(
        () => documentReviewResultProblems(one, ITEM.props),
        JSON.stringify(one),
      ).not.toThrow();
      expect(() => check(one), JSON.stringify(one)).not.toThrow();
    }
    const direct = JSON.parse(
      '{"annotations":[{"id":"u-1","target":{"selector":{"type":{"toString":1}}},"body":{"text":"x"}}]}',
    );
    expect(documentReviewResultShape(direct)).toBe(false);
    expect(documentReviewResultProblems(direct, ITEM.props)).toEqual([]);
    expect(check(direct).length).toBeGreaterThan(0);
  });

  test("the fixtures' results pass their item, and the act and the event are valid", () => {
    for (const [name, one] of Object.entries(DOCUMENT_REVIEW_RESULTS)) {
      expect(check(one), name).toEqual([]);
      expect(documentReviewResultShape(one), name).toBe(true);
    }
    expect(askProblems(TYPES, ITEM)).toEqual([]);
    expect(validateBoardMessage("toHost", documentReviewAct).ok).toBe(true);
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.answerEvent, documentReviewAnswerEvent)).toEqual([]);
  });

  test("a Document review fetched alone validates with its result, and fails with a Chart's", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, documentReviewFetchItemResult)).toEqual([]);
    const item = (documentReviewFetchItemResult as { item: object }).item;
    const withResult = (value: unknown) => ({
      ...documentReviewFetchItemResult,
      item: { ...item, result: value },
    });
    const errors = errorsOf(ajv, SCHEMA_IDS.fetchResult, withResult({ points: [] }));
    expect(errors.map((error) => error.instancePath)).toContain("/item/result");
  });
});

describe("the shape check agrees with the schema", () => {
  const validate = (value: unknown) =>
    errorsOf(ajvOver(TYPES), DOCUMENT_REVIEW_SCHEMA_IDS.result, value).length === 0;
  const q = (exact: string) => ({ type: "quote", exact });
  const one = (target: unknown, body: unknown = { text: "x" }, id: unknown = "u-1") => ({
    annotations: [{ id, target, body }],
  });
  const SAMPLES: readonly unknown[] = [
    ...Object.values(DOCUMENT_REVIEW_RESULTS),
    one({ selector: q("a") }),
    one({
      selector: { type: "quote", exact: "a", prefix: "p".repeat(200), suffix: "s".repeat(200) },
    }),
    one({ selector: { type: "quote", exact: "a", prefix: "p".repeat(201) } }),
    one({ selector: { type: "quote", exact: "a", suffix: "s".repeat(201) } }),
    one({ selector: { type: "quote", exact: "x".repeat(2000) } }),
    one({ selector: { type: "quote", exact: "x".repeat(2001) } }),
    one({ selector: { type: "quote", exact: "😀".repeat(2000) } }),
    one({ selector: { type: "quote", exact: "😀".repeat(2001) } }),
    one({ selector: { type: "quote", exact: "" } }),
    one({ selector: { type: "quote" } }),
    one({ selector: { type: "quote", exact: "a", extra: 1 } }),
    one({ selector: { type: "quote", exact: 3 } }),
    one({ selector: { type: "position", start: 0, end: 1 } }),
    one({ selector: { type: "css" } }),
    one({ selector: {} }),
    one({ selector: q("a"), extra: 1 }),
    one({}),
    one(null),
    one({ selector: q("a") }, { replacement: "" }),
    one({ selector: q("a") }, { replacement: "r".repeat(4000) }),
    one({ selector: q("a") }, { replacement: "r".repeat(4001) }),
    one({ selector: q("a") }, { replacement: "😀".repeat(4000) }),
    one({ selector: q("a") }, { replacement: "😀".repeat(4001) }),
    one({ selector: q("a") }, { replacement: 3 }),
    one({ selector: q("a") }, { text: "" }),
    one({ selector: q("a") }, { text: "t".repeat(2000), replacement: "r" }),
    one({ selector: q("a") }, { text: "t".repeat(2001) }),
    one({ selector: q("a") }, {}),
    one({ selector: q("a") }, []),
    one({ selector: q("a") }, null),
    one({ selector: q("a") }, { text: "x", motivation: "m" }),
    one({ selector: q("a") }, { text: "x" }, "c1"),
    one({ selector: q("a") }, { text: "x" }, "u-1 2"),
    one({ selector: q("a") }, { text: "x" }, `u-${"x".repeat(62)}`),
    one({ selector: q("a") }, { text: "x" }, `u-${"x".repeat(63)}`),
    one({ selector: q("a") }, { text: "x" }, ""),
    one({ selector: q("a") }, { text: "x" }, 3),
    { annotations: [] },
    { annotations: "a" },
    { annotations: [null] },
    { annotations: [[]] },
    { other: 1 },
    {},
    [],
    null,
    "annotations",
    3,
    ...EMPTY_RESULTS.map(([, value]) => value),
  ];

  test("on the scenarios' results, the limits and the empty values", () => {
    for (const sample of SAMPLES) {
      expect(documentReviewResultShape(sample), JSON.stringify(sample)).toBe(validate(sample));
    }
  });

  test("on a result of 100 and of 101 annotations", () => {
    const many = (count: number) => ({
      annotations: Array.from({ length: count }, (_, at) => ({
        id: `u-${at + 1}`,
        target: { selector: q("a") },
        body: { text: "x" },
      })),
    });
    for (const count of [1, 99, 100, 101]) {
      expect(documentReviewResultShape(many(count)), `${count}`).toBe(validate(many(count)));
    }
  });
});

describe("the Document review's result in the registry's own check", () => {
  test("passes over the registry holding it, result-empty included", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(DOCUMENT_REVIEW_WIDGET.result?.schema.$id).toBe(DOCUMENT_REVIEW_SCHEMA_IDS.result);
    expect(DOCUMENT_REVIEW_SCHEMA_IDS.result).toBe("urn:askboard:output:document-review-result");
    expect(DOCUMENT_REVIEW_WIDGET.result?.shape).toBe(documentReviewResultShape);
    expect(DOCUMENT_REVIEW_WIDGET.result?.problems).toBe(documentReviewResultProblems);
    expect(DOCUMENT_REVIEW_WIDGET.result?.answerProblems).toBeUndefined();
    expect(DOCUMENT_REVIEW_WIDGET.fieldCheck).toBeUndefined();
  });

  // Task 6.3 registers the entry and flips the first assertion.
  test("the entry is not registered before task 6.3, and the fixtures hold it", () => {
    expect(WIDGET_TYPES).not.toContain(DOCUMENT_REVIEW_WIDGET);
    expect(TYPES).toContain(DOCUMENT_REVIEW_WIDGET);
    expect(DOCUMENT_REVIEW_TYPES).toEqual([DOCUMENT_REVIEW_WIDGET]);
  });
});

// AskCore.ask reads the shipped registry alone, so it takes the example only once the type is
// registered (task 6.3, with `skills-examples.test.ts`); until then the example goes through the
// composed schemas and the entry's checks over `withWidgetTypes`, which is what `ask` runs.
describe("the Document review's teaching text and example", () => {
  const { skill, example } = DOCUMENT_REVIEW_WIDGET;
  const notes = (skill?.notes ?? []).join(" ");

  test("the text is within the bounds: a use of at most 70 characters, notes of at most 300", () => {
    expect(skill).toBeDefined();
    expect(skill?.use.length).toBeGreaterThanOrEqual(1);
    expect(skill?.use.length).toBeLessThanOrEqual(70);
    expect((skill?.notes ?? []).length).toBeGreaterThan(0);
    for (const note of skill?.notes ?? []) {
      expect(note.length).toBeGreaterThanOrEqual(1);
      expect(note.length).toBeLessThanOrEqual(300);
    }
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("it says when to use a Document review and what its result holds", () => {
    expect(skill?.use).toContain("Markdown");
    expect(skill?.use).toContain("comment");
    expect(notes).toContain("markdown");
    expect(notes).toContain("10,000");
    expect(notes).toContain("one item per section");
    expect(notes).toContain("annotations");
    expect(notes).toContain("exact");
    expect(notes).toContain("prefix");
    expect(notes).toContain("replacement");
    expect(notes).toContain("text");
  });

  test("it says what a quote is and what a replacement does", () => {
    expect(notes).toContain("as the board shows it");
    expect(notes).toContain("Markdown marks removed");
    expect(notes).toContain("`replacement` replaces `exact`");
    expect(notes).toContain("an empty one deletes");
  });

  test("it says to ask when a quote cannot be found, and that an untouched item gives no result", () => {
    expect(notes).toContain("ask the user");
    expect(notes).toContain("never guess");
    expect(notes).toContain("no result");
    // The Approval is not named: no module outside its folder names the type (approval-widget.test.ts).
    expect(notes).toContain("options or another widget that answers");
  });

  test("the example is a Document review that an ask accepts, with a title", () => {
    expect(example.item.type).toBe("document-review");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
    expect((example.item.props as { title?: string }).title).toBeDefined();
    expect(DOCUMENT_REVIEW_WIDGET.propsProblems(example.item.props, "agent")).toEqual([]);
  });
});
