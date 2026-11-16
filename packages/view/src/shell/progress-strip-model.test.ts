import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import type { ViewDocument } from "../view-document.ts";
import type { QuestionWork } from "./board-draft.ts";
import { stripOf, stripScrollLeft } from "./progress-strip-model.ts";

// The progress strip's model (answering-flow-visual, design decision 5).
const question = (id: string, props: Record<string, unknown> = {}) => ({
  type: "question",
  id,
  rev: 1,
  props: { text: `Text of ${id}`, ...props },
});
const state = (...statuses: object[]) =>
  ({ ask: "partly-answered", questions: statuses }) as unknown as LifecycleBoardState;
const sent = (itemId: string) => ({
  itemId,
  rev: 1,
  state: "answered",
  answer: { when: "2026-11-15T10:00:00Z", receipt: "sent" },
});
const none = () => undefined;
const notRevising = () => false;

const strip = (
  document: object,
  boardState: LifecycleBoardState,
  options: {
    work?: Record<string, QuestionWork>;
    unseen?: string[];
    numbers?: Record<string, number>;
  } = {},
) =>
  stripOf(
    document as ViewDocument,
    boardState,
    new Map(Object.entries(options.work ?? {})),
    none,
    notRevising,
    new Set(options.unseen ?? []),
    new Map(Object.entries(options.numbers ?? {})),
  );

describe("stripOf", () => {
  test("one group without areas, each question carrying state, number, chip and new mark", () => {
    const document = { items: [question("a", { header: "Cache" }), question("b"), question("c")] };
    const groups = strip(document, state(sent("a")), {
      work: { b: { rev: 1, held: { act: "answer", order: 1 } } },
      unseen: ["c"],
      numbers: { a: 1, b: 2, c: 3 },
    });
    expect(groups).toEqual([
      {
        segments: [
          { questionId: "a", state: "sent", number: 1, chip: "Cache", isNew: false },
          { questionId: "b", state: "ready", number: 2, chip: "Text of b", isNew: false },
          { questionId: "c", state: "todo", number: 3, chip: "Text of c", isNew: true },
        ],
      },
    ]);
  });

  test("groups by area in board order", () => {
    const document = {
      items: [
        { type: "area", id: "x", props: { title: "X", items: [question("a"), question("b")] } },
        { type: "area", id: "y", props: { title: "Y", items: [question("c")] } },
      ],
    };
    const groups = strip(document, state(), { numbers: { a: 1, b: 2, c: 3 } });
    expect(groups.map((group) => [group.areaId, group.segments.map((s) => s.questionId)])).toEqual([
      ["x", ["a", "b"]],
      ["y", ["c"]],
    ]);
  });

  test("a segment has no number when the map holds none", () => {
    const groups = strip({ items: [question("a")] }, state());
    expect(groups[0]?.segments[0]?.number).toBeUndefined();
  });

  test("the first status of a question is the one read", () => {
    const groups = strip(
      { items: [question("a")] },
      state(sent("a"), { itemId: "a", rev: 1, state: "open" }),
    );
    expect(groups[0]?.segments[0]?.state).toBe("sent");
  });

  test("a long chip is cut as the status messages cut a title", () => {
    const groups = strip({ items: [question("a", { header: "x".repeat(200) })] }, state());
    expect(Array.from(groups[0]?.segments[0]?.chip ?? "").length).toBe(80);
  });
});

describe("stripScrollLeft", () => {
  const box = { scrollLeft: 100, clientWidth: 200 };

  test("a segment wholly inside leaves the scroll where it is", () => {
    expect(stripScrollLeft(box, { offsetLeft: 150, offsetWidth: 28 })).toBe(100);
    expect(stripScrollLeft(box, { offsetLeft: 100, offsetWidth: 28 })).toBe(100);
    expect(stripScrollLeft(box, { offsetLeft: 272, offsetWidth: 28 })).toBe(100);
  });

  test("a segment left of the box brings its left edge to the box's", () => {
    expect(stripScrollLeft(box, { offsetLeft: 60, offsetWidth: 28 })).toBe(60);
  });

  test("a segment right of the box brings its right edge to the box's", () => {
    expect(stripScrollLeft(box, { offsetLeft: 400, offsetWidth: 28 })).toBe(228);
  });

  test("never scrolls below zero", () => {
    expect(
      stripScrollLeft({ scrollLeft: 10, clientWidth: 20 }, { offsetLeft: -5, offsetWidth: 28 }),
    ).toBe(0);
    expect(
      stripScrollLeft({ scrollLeft: 0, clientWidth: 10 }, { offsetLeft: 0, offsetWidth: 5 }),
    ).toBe(0);
  });
});
