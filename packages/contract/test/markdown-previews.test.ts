// Markdown option previews (atoms, task 1.6; contract spec: Markdown option previews): an option
// may mark its preview as Markdown, in the input format, the board document and `fetch`'s question;
// a preview without the mark keeps its plain-text meaning. The input format, the board document and
// the tool envelopes each move to the next minor, which this change's version test names at least.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { lifecycleBoardDocument, lifecycleFetchResult } from "../src/fixtures/index.ts";
import {
  BOARD_DOCUMENT_VERSION,
  INPUT_FORMAT_VERSION,
  SCHEMA_IDS,
  SCHEMA_SETS,
  TOOL_ENVELOPES_VERSION,
} from "../src/index.ts";
import {
  type RequestProblem,
  validateAgainst,
  validateAskRequest,
  validateUpdateRequest,
} from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";

type Props = Record<string, unknown>;
type Item = { type: string; id: string; props: Props };

const option = (label: string, extra: Props = {}) => ({ label, ...extra });
const question = (options: unknown[], id = "format"): Item => ({
  type: "question",
  id,
  props: { text: "Which layout?", options },
});
const ask = (...items: Item[]) => ({ askId: "layout-review-a1b2", items });
const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateAskRequest(value);
  return checked.ok ? [] : checked.problems;
};
const markdown = (text = "# Heading\n\n- one\n- two") =>
  option("A", { preview: text, previewFormat: "markdown" });

describe("an option's previewFormat", () => {
  test("markdown and plain pass beside a preview", () => {
    expect(problemsOf(ask(question([markdown(), option("B")])))).toEqual([]);
    expect(
      problemsOf(
        ask(
          question([option("A", { preview: "plain words", previewFormat: "plain" }), option("B")]),
        ),
      ),
    ).toEqual([]);
  });

  test("a format without a preview is refused, naming the option and the field", () => {
    const value = ask(question([option("A"), option("B", { previewFormat: "markdown" })]));
    const [problem, ...rest] = problemsOf(value);
    expect(rest).toEqual([]);
    expect(problem).toMatchObject({
      path: "/items/0/props/options/1/previewFormat",
      itemId: "format",
      field: "props.options[1].previewFormat",
    });
    expect(problem?.message).toContain('"B"');
    expect(problem?.message).toContain("preview");
    const plain = ask(question([option("A", { previewFormat: "plain" }), option("B")]));
    expect(problemsOf(plain)).toHaveLength(1);
  });

  test("a format other than plain or markdown is refused, naming the field", () => {
    for (const bad of ["html", "Markdown", "", 1, null]) {
      const value = ask(question([option("A", { preview: "x", previewFormat: bad })]));
      const problems = problemsOf(value);
      expect(problems.length, String(bad)).toBeGreaterThan(0);
      expect(problems[0]?.field).toBe("props.options[0].previewFormat");
    }
  });

  test("a Markdown preview of 10,000 code points passes, 10,001 fails, and so does an empty one", () => {
    expect(problemsOf(ask(question([markdown("p".repeat(10_000))])))).toEqual([]);
    expect(problemsOf(ask(question([markdown("😀".repeat(10_000))])))).toEqual([]);
    expect(problemsOf(ask(question([markdown("p".repeat(10_001))])))[0]?.field).toBe(
      "props.options[0].preview",
    );
    expect(problemsOf(ask(question([markdown("")])))[0]?.field).toBe("props.options[0].preview");
  });

  test("a plain preview keeps its meaning: no format is needed, and the question props still pass", () => {
    const plain = ask(
      question([option("A", { preview: "CREATE TABLE t (id int);" }), option("B")]),
    );
    expect(problemsOf(plain)).toEqual([]);
    expect(
      validateAgainst(SCHEMA_IDS.questionProps, {
        text: "Q",
        options: [option("A", { preview: "x" })],
      }).ok,
    ).toBe(true);
  });

  test("the wording of an option names previewFormat", () => {
    const value = ask(question([option("A", { preview: "x", colour: "red" })]));
    const [problem] = problemsOf(value);
    expect(problem?.expected).toContain("previewFormat");
    const bad = ask(question([option("A", { preview: "x", previewFormat: "html" })]));
    expect(problemsOf(bad)[0]?.expected).toContain('"plain" (the default) or "markdown"');
  });

  test("an added question in an update is held to the same rule", () => {
    const add = (options: unknown[]) => ({
      askId: "layout-review-a1b2",
      actions: [{ action: "add", item: question(options, "more") }],
    });
    expect(validateUpdateRequest(add([markdown(), option("B")])).ok).toBe(true);
    const refused = validateUpdateRequest(add([option("A", { previewFormat: "markdown" })]));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.problems[0]?.field).toContain("previewFormat");
  });
});

