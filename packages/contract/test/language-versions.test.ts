import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
} from "../src/index.ts";

// settings-languages, design decision 2: each set E8 changes takes the next minor after `main`'s at
// group 0, where the input format, the board document and the board protocol were at 1.2 (E5 took 1.2).
describe("the minors settings-languages takes", () => {
  test("the input format is at 1.3, which accepts it-IT", () => {
    expect(INPUT_FORMAT_VERSION).toBe("1.3");
  });

  test("the board document is at 1.3, which names the ask's language and locale", () => {
    expect(BOARD_DOCUMENT_VERSION).toBe("1.3");
  });

  test("the board protocol is at 1.3, which carries settings and setting", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.3");
  });
});
