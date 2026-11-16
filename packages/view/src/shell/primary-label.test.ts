import { describe, expect, test } from "bun:test";
import { t } from "../strings/index.ts";
import { type PrimaryInputs, primaryLabelOf } from "./primary-label.ts";

// The question's primary button (answering-flow-guidance, design decision 5; requirement "The
// question's primary button"): one label per act, in each language.
const base: PrimaryInputs = {
  single: false,
  delivery: "immediate",
  ready: false,
  noteOnly: false,
  revision: false,
};
const key = (change: Partial<PrimaryInputs>) => primaryLabelOf({ ...base, ...change });
// The label as the catalogue gives it, in the ask's language.
const label = (change: Partial<PrimaryInputs>, language: "en-US" | "it-IT" = "en-US") =>
  t(language, primaryLabelOf({ ...base, ...change }));

describe("the primary's label", () => {
  test("One by one: Send answer, Send the note, Send the change", () => {
    expect(key({})).toBe("question.answer");
    expect(label({ noteOnly: true })).toBe("Send the note");
    expect(label({ revision: true })).toBe("Send the change");
  });

  test("the single-question board works as One by one, whatever delivery it carries", () => {
    expect(key({ single: true, delivery: "submitted" })).toBe("question.answer");
    expect(label({ single: true, delivery: "submitted", noteOnly: true })).toBe("Send the note");
    expect(label({ single: true, delivery: "submitted", revision: true })).toBe("Send the change");
  });

  test("All together: Confirm, for an answer, a note and a revision alike", () => {
    expect(label({ delivery: "submitted" })).toBe("Confirm");
    expect(label({ delivery: "submitted", noteOnly: true })).toBe("Confirm");
    expect(label({ delivery: "submitted", revision: true })).toBe("Confirm");
  });

  test("a ready answer reads Edit in the place of Confirm", () => {
    expect(label({ delivery: "submitted", ready: true })).toBe("Edit");
    expect(label({ delivery: "submitted", ready: true, revision: true })).toBe("Edit");
  });

  test("in Italian", () => {
    expect(label({ delivery: "submitted" }, "it-IT")).toBe("Conferma");
    expect(label({ delivery: "submitted", ready: true }, "it-IT")).toBe("Modifica");
    expect(label({ noteOnly: true }, "it-IT")).toBe("Invia la nota");
    expect(label({ revision: true }, "it-IT")).toBe("Invia la modifica");
  });
});
