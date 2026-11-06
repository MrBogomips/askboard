import { describe, expect, test } from "bun:test";
import { noteReveal } from "./note-reveal.ts";

// Review F-27: "+ Add your note to this option" shows on hover and on focus, and its line is
// reserved, so the options below do not move; the browser scenario measures that.
describe("noteReveal", () => {
  test("hides by visibility, never by display, so the line stays", () => {
    for (const selected of [true, false]) expect(noteReveal(selected)).not.toMatch(/\bhidden\b/);
    expect(noteReveal(false)).toContain("invisible");
  });

  test("an option not chosen shows it on hover and on focus; a chosen one always", () => {
    expect(noteReveal(false)).toContain("group-hover/option:visible");
    expect(noteReveal(false)).toContain("group-focus-within/option:visible");
    expect(noteReveal(true)).toBe("visible");
  });
});
