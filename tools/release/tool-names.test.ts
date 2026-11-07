import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TOOL_DEFINITIONS } from "@askboard/contract";
import { main, toolNames } from "./tool-names.ts";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("toolNames", () => {
  test("are the names of the contract's tool definitions, in their order", () => {
    expect(toolNames()).toEqual(TOOL_DEFINITIONS.map((tool) => tool.name));
    expect([...toolNames()].sort()).toEqual(["ask", "collect", "fetch", "snapshot", "update"]);
  });

  test("main writes them as a JSON array", () => {
    const folder = mkdtempSync(join(tmpdir(), "askboard-tool-names-"));
    temporary.push(folder);
    const file = join(folder, "tools.json");
    expect(main(["--out", file])).toBe(0);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(toolNames());
  });

  test("main refuses a missing --out", () => {
    expect(main([])).toBe(2);
  });
});
