import { describe, expect, test } from "bun:test";
import {
  IMAGE_MEDIA_TYPES,
  SOURCE_STATUSES,
  TEXT_MEDIA_TYPES,
  UNRESOLVED_REASONS,
} from "../src/index.ts";

// Contract spec, The unresolved-pointer warning (excerpts, proposal B9): the reasons a pointer
// stays unresolved, which `excerpts`, `ask-core`, the warning and the board document share.

describe("why a pointer stays unresolved (proposal B9)", () => {
  test("there are the ten reasons the PO accepted, in their order", () => {
    expect(UNRESOLVED_REASONS).toEqual([
      "no-root",
      "invalid-pointer",
      "outside-root",
      "not-found",
      "not-a-file",
      "anchor-not-found",
      "not-text",
      "not-image",
      "too-large",
      "timeout",
    ]);
  });
});

describe("what a resolved pointer's media type may be (proposal B5 and B6)", () => {
  test("text is Markdown or plain, and images are PNG, JPEG, GIF or WebP, never SVG", () => {
    expect(TEXT_MEDIA_TYPES).toEqual(["text/markdown", "text/plain"]);
    expect(IMAGE_MEDIA_TYPES).toEqual(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  });
});

describe("a source's state in the reading panel (board-host spec, The source view)", () => {
  test("is available, missing, outside the root, not text or too large", () => {
    expect(SOURCE_STATUSES).toEqual([
      "available",
      "missing",
      "outside-root",
      "not-text",
      "too-large",
    ]);
  });
});
