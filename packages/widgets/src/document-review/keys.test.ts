import { describe, expect, test } from "bun:test";
import { blockAfterKey, pinAfterKey } from "./keys.ts";

// The document's keys (view-and-widgets spec: A Document review at the keyboard; EXPERIENCE,
// Accessibility Floor): Up, Down, Home and End move the current block, Left and Right move between
// the current block's pins; every other key, and any modified key, is left to the browser.
describe("blockAfterKey", () => {
  test("Down and Up move one block and stop at the ends", () => {
    expect(blockAfterKey(5, 0, "ArrowDown")).toBe(1);
    expect(blockAfterKey(5, 4, "ArrowDown")).toBe(4);
    expect(blockAfterKey(5, 3, "ArrowUp")).toBe(2);
    expect(blockAfterKey(5, 0, "ArrowUp")).toBe(0);
  });

  test("Home and End go to the first and the last block", () => {
    expect(blockAfterKey(5, 3, "Home")).toBe(0);
    expect(blockAfterKey(5, 1, "End")).toBe(4);
  });

  test("another key, or a document with no block, moves nothing", () => {
    expect(blockAfterKey(5, 1, "a")).toBeUndefined();
    expect(blockAfterKey(5, 1, "ArrowLeft")).toBeUndefined();
    expect(blockAfterKey(5, 1, "Enter")).toBeUndefined();
    expect(blockAfterKey(0, 0, "ArrowDown")).toBeUndefined();
  });

  test("a current block past the end is brought back before it moves", () => {
    expect(blockAfterKey(3, 9, "ArrowUp")).toBe(1);
    expect(blockAfterKey(3, 9, "ArrowDown")).toBe(2);
  });

  test("never answers for an inherited name", () => {
    expect(blockAfterKey(5, 1, "constructor")).toBeUndefined();
    expect(blockAfterKey(5, 1, "__proto__")).toBeUndefined();
  });
});

describe("pinAfterKey", () => {
  test("Right goes from the block to its first pin, then on, stopping at the last", () => {
    expect(pinAfterKey(3, "block", "ArrowRight")).toBe(0);
    expect(pinAfterKey(3, 0, "ArrowRight")).toBe(1);
    expect(pinAfterKey(3, 2, "ArrowRight")).toBe(2);
  });

  test("Left goes back, and from the first pin to the block", () => {
    expect(pinAfterKey(3, 2, "ArrowLeft")).toBe(1);
    expect(pinAfterKey(3, 0, "ArrowLeft")).toBe("block");
    expect(pinAfterKey(3, "block", "ArrowLeft")).toBeUndefined();
  });

  test("a block with no pin, or another key, moves nothing", () => {
    expect(pinAfterKey(0, "block", "ArrowRight")).toBeUndefined();
    expect(pinAfterKey(0, "block", "ArrowLeft")).toBeUndefined();
    expect(pinAfterKey(3, 0, "ArrowDown")).toBeUndefined();
    expect(pinAfterKey(3, 0, "Enter")).toBeUndefined();
  });
});
