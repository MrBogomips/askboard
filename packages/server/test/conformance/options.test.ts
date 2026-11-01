import { describe, expect, test } from "bun:test";
import { meetsNodeFloor, parseOptions } from "./options.ts";

// The conformance suite's runner (task 9.2): which runtime runs the session process, which serves
// the real view build, `dist/view/`, and which of AD-1's configurations run (push delivery, 9.5).

describe("the runner's options", () => {
  test("take the runtime, and AD-1's three configurations unless one is named", () => {
    const all = ["mod-and-hooks", "mod-disabled", "hooks-disabled"] as const;
    expect(parseOptions(["--runtime", "bun"])).toEqual({ runtime: "bun", configurations: all });
    expect(parseOptions(["--runtime", "node"])).toEqual({ runtime: "node", configurations: all });
    for (const name of all) {
      expect(parseOptions(["--configuration", name, "--runtime", "node"])).toEqual({
        runtime: "node",
        configurations: [name],
      });
    }
  });

  test("refuse an unknown configuration", () => {
    for (const args of [
      ["--runtime", "bun", "--configuration"],
      ["--runtime", "bun", "--configuration", "mod-only"],
      ["--runtime", "bun", "--configuration", "all"],
    ]) {
      expect("error" in parseOptions(args)).toBe(true);
    }
  });

  test("refuse a missing or unknown runtime, a view build to choose and any other argument", () => {
    for (const args of [
      [],
      ["--runtime"],
      ["--runtime", "deno"],
      ["--runtime", "bun", "--view", "fixture"],
      ["--runtime", "bun", "--view", "dist"],
      ["--runtime", "bun", "--build"],
      ["bun"],
    ]) {
      const parsed = parseOptions(args);
      expect("error" in parsed).toBe(true);
    }
  });
});

describe("the Node floor (AD-19)", () => {
  test("is 24.22.1 or later", () => {
    for (const version of ["v24.22.1", "v24.22.2", "v24.23.0", "v25.0.0", "v26.1.0", "24.22.1"]) {
      expect(meetsNodeFloor(version)).toBe(true);
    }
    for (const version of ["v24.22.0", "v24.21.9", "v22.21.0", "v18.0.0", "", "1.4.4-bun", "vX"]) {
      expect(meetsNodeFloor(version)).toBe(false);
    }
  });
});
