import { describe, expect, test } from "bun:test";
import { isolate } from "./bidi.ts";

describe("isolate", () => {
  test("wraps the text in a first-strong isolate", () => {
    expect(isolate("Database")).toBe("\u2068Database\u2069");
  });

  test("removes every embedding, override and isolate control, so a stray one cannot close the isolate", () => {
    expect(isolate("a\u202Eb\u2069c\u2066d\u202Ae\u202Cf")).toBe("\u2068abcdef\u2069");
  });
});
