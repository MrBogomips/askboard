// The configuration's and the board protocol's minors (keyboard-shortcuts-help, tasks 8.4 and 8.5;
// design decision 12). The numbers are pinned by the latest change that widens either set
// (answering-flow-guidance-sets.test.ts); here only the sets are checked against the constants.

import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, CONFIGURATION_VERSION, SCHEMA_SETS } from "../src/index.ts";

const versionOf = (name: string) => SCHEMA_SETS.find((set) => set.name === name)?.version;

describe("the configuration's minor", () => {
  test("the set carries the constant (the number is pinned by the latest change that widens it)", () => {
    expect(versionOf("configuration")).toBe(CONFIGURATION_VERSION);
  });
});

describe("the board protocol's minor", () => {
  test("the set carries the constant (the number is pinned by the latest change that widens it)", () => {
    expect(versionOf("board-protocol")).toBe(BOARD_PROTOCOL_VERSION);
  });
});
