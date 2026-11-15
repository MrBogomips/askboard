// The configuration's and the board protocol's minors (answering-flow-guidance, task 1.1, design
// decision D9). The two numbers below are the minors this change holds beside the constants
// (askboard-contract-versioning, Rule 1); the rebase task binds them, and the next change that
// widens either set moves them.

import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, CONFIGURATION_VERSION, SCHEMA_SETS } from "../src/index.ts";

const versionOf = (name: string) => SCHEMA_SETS.find((set) => set.name === name)?.version;
const header = async (path: string) =>
  (await Bun.file(new URL(path, import.meta.url)).text()).split("\nimport ")[0];

describe("the configuration's minor", () => {
  test("is the minor answering-flow-guidance holds, and the set carries the constant", () => {
    expect(CONFIGURATION_VERSION).toBe("1.2");
    expect(versionOf("configuration")).toBe(CONFIGURATION_VERSION);
  });

  test("the module's header names this change", async () => {
    expect(await header("../src/schemas/configuration/index.ts")).toContain(
      "answering-flow-guidance",
    );
  });
});

describe("the board protocol's minor", () => {
  test("is the minor answering-flow-guidance holds, and the set carries the constant", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.11");
    expect(versionOf("board-protocol")).toBe(BOARD_PROTOCOL_VERSION);
  });

  test("the module's header names this change", async () => {
    expect(await header("../src/schemas/board-protocol/index.ts")).toContain(
      "answering-flow-guidance",
    );
  });
});
