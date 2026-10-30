import { describe, expect, test } from "bun:test";
import { ENGINES, enginesFrom } from "./engines.ts";

describe("enginesFrom", () => {
  test("runs every engine when the variable is unset or empty", () => {
    expect(enginesFrom(undefined)).toEqual([...ENGINES]);
    expect(enginesFrom(" ")).toEqual([...ENGINES]);
    expect(ENGINES).toEqual(["chromium", "firefox", "webkit"]);
  });

  test("runs the engines it names, in the harness's order", () => {
    expect(enginesFrom("webkit, chromium")).toEqual(["chromium", "webkit"]);
  });

  test("fails on an engine it does not know, naming the ones it does", () => {
    expect(() => enginesFrom("chromium,edge")).toThrow(
      'unknown engine "edge" in ASKBOARD_E2E_ENGINES: chromium, firefox, webkit',
    );
  });
});
