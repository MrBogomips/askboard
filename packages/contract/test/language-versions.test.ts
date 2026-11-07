import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
} from "../src/index.ts";

// settings-languages, design decision 2: the input format and the board document take the next minor
// after `main`'s at group 0 (1.2, which E5 took); the board protocol takes 1.4, E7 (snapshot) having
// taken 1.3 before E8 landed.
describe("the minors settings-languages takes", () => {
  test("the input format is at latex-kanban-timeline's minor, after approval-scale-ranking's, whose predecessor accepts it-IT", () => {
    expect(INPUT_FORMAT_VERSION).toBe("1.7");
  });

  test("the board document is at latex-kanban-timeline's minor, after approval-scale-ranking's, whose predecessor names the ask's language", () => {
    expect(BOARD_DOCUMENT_VERSION).toBe("1.6");
  });

  test("the board protocol is at widget-registry's minor, after widget-answers' and settings-languages'", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.6");
  });
});
