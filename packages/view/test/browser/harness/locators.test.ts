// The guard of the stable hooks (answering-flow-guidance, task 2.2; design D5): a browser test finds
// the answering flow's controls and the delivery receipt by their `data-askboard-*` hooks
// (`harness/dom.ts`), never by a label that a wording change renames. A file that asserts a label's
// text is on the allowlist below, with the reason.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BROWSER_DIR = join(import.meta.dir, "..");

/** The labels the hooks stand for: English and Italian. */
const LABELS: readonly string[] = [
  "Answer",
  "Submit",
  "Postpone",
  "Select recommended",
  "Immediate",
  "Submitted",
  "Rispondi",
  "Rinvia",
  "Seleziona le consigliate",
  "Invia le risposte",
  "Immediata",
  "Su invio",
  "not sent yet",
  "sent",
  "delivered to the agent",
  "non ancora inviata",
  "inviata",
  "consegnata all'agente",
];

/** Labels that a name may start with ("Next open ↓", "Prossima aperta ↓"). */
const PREFIXES: readonly string[] = ["Next open", "Prossima aperta"];

/** Files that assert a label's text, and why. */
export const ALLOWLIST: Readonly<Record<string, string>> = {
  "languages.browser.ts": "asserts the Italian labels Rinvia and Prossima aperta on an it-IT board",
  "answering-flow-focus.browser.ts": "the confirmation dialog's own Submit button has no hook",
};

const CALLS: readonly RegExp[] = [
  /getByRole\(\s*["'`](?:button|radio)["'`]\s*,\s*\{[^}]*?\bname:\s*([^,}]+)/g,
  /getByText\(\s*([^,)]+)/g,
  /\bbuttonOf\([^,()]+,[^,()]+,\s*([^)]+)\)/g,
  /\bbarButton\([^,()]+,\s*([^)]+)\)/g,
];

/** Whether a call's name expression is one of the guarded labels. */
export const namesALabel = (expression: string): boolean => {
  const text = expression.trim();
  const quoted = /^["'`](.*)["'`]$/s.exec(text);
  if (quoted !== null) {
    const value = quoted[1] ?? "";
    return LABELS.includes(value) || PREFIXES.some((prefix) => value.startsWith(prefix));
  }
  if (text.startsWith("/")) return PREFIXES.some((prefix) => text.includes(prefix));
  return false;
};

/** The guarded calls of a source, as the text of each offending name. */
export const offencesOf = (source: string): string[] => {
  const found: string[] = [];
  for (const call of CALLS) {
    for (const match of source.matchAll(call)) {
      const expression = match[1] ?? "";
      if (namesALabel(expression)) found.push(expression.trim());
    }
  }
  return found;
};

const browserFiles = (): string[] =>
  readdirSync(BROWSER_DIR).filter((name) => name.endsWith(".browser.ts"));

describe("the browser tests find the answering flow's controls by hooks, not by label (D5)", () => {
  test("the guard sees a planted label locator, and lets a hook and an unrelated button pass", () => {
    expect(offencesOf('await view.getByRole("button", { name: "Answer", exact: true })')).toEqual([
      '"Answer"',
    ]);
    expect(offencesOf('page.getByRole("button", { name: /^Next open/ })')).toHaveLength(1);
    expect(offencesOf('card.getByText("sent", { exact: true })')).toEqual(['"sent"']);
    expect(offencesOf('buttonOf(board, "plan", "Rispondi")')).toEqual(['"Rispondi"']);
    expect(offencesOf('barButton(board, "Immediate")')).toEqual(['"Immediate"']);
    expect(offencesOf('view.getByRole(\n  "button",\n  { name: "Postpone" },\n)')).toHaveLength(1);
    expect(offencesOf('view.getByRole("button", { name: "Keep mine" })')).toEqual([]);
    expect(offencesOf('board.receipt("sent")')).toEqual([]);
    expect(offencesOf('view.locator("[data-askboard-primary]")')).toEqual([]);
  });

  test("every allowlisted file exists and still needs its entry", () => {
    const files = browserFiles();
    for (const name of Object.keys(ALLOWLIST)) {
      expect(files).toContain(name);
      expect(offencesOf(readFileSync(join(BROWSER_DIR, name), "utf8")).length).toBeGreaterThan(0);
    }
  });

  test("no other browser file names a guarded label in a locator", () => {
    const offending: Record<string, string[]> = {};
    for (const name of browserFiles()) {
      if (name in ALLOWLIST) continue;
      const found = offencesOf(readFileSync(join(BROWSER_DIR, name), "utf8"));
      if (found.length > 0) offending[name] = found;
    }
    expect(offending).toEqual({});
  });
});
