// The configuration's and the board protocol's minors (keyboard-shortcuts-help, tasks 8.4 and 8.5;
// design decision 12). The two numbers below are the minors this change binds, beside the constants
// (askboard-contract-versioning, Rule 1); the next change that widens either set moves them.

import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, CONFIGURATION_VERSION, SCHEMA_SETS } from "../src/index.ts";

const versionOf = (name: string) => SCHEMA_SETS.find((set) => set.name === name)?.version;

describe("the configuration's minor", () => {
  test("is the minor keyboard-shortcuts-help binds, and the set carries the constant", () => {
    expect(CONFIGURATION_VERSION).toBe("1.1");
    expect(versionOf("configuration")).toBe(CONFIGURATION_VERSION);
  });
});

describe("the board protocol's minor", () => {
  test("is the minor keyboard-shortcuts-help binds, and the set carries the constant", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.10");
    expect(versionOf("board-protocol")).toBe(BOARD_PROTOCOL_VERSION);
  });
});
