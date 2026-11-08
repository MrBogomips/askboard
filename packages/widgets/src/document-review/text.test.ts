import { describe, expect, test } from "bun:test";
import type { DocumentReviewAnnotation } from "@askboard/contract";
import { type Say, say } from "@askboard/view/catalog";
import { counterText, pinLabel, refusalText } from "./text.ts";

// The Document review's words (view-and-widgets spec: Commenting on a passage, Passages the board
// does not anchor, Document review strings; ux-update-draft.md block 1), in both languages.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

const comment = (id: string): DocumentReviewAnnotation => ({
  id,
  target: { selector: { type: "quote", exact: "x" } },
  body: { text: "t" },
});
const edit = (id: string, replacement = ""): DocumentReviewAnnotation => ({
  id,
  target: { selector: { type: "quote", exact: "x" } },
  body: { replacement },
});

describe("counterText", () => {
  test("reads No comments yet while there is no annotation", () => {
    expect(counterText([], EN)).toBe("No comments yet");
    expect(counterText([], IT)).toBe("Nessun commento");
  });

  test("counts the comments, then the suggested edits", () => {
    expect(counterText([comment("u-1")], EN)).toBe("Your changes: 1 comment");
    expect(counterText([comment("u-1"), comment("u-2"), edit("u-3")], EN)).toBe(
      "Your changes: 2 comments, 1 suggested edit",
    );
    expect(counterText([comment("u-1"), comment("u-2"), edit("u-3")], IT)).toBe(
      "Le tue modifiche: 2 commenti, 1 modifica suggerita",
    );
  });

  test("an annotation of edits only gives no comment count, and an empty replacement is an edit", () => {
    expect(counterText([edit("u-1"), edit("u-2", "new")], EN)).toBe(
      "Your changes: 2 suggested edits",
    );
    expect(counterText([edit("u-1"), edit("u-2", "new")], IT)).toBe(
      "Le tue modifiche: 2 modifiche suggerite",
    );
  });
});

describe("pinLabel", () => {
  test("names a comment or a suggested edit with its number", () => {
    expect(pinLabel(false, 1, EN)).toBe("Comment 1");
    expect(pinLabel(true, 2, EN)).toBe("Suggested edit 2");
    expect(pinLabel(true, 2, IT)).toBe("Modifica suggerita 2");
  });
});

describe("refusalText", () => {
  test("words each refusal of a passage", () => {
    expect(refusalText({ code: "blank" }, false, EN)).toBe("Select some text, not only spaces.");
    expect(refusalText({ code: "repeated" }, false, EN)).toBe(
      "This passage repeats in the document. Select a longer one.",
    );
    expect(refusalText({ code: "several-ranges" }, false, EN)).toBe("Select one passage.");
    expect(refusalText({ code: "outside" }, false, EN)).toBe(
      "Select a passage of the document first.",
    );
    expect(refusalText({ code: "overlaps", pin: 2 }, false, EN)).toBe(
      "This passage overlaps comment 2.",
    );
    expect(refusalText({ code: "limit" }, false, EN)).toContain("100 comments and suggested edits");
    expect(refusalText({ code: "overlaps", pin: 2 }, false, IT)).toBe(
      "Questo passaggio si sovrappone al commento 2.",
    );
  });

  test("a passage too long asks for fewer characters, and a block too long for part of it with the pointer", () => {
    expect(refusalText({ code: "too-long" }, false, EN)).toBe("Select at most 2,000 characters.");
    expect(refusalText({ code: "too-long" }, true, EN)).toBe(
      "This block is longer than 2,000 characters. Select part of it with the pointer.",
    );
    expect(refusalText({ code: "too-long" }, true, IT)).toBe(
      "Questo blocco supera i 2.000 caratteri. Selezionane una parte con il puntatore.",
    );
  });
});
