import { describe, expect, test } from "bun:test";
import { UNREGISTERED_TYPE } from "../src/fixtures/index.ts";
import { WIDGET_TYPES, widgetTypeOf } from "../src/index.ts";

describe("the unregistered type name of the fixtures", () => {
  test("no registered widget, FR-11 catalogue entry or context item takes it", () => {
    expect(widgetTypeOf(UNREGISTERED_TYPE)).toBeUndefined();
    expect(WIDGET_TYPES.map(({ type }) => type)).not.toContain(UNREGISTERED_TYPE);
    expect(["excerpt", "reference", "image", "molecule", "question"]).not.toContain(
      UNREGISTERED_TYPE,
    );
  });
});
