import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";
import type { StringKey } from "./keys.ts";

// The Approval's strings (view-and-widgets spec: The three widgets' strings; ux-update-draft.md
// blocks 1, 4 and 5): each in both tables, the Italian board showing them in Italian.
const has = (key: string): boolean => Object.hasOwn(STRINGS["en-US"], key);

describe("the Approval's strings", () => {
  test("the label, the three decisions and the notice's name in English", () => {
    for (const key of [
      "approval.label",
      "approval.approve",
      "approval.approveWithChanges",
      "approval.reject",
      "change.widgetApproval",
    ]) {
      expect(has(key)).toBe(true);
    }
    expect(t("en-US", "approval.label")).toBe("Approval");
    expect(t("en-US", "approval.approve")).toBe("Approve");
    expect(t("en-US", "approval.approveWithChanges")).toBe("Approve with changes");
    expect(t("en-US", "approval.reject")).toBe("Reject");
    expect(t("en-US", "change.widgetApproval")).toBe("Approval");
  });

  test("the same in Italian", () => {
    expect(t("it-IT", "approval.label")).toBe("Approvazione");
    expect(t("it-IT", "approval.approve")).toBe("Approva");
    expect(t("it-IT", "approval.approveWithChanges")).toBe("Approva con modifiche");
    expect(t("it-IT", "approval.reject")).toBe("Respingi");
    expect(t("it-IT", "change.widgetApproval")).toBe("Approvazione");
  });

  test("the summary's title counts the changes, and the rest of its words", () => {
    expect(t("en-US", "approval.title", { count: 1 })).toBe("1 change");
    expect(t("en-US", "approval.title", { count: 2 })).toBe("2 changes");
    expect(t("it-IT", "approval.title", { count: 1 })).toBe("1 modifica");
    expect(t("it-IT", "approval.title", { count: 2 })).toBe("2 modifiche");
    expect(t("en-US", "approval.more", { count: 5 })).toBe("and 5 more");
    expect(t("it-IT", "approval.more", { count: 5 })).toBe("e altre 5");
    expect(t("en-US", "widget.noChanges")).toBe("No changes");
    expect(t("it-IT", "widget.noChanges")).toBe("Nessuna modifica");
  });

  test("a switched value reads on and off, attivo and disattivo", () => {
    expect([t("en-US", "approval.on"), t("en-US", "approval.off")]).toEqual(["on", "off"]);
    expect([t("it-IT", "approval.on"), t("it-IT", "approval.off")]).toEqual([
      "attivo",
      "disattivo",
    ]);
  });

  test("an element added, removed or moved reads so in both languages", () => {
    const keys: StringKey[] = ["approval.added", "approval.removed", "approval.moved"];
    expect(keys.map((key) => t("en-US", key))).toEqual(["added", "removed", "moved"]);
    expect(keys.map((key) => t("it-IT", key))).toEqual(["aggiunto", "rimosso", "spostato"]);
  });
});
