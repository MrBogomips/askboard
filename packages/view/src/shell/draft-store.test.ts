import { describe, expect, mock, test } from "bun:test";
import { createDraftStore } from "./draft-store.ts";

describe("the draft record (design decision 8, AD-20)", () => {
  test("an item starts with nothing chosen, the same empty value every time", () => {
    const draft = createDraftStore();
    expect(draft.valueOf("database")).toEqual([]);
    expect(draft.valueOf("database")).toBe(draft.valueOf("other"));
  });

  test("a value goes in as a copy, in a new record; the old record is unchanged", () => {
    const draft = createDraftStore();
    const before = draft.record();
    const chosen = ["PostgreSQL"];
    draft.set("database", chosen);
    chosen.push("SQLite");
    expect(draft.valueOf("database")).toEqual(["PostgreSQL"]);
    expect(before.size).toBe(0);
    expect(draft.record()).not.toBe(before);
  });

  test("a value is read back as the same array until it changes", () => {
    const draft = createDraftStore();
    draft.set("database", ["PostgreSQL"]);
    expect(draft.valueOf("database")).toBe(draft.valueOf("database"));
  });

  test("subscribers hear each change, and only changes", () => {
    const draft = createDraftStore();
    const listener = mock(() => {});
    draft.subscribe(listener);
    draft.set("database", ["PostgreSQL"]);
    draft.set("database", ["PostgreSQL"]);
    draft.set("database", ["SQLite"]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("an unsubscribed listener hears nothing more", () => {
    const draft = createDraftStore();
    const listener = mock(() => {});
    const unsubscribe = draft.subscribe(listener);
    unsubscribe();
    draft.set("database", ["PostgreSQL"]);
    expect(listener).not.toHaveBeenCalled();
  });

  test("item IDs that name Object's own properties are plain keys", () => {
    const draft = createDraftStore();
    draft.set("__proto__", ["a"]);
    draft.set("constructor", ["b"]);
    expect(draft.valueOf("__proto__")).toEqual(["a"]);
    expect(draft.valueOf("constructor")).toEqual(["b"]);
    expect(draft.valueOf("toString")).toEqual([]);
  });
});
