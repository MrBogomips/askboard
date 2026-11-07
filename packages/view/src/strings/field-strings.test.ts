import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The TextField's and the Toggle's strings (atoms, task 5.3; view-and-widgets spec: The Toggle's
// unset state, Atom strings; ux-update-draft.md block 6): in both tables, the Italian texts to review.
const KEYS = [
  "toggle.notSet",
  "toggle.on",
  "toggle.off",
  "toggle.clear",
  "change.widgetTextField",
  "change.widgetToggle",
] as const;

describe("the TextField's and the Toggle's strings", () => {
  test("are in both tables", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
  });

  test("read in English", () => {
    expect(KEYS.map((key) => t("en-US", key))).toEqual([
      "Not set",
      "On",
      "Off",
      "Clear",
      "TextField",
      "Toggle",
    ]);
  });

  test("read in Italian", () => {
    expect(KEYS.map((key) => t("it-IT", key))).toEqual([
      "Non impostato",
      "Attivo",
      "Disattivo",
      "Cancella",
      "Campo di testo",
      "Interruttore",
    ]);
  });
});
