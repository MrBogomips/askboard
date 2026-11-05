import { describe, expect, test } from "bun:test";
import { contextBoardDocument } from "../src/fixtures/index.ts";
import { RESULT_VERSIONS, SCHEMA_IDS } from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// The fetch result of a question holding context (excerpts, task 4.1; mcp-adapter spec: Fetch
// omits excerpt text and image bytes): each excerpt's pointer, title, status, reason and line
// range, each image's pointer, alt text, status and media type, each reference as the board
// document holds it, and never an excerpt's text or an image's bytes, at any depth.

const head = { versions: RESULT_VERSIONS, epoch: "k3x9", askId: contextBoardDocument.askId };

const pathsOf = (value: unknown) => {
  const checked = validateAgainst(SCHEMA_IDS.fetchResult, value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};

type Props = Record<string, unknown> & { readonly items?: readonly Record<string, unknown>[] };

// The fixture's questions as fetch gives them: no excerpt text, no image bytes.
const omitted = (props: Props): Props => ({
  ...props,
  items: props.items?.map((item) => {
    const { text: _, bytes: __, ...kept } = item.props as Record<string, unknown>;
    return { ...item, props: kept };
  }),
});

type Question = { readonly type: "question"; readonly id: string; rev: number; props: Props };

// The fixture's n-th question as fetch gives it.
const fetchedAt = (n: number): Question => {
  const question = contextBoardDocument.items[n];
  if (question === undefined) throw new Error(`the fixture has no question ${n}`);
  return { ...question, props: omitted(question.props as Props) };
};

const [fix, rollout, settings] = [fetchedAt(0), fetchedAt(1), fetchedAt(2)];

const asQuestion = (question: Question) => ({
  ...head,
  state: "waiting",
  item: { ...question, state: "open" },
});

// The question with its n-th context item's props given as `props`.
const withItemProps = (question: Question, n: number, props: Record<string, unknown>) => {
  const items = [...(question.props.items ?? [])];
  items[n] = { ...items[n], props };
  return asQuestion({ ...question, props: { ...question.props, items } });
};

const itemProps = (question: Question, n: number) =>
  question.props.items?.[n]?.props as Record<string, unknown>;

describe("a fetched question's context", () => {
  test.each([
    ["fix", fix],
    ["rollout", rollout],
    ["settings", settings],
  ])("%s, without excerpt text or image bytes, passes", (_, question) => {
    expect(pathsOf(asQuestion(question))).toEqual([]);
  });

  test("a resolved excerpt keeps its status, media type and lines", () => {
    expect(itemProps(fix, 0)).toEqual({
      pointer: "docs/adr/0012-payment-retries.md#Decision",
      status: "resolved",
      mediaType: "text/markdown",
      lines: { start: 7, end: 9 },
    });
    const { lines: _, ...noLines } = itemProps(fix, 0);
    expect(pathsOf(withItemProps(fix, 0, noLines))).not.toEqual([]);
  });

  test("a resolved excerpt with its text is refused", () => {
    const text = { ...itemProps(fix, 0), text: "## Decision" };
    expect(pathsOf(withItemProps(fix, 0, text))).not.toEqual([]);
  });

  test("an unresolved excerpt keeps its reason, and a written one only its title", () => {
    expect(pathsOf(withItemProps(rollout, 0, { ...itemProps(rollout, 0), text: "" }))).not.toEqual(
      [],
    );
    expect(itemProps(settings, 0)).toEqual({ title: "Retry settings" });
    expect(pathsOf(withItemProps(settings, 0, {}))).toEqual([]);
    const written = { title: "Retry settings", text: "retries: 3" };
    expect(pathsOf(withItemProps(settings, 0, written))).not.toEqual([]);
    const statusless = { title: "Retry settings", status: "resolved" };
    expect(pathsOf(withItemProps(settings, 0, statusless))).not.toEqual([]);
  });

  test("an image keeps its pointer, alt text, status and media type, never its bytes", () => {
    expect(itemProps(fix, 3)).toEqual({
      pointer: ".askboard/media/shot.png",
      alt: "The retry log",
      status: "resolved",
      mediaType: "image/png",
    });
    const bytes = { ...itemProps(fix, 3), bytes: "iVBORw0KGgo=" };
    expect(pathsOf(withItemProps(fix, 3, bytes))).not.toEqual([]);
    const { mediaType: _, ...noType } = itemProps(fix, 3);
    expect(pathsOf(withItemProps(fix, 3, noType))).not.toEqual([]);
    expect(itemProps(rollout, 4)).toMatchObject({ status: "unresolved", reason: "not-image" });
  });

  test("a reference is as the board document holds it", () => {
    expect(itemProps(fix, 1)).toEqual(
      contextBoardDocument.items[0].props.items?.[1]?.props as Record<string, unknown>,
    );
    const kindless = { ...itemProps(fix, 2), kind: undefined };
    expect(pathsOf(withItemProps(fix, 2, JSON.parse(JSON.stringify(kindless))))).not.toEqual([]);
  });

  test("an area's questions follow the same rule", () => {
    const area = (questions: readonly unknown[]) => ({
      ...head,
      state: "waiting",
      item: { type: "area", id: "payments", props: { title: "Payments", items: questions } },
    });
    expect(pathsOf(area([fix, rollout, settings]))).toEqual([]);
    const sent = contextBoardDocument.items[0];
    expect(pathsOf(area([sent]))).not.toEqual([]);
  });
});
