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

// The NumberField's, the MoneyField's and the DateField's strings (atoms, tasks 5.4 and 5.5):
// the field errors, the currency control's name and the calendar's words.
const FIELD_KEYS = [
  "field.atLeast",
  "field.atMost",
  "field.whole",
  "field.step",
  "field.pickCurrency",
  "field.currency",
  "field.onOrAfter",
  "field.onOrBefore",
  "date.choose",
  "date.previous",
  "date.next",
  "date.nav",
  "change.widgetNumberField",
  "change.widgetMoneyField",
  "change.widgetDateField",
] as const;

describe("the field errors and the calendar's strings", () => {
  test("are in both tables, with the same slots", () => {
    const slots = (text: unknown) =>
      String(text)
        .match(/\{[a-z]+\}/g)
        ?.sort()
        .join() ?? "";
    for (const key of FIELD_KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
      expect(slots(STRINGS["en-US"][key]), key).toBe(slots(STRINGS["it-IT"][key]));
    }
  });

  test("read in English, with the UX draft's wordings", () => {
    expect(t("en-US", "field.atLeast", { min: "0" })).toBe("At least 0.");
    expect(t("en-US", "field.atMost", { max: "20" })).toBe("At most 20.");
    expect(t("en-US", "field.whole")).toBe("A whole number.");
    expect(t("en-US", "field.step", { step: "0.5", base: "0" })).toBe("A multiple of 0.5 from 0.");
    expect(t("en-US", "field.pickCurrency")).toBe("Pick a currency.");
    expect(t("en-US", "field.onOrAfter", { date: "3/1/2026" })).toBe("On or after 3/1/2026.");
    expect(t("en-US", "field.onOrBefore", { date: "6/30/2026" })).toBe("On or before 6/30/2026.");
    expect(t("en-US", "date.choose")).toBe("Choose a date");
    expect(t("en-US", "date.previous")).toBe("Previous month");
    expect(t("en-US", "date.next")).toBe("Next month");
  });

  test("read in Italian, with the UX draft's wordings", () => {
    expect(t("it-IT", "field.atLeast", { min: "0" })).toBe("Almeno 0.");
    expect(t("it-IT", "field.atMost", { max: "20" })).toBe("Al massimo 20.");
    expect(t("it-IT", "field.whole")).toBe("Un numero intero.");
    expect(t("it-IT", "field.step", { step: "0,5", base: "0" })).toBe(
      "Un multiplo di 0,5 a partire da 0.",
    );
    expect(t("it-IT", "field.pickCurrency")).toBe("Scegli una valuta.");
    expect(t("it-IT", "field.onOrAfter", { date: "01/03/2026" })).toBe("Dal 01/03/2026 in poi.");
    expect(t("it-IT", "field.onOrBefore", { date: "30/06/2026" })).toBe("Fino al 30/06/2026.");
    expect(t("it-IT", "date.choose")).toBe("Scegli una data");
    expect(t("it-IT", "date.previous")).toBe("Mese precedente");
    expect(t("it-IT", "date.next")).toBe("Mese successivo");
  });
});
