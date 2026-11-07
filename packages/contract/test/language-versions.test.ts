import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
} from "../src/index.ts";

// settings-languages, design decision 2: the input format and the board document take the next minor
// after `main`'s at group 0 (1.2, which E5 took); the board protocol takes 1.4, E7 (snapshot) having
// taken 1.3 before E8 landed.
// Later changes take the next minor again (chart-widget's, then atoms'): these hold the minors
// bound so far or a later one, and the atoms' version test pins the numbers of the latest.
describe("the minors settings-languages takes", () => {
  const minor = (version: string): number => Number(version.split(".")[1]);

  test("the input format is at chart-widget's minor or a later one, whose predecessor accepts it-IT", () => {
    expect(minor(INPUT_FORMAT_VERSION)).toBeGreaterThanOrEqual(8);
  });

  test("the board document is at chart-widget's minor or a later one, whose predecessor names the ask's language", () => {
    expect(minor(BOARD_DOCUMENT_VERSION)).toBeGreaterThanOrEqual(7);
  });

  test("the board protocol is at widget-registry's minor or a later one", () => {
    expect(minor(BOARD_PROTOCOL_VERSION)).toBeGreaterThanOrEqual(6);
  });
});
