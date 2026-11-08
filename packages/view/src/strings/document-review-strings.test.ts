import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Document review's strings (view-and-widgets spec: Document review strings; ux-update-draft.md
// block 1): in both tables, an Italian board showing them in Italian. The registered name of its
// notice (`change.widgetDocumentReview`) is task 6.3's.
const KEYS = [
  "documentReview.tools",
  "documentReview.comment",
  "documentReview.suggest",
  "documentReview.document",
  "documentReview.counterNone",
  "documentReview.counter",
  "documentReview.counterComments",
  "documentReview.counterEdits",
  "documentReview.pinComment",
  "documentReview.pinEdit",
  "documentReview.detachedHeading",
  "documentReview.detachedNote",
  "documentReview.detachedNoteShown",
  "documentReview.refuseNone",
  "documentReview.refuseSeveral",
  "documentReview.refuseBlank",
  "documentReview.refuseTooLong",
  "documentReview.refuseOverlaps",
  "documentReview.refuseRepeated",
  "documentReview.refuseBlock",
  "documentReview.refuseLimit",
];

describe("the Document review's strings", () => {
  test("are in both tables", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "documentReview.comment")).toBe("Comment");
    expect(t("en-US", "documentReview.suggest")).toBe("Suggest edit");
    expect(t("en-US", "documentReview.counterNone")).toBe("No comments yet");
    expect(t("en-US", "documentReview.counter", { changes: "1 comment" })).toBe(
      "Your changes: 1 comment",
    );
    expect(t("en-US", "documentReview.counterComments", { count: 2 })).toBe("2 comments");
    expect(t("en-US", "documentReview.counterEdits", { count: 1 })).toBe("1 suggested edit");
    expect(t("en-US", "documentReview.pinComment", { number: 1 })).toBe("Comment 1");
    expect(t("en-US", "documentReview.pinEdit", { number: 2 })).toBe("Suggested edit 2");
    expect(t("en-US", "documentReview.detachedHeading")).toBe("Detached comments");
    expect(t("en-US", "documentReview.detachedNote")).toBe(
      "The document changed, and these no longer match it. Delete them before you answer.",
    );
    expect(t("en-US", "documentReview.refuseNone")).toBe("Select a passage of the document first.");
    expect(t("en-US", "documentReview.refuseOverlaps", { number: 2 })).toBe(
      "This passage overlaps comment 2.",
    );
    expect(t("en-US", "documentReview.refuseLimit")).toBe(
      "This document holds 100 comments and suggested edits, the most it takes. Delete one first.",
    );
  });

  test("read in Italian", () => {
    expect(t("it-IT", "documentReview.comment")).toBe("Commenta");
    expect(t("it-IT", "documentReview.suggest")).toBe("Suggerisci modifica");
    expect(t("it-IT", "documentReview.counterNone")).toBe("Nessun commento");
    expect(t("it-IT", "documentReview.counter", { changes: "1 commento" })).toBe(
      "Le tue modifiche: 1 commento",
    );
    expect(t("it-IT", "documentReview.counterEdits", { count: 2 })).toBe("2 modifiche suggerite");
    expect(t("it-IT", "documentReview.pinEdit", { number: 2 })).toBe("Modifica suggerita 2");
    expect(t("it-IT", "documentReview.detachedHeading")).toBe("Commenti staccati");
    expect(t("it-IT", "documentReview.refuseOverlaps", { number: 2 })).toBe(
      "Questo passaggio si sovrappone al commento 2.",
    );
    expect(t("it-IT", "documentReview.refuseLimit")).toBe(
      "Questo documento contiene già 100 commenti e modifiche suggerite, il massimo. Eliminane uno prima.",
    );
  });
});
