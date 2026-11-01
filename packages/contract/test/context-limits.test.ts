import { describe, expect, test } from "bun:test";
import {
  ANCHOR_FILE_MAX_BYTES,
  ASK_IMAGES_MAX_BYTES,
  CONTEXT_READS_MAX,
  CONTEXT_RESOLVE_BUDGET_MS,
  CONTEXT_TITLE_MAX_CHARS,
  EXCERPT_MAX_BYTES,
  EXCERPT_MAX_LINES,
  IMAGE_ALT_MAX_CHARS,
  IMAGE_MAX_BYTES,
  POINTER_MAX_CHARS,
  SOURCE_VIEW_MAX_BYTES,
  SOURCE_VIEW_MAX_LINES,
  URL_MAX_CHARS,
} from "../src/index.ts";

// Contract spec, Context limits (excerpts, task 1.7; proposal B4): every unit reads these, and no
// unit defines its own.

const MIB = 1024 * 1024;

const LIMITS = {
  ANCHOR_FILE_MAX_BYTES,
  ASK_IMAGES_MAX_BYTES,
  CONTEXT_READS_MAX,
  CONTEXT_RESOLVE_BUDGET_MS,
  CONTEXT_TITLE_MAX_CHARS,
  EXCERPT_MAX_BYTES,
  EXCERPT_MAX_LINES,
  IMAGE_ALT_MAX_CHARS,
  IMAGE_MAX_BYTES,
  POINTER_MAX_CHARS,
  SOURCE_VIEW_MAX_BYTES,
  SOURCE_VIEW_MAX_LINES,
  URL_MAX_CHARS,
};

describe("context limits (proposal B4)", () => {
  test("every limit is a positive integer", () => {
    for (const [name, value] of Object.entries(LIMITS)) {
      expect({ name, integer: Number.isSafeInteger(value), positive: value > 0 }).toEqual({
        name,
        integer: true,
        positive: true,
      });
    }
  });

  test("an ask carries at least one image of the largest size", () => {
    expect(ASK_IMAGES_MAX_BYTES).toBeGreaterThanOrEqual(IMAGE_MAX_BYTES);
  });

  test("they hold the values the PO accepted", () => {
    expect(LIMITS).toEqual({
      ANCHOR_FILE_MAX_BYTES: 4 * MIB,
      ASK_IMAGES_MAX_BYTES: 16 * MIB,
      CONTEXT_READS_MAX: 8,
      CONTEXT_RESOLVE_BUDGET_MS: 5_000,
      CONTEXT_TITLE_MAX_CHARS: 256,
      EXCERPT_MAX_BYTES: 64 * 1024,
      EXCERPT_MAX_LINES: 1_000,
      IMAGE_ALT_MAX_CHARS: 1_000,
      IMAGE_MAX_BYTES: 4 * MIB,
      POINTER_MAX_CHARS: 1_024,
      SOURCE_VIEW_MAX_BYTES: 2 * MIB,
      SOURCE_VIEW_MAX_LINES: 20_000,
      URL_MAX_CHARS: 2_048,
    });
  });
});
