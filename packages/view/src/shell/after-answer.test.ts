import { describe, expect, test } from "bun:test";
import { type AfterAnswerInputs, afterAnswerOf } from "./after-answer.ts";

// What the board does after an act (answering-flow-guidance, design decision 3; requirements
// "After an answer" and "What never moves the board"): one case per row of the table.
const NEXT = { id: "release", newFromAgent: false } as const;
const inputsOf = (change: Partial<AfterAnswerInputs> = {}): AfterAnswerInputs => ({
  act: "answer",
  result: "sent",
  single: false,
  setting: "next",
  delivery: "immediate",
  next: NEXT,
  held: 0,
  ...change,
});

describe("stay: the acts that never move the board", () => {
  test("a revision, whatever its result", () => {
    for (const result of ["sent", "held"] as const) {
      expect(afterAnswerOf(inputsOf({ revision: true, result }))).toEqual({ kind: "stay" });
    }
  });

  test("a note alone, sent, held or taken back", () => {
    for (const result of ["note-sent", "note-held", "note-released"] as const) {
      expect(afterAnswerOf(inputsOf({ result }))).toEqual({ kind: "stay" });
    }
  });

  test("Edit (a held answer released), a missing reason, a blocked or cancelled answer", () => {
    for (const result of ["released", "needs-reason", undefined] as const) {
      expect(afterAnswerOf(inputsOf({ result }))).toEqual({ kind: "stay" });
    }
  });

  test("an undo of a postpone or a decline", () => {
    for (const act of ["postpone", "decline"] as const) {
      expect(afterAnswerOf(inputsOf({ act, result: "took-effect", undo: true }))).toEqual({
        kind: "stay",
      });
    }
  });

  test("a postpone or a decline that did not take effect", () => {
    for (const act of ["postpone", "decline"] as const) {
      expect(afterAnswerOf(inputsOf({ act, result: undefined }))).toEqual({ kind: "stay" });
    }
  });

  test("the single-question board, in either setting and delivery", () => {
    for (const setting of ["next", "stay"] as const) {
      for (const delivery of ["immediate", "submitted"] as const) {
        expect(
          afterAnswerOf(inputsOf({ single: true, setting, delivery, next: undefined })),
        ).toEqual({ kind: "stay" });
      }
    }
  });
});

describe("move, with the setting Go to the next", () => {
  test("an answer sent or held, a postpone and a decline, go to the target", () => {
    for (const change of [
      { result: "sent" },
      { result: "held" },
      { act: "postpone", result: "took-effect" },
      { act: "decline", result: "took-effect" },
    ] satisfies Partial<AfterAnswerInputs>[]) {
      expect(afterAnswerOf(inputsOf(change))).toEqual({
        kind: "move",
        target: "release",
        newFromAgent: false,
      });
    }
  });

  test("the move works in both delivery modes", () => {
    for (const delivery of ["immediate", "submitted"] as const) {
      expect(afterAnswerOf(inputsOf({ delivery, held: 1 })).kind).toBe("move");
    }
  });

  test("an unseen question the agent added is flagged", () => {
    expect(afterAnswerOf(inputsOf({ next: { id: "added", newFromAgent: true } }))).toEqual({
      kind: "move",
      target: "added",
      newFromAgent: true,
    });
  });

  test("the area is done when it has nothing left to do and the target is in another", () => {
    const area = { acted: { id: "a", title: "Architecture" }, left: 0, targetId: "b" };
    expect(afterAnswerOf(inputsOf({ area }))).toEqual({
      kind: "move",
      target: "release",
      newFromAgent: false,
      areaDone: "Architecture",
    });
  });

  test("the area is not done while a question of it is left, or when the target is in it", () => {
    const acted = { id: "a", title: "Architecture" };
    expect(afterAnswerOf(inputsOf({ area: { acted, left: 2, targetId: "b" } }))).not.toHaveProperty(
      "areaDone",
    );
    expect(afterAnswerOf(inputsOf({ area: { acted, left: 0, targetId: "a" } }))).not.toHaveProperty(
      "areaDone",
    );
  });

  test("an area without a title, or a question outside any area, is never named", () => {
    expect(
      afterAnswerOf(inputsOf({ area: { acted: { id: "a" }, left: 0, targetId: "b" } })),
    ).not.toHaveProperty("areaDone");
    expect(afterAnswerOf(inputsOf({ area: { left: 0, targetId: "b" } }))).not.toHaveProperty(
      "areaDone",
    );
  });
});

describe("footer, with the setting Stay here", () => {
  test("the card's footer carries the target, with its flags", () => {
    expect(afterAnswerOf(inputsOf({ setting: "stay" }))).toEqual({
      kind: "footer",
      target: "release",
      newFromAgent: false,
    });
    expect(
      afterAnswerOf(
        inputsOf({
          setting: "stay",
          next: { id: "added", newFromAgent: true },
          area: { acted: { id: "a", title: "Architecture" }, left: 0, targetId: "b" },
        }),
      ),
    ).toEqual({ kind: "footer", target: "added", newFromAgent: true, areaDone: "Architecture" });
  });
});

describe("the end of the work", () => {
  test("One by one, nothing to do: the completion panel, in both settings", () => {
    for (const setting of ["next", "stay"] as const) {
      expect(afterAnswerOf(inputsOf({ setting, next: undefined }))).toEqual({ kind: "complete" });
    }
  });

  test("only postponed questions left, nothing held: complete", () => {
    expect(afterAnswerOf(inputsOf({ delivery: "submitted", next: undefined }))).toEqual({
      kind: "complete",
    });
  });

  test("All together, nothing to do and answers held: send all", () => {
    for (const setting of ["next", "stay"] as const) {
      expect(
        afterAnswerOf(inputsOf({ setting, delivery: "submitted", next: undefined, held: 3 })),
      ).toEqual({ kind: "send-all" });
    }
  });

  test("a postpone or a decline that ends the work completes it too", () => {
    expect(
      afterAnswerOf(inputsOf({ act: "decline", result: "took-effect", next: undefined })),
    ).toEqual({ kind: "complete" });
    expect(
      afterAnswerOf(
        inputsOf({
          act: "postpone",
          result: "took-effect",
          delivery: "submitted",
          next: undefined,
          held: 2,
        }),
      ),
    ).toEqual({ kind: "send-all" });
  });
});
