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
  // Wording (task 4.2): the labels of the hooked controls, kept apart from bare "Send", "Invia",
  // "Edit" and "Modifica", which the composer, the revision dialog and the annotation cards carry.
  "Send answer",
  "Confirm",
  "Send the note",
  "Send the change",
  "Later",
  "One by one",
  "All together",
  "Invia risposta",
  "Conferma",
  "Invia la nota",
  "Invia la modifica",
  "Più tardi",
  "Una alla volta",
  "Tutte insieme",
  "Not sent yet",
  "Sent",
  "Delivered to the agent",
  "Non ancora inviata",
  "Inviata",
  "Consegnata all'agente",
];

/** Labels that a name may start with ("Next open ↓", "Prossima aperta ↓"). */
const PREFIXES: readonly string[] = [
  "Next open",
  "Prossima aperta",
  "Next to do",
  "Prefill recommended",
  "Prossima da fare",
  "Precompila le consigliate",
];

/** The counted Send: "Send 2 answers", "Invia 1 risposta". */
const COUNTED_SEND = /^(?:Send|Invia) \d/;

/** Files that assert a label's text, and why. */
export const ALLOWLIST: Readonly<Record<string, string>> = {
  "languages.browser.ts":
    "asserts the Italian labels Più tardi and Prossima da fare on an it-IT board",
};

const CALLS: readonly RegExp[] = [
  /getByRole\(\s*["'`](?:button|radio)["'`]\s*,\s*\{[^}]*?\bname:\s*([^,}]+)/g,
  /getByText\(\s*([^,)]+)/g,
  /\bbuttonOf\([^,()]+,[^,()]+,\s*([^)]+)\)/g,
  /\bbarButton\([^,()]+,\s*([^)]+)\)/g,
  /\bdialogButton\([^,()]+,\s*([^)]+)\)/g,
  /\bhasText:\s*([^,}]+)/g,
];

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a piece of text is a guarded label, or starts with a prefix label. */
const isLabel = (value: string): boolean =>
  LABELS.includes(value) ||
  PREFIXES.some((prefix) => value.startsWith(prefix)) ||
  COUNTED_SEND.test(value);

/** Whether one of a regex's alternatives is a guarded label, as a whole or as a prefix label. */
const regexHoldsLabel = (text: string): boolean => {
  const body = text.slice(1, text.lastIndexOf("/")).replace(/[\^$()]/g, "");
  return body.split("|").some((alternative) => isLabel(alternative.trim()));
};

/**
 * Whether a call's name expression is one of the guarded labels: a string literal anywhere in it
 * (a ternary of two languages), a regex that holds one, or an identifier of a `const` bound to one
 * in the same source.
 */
export const namesALabel = (expression: string, source = ""): boolean => {
  const text = expression.trim();
  if (text.startsWith("/")) return regexHoldsLabel(text);
  for (const literal of text.matchAll(/(["'`])((?:(?!\1).)*)\1/gs)) {
    if (isLabel(literal[2] ?? "")) return true;
  }
  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    const bound = new RegExp(
      `\\b(?:const|let)\\s+${escaped(text)}\\s*=\\s*(["'\`])((?:(?!\\1).)*)\\1`,
      "s",
    ).exec(source);
    return bound !== null && isLabel(bound[2] ?? "");
  }
  return false;
};

/** The guarded calls of a source, as the text of each offending name. */
export const offencesOf = (source: string): string[] => {
  const found: string[] = [];
  for (const call of CALLS) {
    for (const match of source.matchAll(call)) {
      const expression = match[1] ?? "";
      if (namesALabel(expression, source)) found.push(expression.trim());
    }
  }
  return found;
};

const browserFiles = (): string[] =>
  readdirSync(BROWSER_DIR).filter((name) => name.endsWith(".browser.ts"));

/** The harness sources, which build locators for the tests. */
const harnessFiles = (): string[] =>
  readdirSync(join(BROWSER_DIR, "harness"))
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => `harness/${name}`);

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
    // Hardening (2b.2): regexes, indirection, text filters, dialogButton.
    expect(offencesOf('view.getByRole("button", { name: /^Answer$/ })')).toHaveLength(1);
    expect(offencesOf('view.getByRole("button", { name: /Rispondi|Rinvia/ })')).toHaveLength(1);
    expect(
      offencesOf('const A = "Answer";\nview.getByRole("button", { name: A, exact: true })'),
    ).toHaveLength(1);
    expect(
      offencesOf('view.getByRole("button", { name: it ? "Rispondi" : "Answer", exact: true })'),
    ).toHaveLength(1);
    expect(offencesOf('card.locator("button", { hasText: "Postpone" })')).toHaveLength(1);
    expect(offencesOf('card.locator("button").filter({ hasText: /Submit/ })')).toHaveLength(1);
    expect(offencesOf('dialogButton(board, "Submit")')).toEqual(['"Submit"']);
    expect(offencesOf('const B = "Keep mine";\nview.getByRole("button", { name: B })')).toEqual([]);
    expect(offencesOf('view.getByRole("button", { name: /Keep (mine)/ })')).toEqual([]);
    expect(offencesOf('view.getByRole("button", { name: "Keep mine" })')).toEqual([]);
    expect(offencesOf('board.receipt("sent")')).toEqual([]);
    expect(offencesOf('view.locator("[data-askboard-primary]")')).toEqual([]);
    // The new labels (task 4.2), one planted case each; bare Send, Invia, Edit and Modifica pass.
    for (const label of [
      "Send answer",
      "Confirm",
      "Send the note",
      "Send the change",
      "Later",
      "One by one",
      "All together",
      "Next to do ↓",
      "Prefill recommended (3)",
      "Invia risposta",
      "Conferma",
      "Invia la nota",
      "Invia la modifica",
      "Più tardi",
      "Una alla volta",
      "Tutte insieme",
      "Prossima da fare",
      "Precompila le consigliate (2)",
      "Send 2 answers",
      "Invia 1 risposta",
      "Not sent yet",
      "Sent",
      "Delivered to the agent",
      "Non ancora inviata",
      "Inviata",
      "Consegnata all'agente",
    ]) {
      expect(offencesOf(`view.getByRole("button", { name: "${label}" })`)).toHaveLength(1);
    }
    for (const label of ["Send", "Invia", "Edit", "Modifica"]) {
      expect(offencesOf(`view.getByRole("button", { name: "${label}", exact: true })`)).toEqual([]);
    }
  });

  test("every allowlisted file exists and still needs its entry", () => {
    const files = [...browserFiles(), ...harnessFiles()];
    for (const name of Object.keys(ALLOWLIST)) {
      expect(files).toContain(name);
      expect(offencesOf(readFileSync(join(BROWSER_DIR, name), "utf8")).length).toBeGreaterThan(0);
    }
  });

  test("no other browser file names a guarded label in a locator", () => {
    const offending: Record<string, string[]> = {};
    for (const name of [...browserFiles(), ...harnessFiles()]) {
      if (name in ALLOWLIST) continue;
      const found = offencesOf(readFileSync(join(BROWSER_DIR, name), "utf8"));
      if (found.length > 0) offending[name] = found;
    }
    expect(offending).toEqual({});
  });
});
