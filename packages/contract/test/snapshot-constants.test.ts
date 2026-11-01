import { describe, expect, test } from "bun:test";
import {
  ID_PATTERN,
  SNAPSHOT_DATA_ELEMENT,
  SNAPSHOT_LICENCES_ELEMENT,
  SNAPSHOT_NAME_PATTERN,
  SNAPSHOT_NAME_TRIES,
  SNAPSHOT_RANDOM,
} from "../src/index.ts";

// The Snapshot constants (snapshot design decision 2; contract spec, Snapshot constants). The
// folder and the `.gitignore` lines are E8's `project-folder.ts`, which E7 reuses (task 0.2).

const name = new RegExp(SNAPSHOT_NAME_PATTERN);

describe("Snapshot constants", () => {
  test("the random part is 6 characters from [a-z0-9], and five names are tried", () => {
    expect(SNAPSHOT_RANDOM.length).toBe(6);
    expect([...SNAPSHOT_RANDOM.alphabet].sort().join("")).toBe(
      "0123456789abcdefghijklmnopqrstuvwxyz",
    );
    expect(SNAPSHOT_NAME_TRIES).toBe(5);
  });

  test("the data and licence blocks have the elements' IDs", () => {
    expect(SNAPSHOT_DATA_ELEMENT).toBe("askboard-data");
    expect(SNAPSHOT_LICENCES_ELEMENT).toBe("askboard-licences");
  });

  test("a name AskBoard chooses matches the pattern (the spec's example)", () => {
    expect(name.test("offer-k3x9-20261031T161205Z-a1b2c3.html")).toBe(true);
    expect(name.test(`${"a".repeat(64)}-20261031T161205Z-zzzzzz.html`)).toBe(true);
  });

  test.each([
    ["a colon in the time", "offer-2026-10-31T16:12:05Z-a1b2c3.html"],
    ["the extended form", "offer-20261031T16:12:05Z-a1b2c3.html"],
    ["no Z", "offer-20261031T161205-a1b2c3.html"],
    ["a fraction of a second", "offer-20261031T161205.123Z-a1b2c3.html"],
    ["a capital in the random part", "offer-20261031T161205Z-A1b2c3.html"],
    ["a short random part", "offer-20261031T161205Z-a1b2c.html"],
    ["a long random part", "offer-20261031T161205Z-a1b2c3d.html"],
    ["another extension", "offer-20261031T161205Z-a1b2c3.htm"],
    ["the partial file", ".offer-20261031T161205Z-a1b2c3.html.partial"],
    ["a slash in the ask ID", "a/b-20261031T161205Z-a1b2c3.html"],
    ["a dot in the ask ID", "a.b-20261031T161205Z-a1b2c3.html"],
    ["an empty ask ID", "-20261031T161205Z-a1b2c3.html"],
    ["an ask ID of 65 characters", `${"a".repeat(65)}-20261031T161205Z-a1b2c3.html`],
  ])("the pattern refuses %s", (_, refused) => {
    expect(name.test(refused)).toBe(false);
  });

  test("the pattern's ask ID is the contract's ID pattern", () => {
    const askId = ID_PATTERN.slice(1, -1);
    expect(SNAPSHOT_NAME_PATTERN.startsWith(`^${askId}-`)).toBe(true);
  });
});
