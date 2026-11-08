import { describe, expect, test } from "bun:test";
import { provide, shared } from "./shared-modules.ts";

describe("the shared-module registry (design decision 7)", () => {
  test("a module one chunk provides is the one the next chunk gets", () => {
    const module = { Checkbox: {} };
    provide("test-radix-ui", module);
    expect(shared("test-radix-ui")).toBe(module);
  });

  test("a module no chunk provided fails, naming it, as does an inherited name", () => {
    expect(() => shared("test-missing")).toThrow('"test-missing"');
    expect(() => shared("constructor")).toThrow('"constructor"');
  });

  test("a module provided twice fails, naming it", () => {
    provide("test-twice", {});
    expect(() => provide("test-twice", {})).toThrow('"test-twice"');
  });
});
