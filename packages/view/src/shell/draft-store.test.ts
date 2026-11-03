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

  test("several items in one update make one new record holding both, heard once (molecules, design decision 11)", () => {
    const draft = createDraftStore();
    const listener = mock(() => {});
    draft.subscribe(listener);
    const before = draft.record();
    const own = probe(4);
    const sibling = probe(5);
    draft.update({ sketch: own, second: sibling });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(draft.record()).not.toBe(before);
    expect(draft.valueOf("sketch")).toBe(own);
    expect(draft.valueOf("second")).toBe(sibling);
    expect(before.size).toBe(0);
  });

  test("in one update, undefined removes a value and a new one goes in", () => {
    const draft = createDraftStore();
    draft.update({ sketch: probe(4), second: probe(5) });
    const listener = mock(() => {});
    draft.subscribe(listener);
    const kept = draft.valueOf("second");
    draft.update({ sketch: undefined, database: ["SQLite"] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(draft.record().has("sketch")).toBe(false);
    expect(draft.valueOf("database")).toEqual(["SQLite"]);
    expect(draft.valueOf("second")).toBe(kept);
  });

  test("an unchanged value keeps its identity; an update that changes nothing makes no record and is not heard", () => {
    const draft = createDraftStore();
    const own = probe(4);
    draft.update({ sketch: own, database: ["SQLite"] });
    const record = draft.record();
    const labels = draft.valueOf("database");
    const listener = mock(() => {});
    draft.subscribe(listener);
    draft.update({ sketch: own, database: ["SQLite"], missing: undefined });
    draft.update({});
    expect(listener).not.toHaveBeenCalled();
    expect(draft.record()).toBe(record);
    draft.update({ sketch: own, second: probe(5) });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(draft.valueOf("sketch")).toBe(own);
    expect(draft.valueOf("database")).toBe(labels);
  });

  test("an update's item IDs that name Object's own properties are plain keys", () => {
    const draft = createDraftStore();
    draft.update(Object.fromEntries([["__proto__", probe(1)]]));
    expect(draft.valueOf("__proto__")).toEqual({ size: 1 });
    expect(draft.valueOf("toString")).toBeUndefined();
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
