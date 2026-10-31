import { describe, expect, test } from "bun:test";
import { RUNTIMES, runtimeFrom, TARGETS, targetFrom } from "./target.ts";

describe("targetFrom", () => {
  test("talks to the test server when the variable is unset or empty", () => {
    expect(targetFrom(undefined)).toBe("test-server");
    expect(targetFrom(" ")).toBe("test-server");
    expect(TARGETS).toEqual(["test-server", "session-process"]);
  });

  test("talks to the built session process when the variable says so", () => {
    expect(targetFrom(" session-process ")).toBe("session-process");
  });

  test("fails on a target it does not know, naming the ones it does", () => {
    expect(() => targetFrom("board-host")).toThrow(
      'unknown target "board-host" in ASKBOARD_E2E_TARGET: test-server, session-process',
    );
  });
});

describe("runtimeFrom", () => {
  test("runs the session process on Bun unless Node is named", () => {
    expect(runtimeFrom(undefined)).toBe("bun");
    expect(runtimeFrom("node")).toBe("node");
    expect(RUNTIMES).toEqual(["bun", "node"]);
  });

  test("fails on a runtime it does not know", () => {
    expect(() => runtimeFrom("deno")).toThrow(
      'unknown runtime "deno" in ASKBOARD_E2E_RUNTIME: bun, node',
    );
  });
});
