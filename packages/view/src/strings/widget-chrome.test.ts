import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STRINGS } from "./index.ts";

// Task 1.6 (review F-04; spec view-and-widgets, "Widget chrome follows the ask's language"): the
// Tree's, the Gantt's and the molecules' own strings come from the view's catalogue, so none of
// the catalogue's English texts may stand as a literal in the widgets' sources.

const SOURCES = join(import.meta.dir, "../../../widgets/src");
const PREFIXES = [
  "tree.",
  "gantt.",
  "widget.",
  "approval.",
  "scale.",
  "ranking.",
  "latex.",
] as const;

const sourcesUnder = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });

// A source without its comments, which quote the strings they talk about.
const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "");

// The static stretches of a template, the slots cut out, of the lengths worth looking for.
const fragmentsOf = (text: string): readonly string[] =>
  text
    .split(/\{[A-Za-z]+\}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8 || (part.length >= 3 && part === text));

const enUs = STRINGS["en-US"];
const chrome = Object.entries(enUs).filter(([key]) =>
  PREFIXES.some((prefix) => key.startsWith(prefix)),
);
const texts = chrome.flatMap(([, template]) =>
  typeof template === "string" ? [template] : [template.one, template.other],
);
const literals = new Set(texts.flatMap(fragmentsOf));

// Phrases the catalogue shares with a name that is no chrome, such as a column ID, a key name or a CSS value.
// "off", "added" and "moved" are also the Tree's and the Gantt's own mark kinds and switch states.
const ALLOWED = new Set<string>(["Delete", "Zoom", "task", "off", "added", "moved"]);

describe("the widgets' sources hold no chrome string as a literal", () => {
  const files = sourcesUnder(SOURCES).map((path) => ({
    path,
    text: withoutComments(readFileSync(path, "utf8")),
  }));

  test("the catalogue holds the Tree's and the Gantt's chrome", () => {
    expect(chrome.length).toBeGreaterThan(60);
    expect(files.length).toBeGreaterThan(40);
  });

  test("no catalogue text stands quoted in a source", () => {
    const found: string[] = [];
    for (const { path, text } of files) {
      for (const literal of literals) {
        if (ALLOWED.has(literal)) continue;
        const quoted = [`"${literal}"`, `'${literal}'`, `\`${literal}\``];
        if (quoted.some((form) => text.includes(form))) found.push(`${path}: ${literal}`);
      }
    }
    expect(found).toEqual([]);
  });

  test("no catalogue sentence stands inside a longer literal either", () => {
    const sentences = [...literals].filter(
      (literal) => literal.includes(" ") && literal.length >= 14,
    );
    const found: string[] = [];
    for (const { path, text } of files) {
      for (const sentence of sentences) {
        if (text.includes(sentence)) found.push(`${path}: ${sentence}`);
      }
    }
    expect(found).toEqual([]);
  });
});
