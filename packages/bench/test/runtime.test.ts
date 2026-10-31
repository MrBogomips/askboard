import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// AD-19: no unit uses a Bun-only API. bench's sources type-check with Bun's types, which the
// compiler cannot tell apart from Node's, so this test reads them (design decision 1). Tests, the
// stub and the stand-in claude are test code and may use Bun.
const SOURCES = join(import.meta.dir, "..", "src");

const BUN_ONLY = [/\bBun\./, /from\s+["']bun["']/, /["']bun:[a-z]+["']/];

const bunOnlyUses = (text: string): string[] =>
  text
    .split("\n")
    .flatMap((line, index) => (BUN_ONLY.some((rule) => rule.test(line)) ? [`${index + 1}`] : []));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });

describe("bench sources use no Bun-only API (AD-19)", () => {
  test("the scan finds a planted use", () => {
    expect(bunOnlyUses('const text = await Bun.file("x").text();')).toEqual(["1"]);
    expect(bunOnlyUses('ok\nimport { spawn } from "bun";')).toEqual(["2"]);
    expect(bunOnlyUses('import { Database } from "bun:sqlite";')).toEqual(["1"]);
    expect(bunOnlyUses('import { spawn } from "node:child_process";')).toEqual([]);
  });

  test("no source file under src/ uses one", () => {
    const found = sourceFiles(SOURCES).flatMap((path) =>
      bunOnlyUses(readFileSync(path, "utf8")).map((line) => `${path}:${line}`),
    );
    expect(found).toEqual([]);
  });
});
