// The facts a component chunk registers beside its component (widget-registry, design decision 8):
// the shell reads them by the item's type and holds no table by widget type.

import { describe, expect, test } from "bun:test";
import { componentFacts, register } from "./port.ts";

const component = () => null;

describe("the facts registered with a component", () => {
  test("are given back by the component's name, with the shape and the name as registered", () => {
    const shape = () => ({ kind: "none" }) as never;
    register("facts-probe", component, { shape, name: "change.widgetTree" });
    expect(componentFacts("facts-probe")).toEqual({ shape, name: "change.widgetTree" });
  });

  test("are none for a component registered without, and for a name nothing registered", () => {
    register("facts-plain", component);
    expect(componentFacts("facts-plain")).toBeUndefined();
    expect(componentFacts("facts-nothing")).toBeUndefined();
  });

  test("a name of the object prototype has no facts", () => {
    expect(componentFacts("constructor")).toBeUndefined();
    expect(componentFacts("toString")).toBeUndefined();
  });

  test("a second registration of the name still fails, whatever its facts", () => {
    register("facts-twice", component, { name: "change.widgetTree" });
    expect(() => register("facts-twice", component, { name: "change.widgetGantt" })).toThrow(
      '"facts-twice"',
    );
    expect(componentFacts("facts-twice")?.name).toBe("change.widgetTree");
  });
});
