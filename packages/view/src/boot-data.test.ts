import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { BOOT_DATA_ID, type BootData, parseBootData } from "./boot-data.ts";

const data: BootData = {
  document: plainChoiceBoardDocument,
  state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
};

describe("the askboard-data block the view boots from (AD-9)", () => {
  test("has the id the view looks for", () => {
    expect(BOOT_DATA_ID).toBe("askboard-data");
  });

  test("holds the board document and the state", () => {
    expect(parseBootData(JSON.stringify(data))).toEqual(data);
  });

  test("a missing or empty block fails", () => {
    expect(() => parseBootData(null)).toThrow("askboard-data");
    expect(() => parseBootData("")).toThrow("askboard-data");
  });

  test("a block without a board document and a state fails", () => {
    expect(() => parseBootData("[]")).toThrow("board document");
    expect(() => parseBootData(JSON.stringify({ document: data.document }))).toThrow("state");
  });
});
