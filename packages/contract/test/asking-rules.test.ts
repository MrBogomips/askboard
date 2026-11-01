import { describe, expect, test } from "bun:test";
import { ASKING_RULES } from "../src/index.ts";
import ruleResponse from "../src/push/local-api/rule-response.json";

// The asking rules (contract spec, Asking rules; AD-16, FR-30): a closed set, which the local API's
// rule names. Each rule's predicate is `hooks`' (AD-16).

describe("the asking rules", () => {
  test("are none, always and with-references, as the local API's rule names them", () => {
    expect(ASKING_RULES).toEqual(["none", "always", "with-references"]);
    expect(ruleResponse.properties.rule.enum).toEqual([...ASKING_RULES]);
  });
});
