import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callerFolder } from "../src/caller-folder.ts";

// The folder the session process shows for its project when the host gave none (plugin-release,
// packaging spec, "The start script runs outside the project"; AD-12): the start script runs Node
// in the plugin root and names the caller's directory in ASKBOARD_CALLER_CWD, for display only.

describe("callerFolder", () => {
  test("is the caller's directory the start script named, not the working folder", () => {
    expect(callerFolder({ ASKBOARD_CALLER_CWD: "/work/pay" }, "/plugin/root")).toBe("/work/pay");
  });

  test("is the working folder when the start script named none", () => {
    expect(callerFolder({}, "/work/pay")).toBe("/work/pay");
    expect(callerFolder({ ASKBOARD_CALLER_CWD: "" }, "/work/pay")).toBe("/work/pay");
  });

  test.each([
    ["a relative path", "pay/src"],
    ["a path with a line break", "/work/pay\n/etc"],
    ["a path with a control character", "/work/pay\u001b[31m"],
  ])("ignores %s, which no start script writes", (_name, named) => {
    expect(callerFolder({ ASKBOARD_CALLER_CWD: named }, "/plugin/root")).toBe("/plugin/root");
  });

  test("never reads CLAUDE_PROJECT_DIR: the session project root has its own rule (AD-12)", () => {
    expect(callerFolder({ CLAUDE_PROJECT_DIR: "/other" }, "/work/pay")).toBe("/work/pay");
  });

  test("the entry point gives the session process that folder as its working folder", () => {
    const entry = readFileSync(join(import.meta.dir, "..", "src", "session-entry.ts"), "utf8");
    expect(entry).toContain("cwd: callerFolder(process.env, process.cwd()),");
  });
});
