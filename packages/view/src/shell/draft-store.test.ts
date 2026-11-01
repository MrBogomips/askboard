import { describe, expect, mock, test } from "bun:test";
import { createDraftStore } from "./draft-store.ts";

// A test-only widget value, as a widget's model returns it: a new frozen object per edit.
type ProbeValue = { readonly size: number };
const probe = (size: number): ProbeValue => Object.freeze({ size });

describe("the draft record (design decisions 7 and 8, AD-20)", () => {
  test("an item starts unset: no value until one is put in", () => {
    const draft = createDraftStore();
    expect(draft.valueOf("database")).toBeUndefined();
    expect(draft.record().has("database")).toBe(false);
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

  test("subscribers hear each change, and only changes: arrays compare by element", () => {
    const draft = createDraftStore();
    const listener = mock(() => {});
    draft.subscribe(listener);
    draft.set("database", ["PostgreSQL"]);
    draft.set("database", ["PostgreSQL"]);
    draft.set("database", ["SQLite"]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("a widget's value is held as it is, and compared by identity", () => {
    const draft = createDraftStore();
    const listener = mock(() => {});
    draft.subscribe(listener);
    const first = probe(3);
    draft.set("sketch", first);
    expect(draft.valueOf("sketch")).toBe(first);
    const record = draft.record();
    draft.set("sketch", first);
    expect(draft.record()).toBe(record);
    draft.set("sketch", probe(3));
    expect(draft.record()).not.toBe(record);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("setting undefined removes the value, in a new record; on an unset item it changes nothing", () => {
    const draft = createDraftStore();
    const listener = mock(() => {});
    draft.subscribe(listener);
    draft.set("sketch", undefined);
    expect(listener).not.toHaveBeenCalled();
    draft.set("sketch", probe(3));
    draft.set("database", ["SQLite"]);
    const before = draft.record();
    draft.set("sketch", undefined);
    expect(draft.valueOf("sketch")).toBeUndefined();
    expect(draft.record().has("sketch")).toBe(false);
    expect(draft.record().get("database")).toEqual(["SQLite"]);
    expect(before.has("sketch")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
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
    draft.set("constructor", probe(1));
    expect(draft.valueOf("__proto__")).toEqual(["a"]);
    expect(draft.valueOf("constructor")).toEqual({ size: 1 });
    expect(draft.valueOf("toString")).toBeUndefined();
  });
});