describe("the board document and fetch's question hold previewFormat", () => {
  const withFormat = <T extends { props: Props }>(item: T): T => {
    const props = structuredClone(item.props) as { options: Props[] };
    props.options = [{ label: "A", preview: "# A", previewFormat: "markdown" }, { label: "B" }];
    return { ...item, props } as T;
  };

  test("a board document question's option takes it", () => {
    const [first] = lifecycleBoardDocument.items;
    if (first?.type !== "area") throw new Error("the fixture's first item is an area");
    const [one, ...others] = first.props.items;
    const document = {
      ...lifecycleBoardDocument,
      items: [
        { ...first, props: { ...first.props, items: [withFormat(one as never), ...others] } },
        ...lifecycleBoardDocument.items.slice(1),
      ],
    };
    expect(validateAgainst(SCHEMA_IDS.boardDocument, document).ok).toBe(true);
    const bad = structuredClone(document) as unknown as {
      items: { props: { items: { props: { options: Props[] } }[] } }[];
    };
    (bad.items[0]?.props.items[0]?.props.options[0] as Props).previewFormat = "html";
    expect(validateAgainst(SCHEMA_IDS.boardDocument, bad).ok).toBe(false);
  });

  test("fetch's question props take it", () => {
    const result = { ...lifecycleFetchResult, item: withFormat(lifecycleFetchResult.item) };
    expect(validateAgainst(SCHEMA_IDS.fetchResult, result).ok).toBe(true);
    const bad = structuredClone(result) as unknown as { item: { props: { options: Props[] } } };
    (bad.item.props.options[0] as Props).previewFormat = "html";
    expect(validateAgainst(SCHEMA_IDS.fetchResult, bad).ok).toBe(false);
  });
});

describe("the three sets' versions since atoms", () => {
  const minor = (version: string): number => Number(version.split(".")[1]);
  const setOf = (name: string) => {
    const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
    if (set === undefined) throw new Error(`no set ${name}`);
    return set;
  };

  test("the input format, the board document and the tool envelopes hold this change's additions", () => {
    expect(minor(INPUT_FORMAT_VERSION)).toBeGreaterThanOrEqual(8);
    expect(minor(BOARD_DOCUMENT_VERSION)).toBeGreaterThanOrEqual(7);
    expect(minor(TOOL_ENVELOPES_VERSION)).toBeGreaterThanOrEqual(8);
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.7"],
      ["board-document", "1.6"],
      ["tool-envelopes", "1.7"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous)).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0")).toBeDefined();
    }
  });

  test("each set module's header names this change", async () => {
    for (const module of ["input", "board-document", "tool-envelopes"]) {
      const text = await Bun.file(
        new URL(`../src/schemas/${module}/index.ts`, import.meta.url),
      ).text();
      const header = text.split("\nimport ")[0] as string;
      expect(header, module).toContain("atoms");
    }
  });

  test("the approved examples are untouched and still pass", async () => {
    const FIXTURES = join(import.meta.dir, "fixtures");
    const uj2 = await Bun.file(join(FIXTURES, "asks/uj2-wbs-gantt.json")).json();
    expect(problemsOf(uj2)).toEqual([]);
  });
});
