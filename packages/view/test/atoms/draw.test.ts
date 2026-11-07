import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { CatalogComponent } from "../../src/catalog/port.ts";
import { draw } from "./draw.ts";

// The helper the atoms' component tests draw with: it hands the component the port's props, whose
// callbacks record what they are given.
const Probe: CatalogComponent = ({ item, result }) =>
  createElement("span", null, `${(item as { id: string }).id}:${String(result)}`);

describe("draw", () => {
  test("renders the component with the item, the result and the locale it was given", () => {
    const drawn = draw(Probe, "probe", {}, { id: "x", result: 5 });
    expect(drawn.html).toBe("<span>x:5</span>");
  });

  test("the callbacks record what they are given and the no-ops take anything", () => {
    const { props, results, entries } = draw(Probe, "probe", {});
    props.onResultChange("a");
    props.onEntryChange("b");
    props.onValueChange(1);
    props.onValuesChange({});
    props.onDerived({});
    props.ready();
    expect(results).toEqual(["a"]);
    expect(entries).toEqual(["b"]);
  });

  test("the server renderer gets the browser's frame functions, which only a layout effect's default reads", () => {
    expect(requestAnimationFrame(() => {})).toBe(0);
    expect(cancelAnimationFrame(0)).toBeUndefined();
  });

  test("a missing component is an error naming the type", () => {
    expect(() => draw(undefined, "probe", {})).toThrow("no probe chunk registered");
  });
});
