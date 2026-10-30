import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { CHOICE, componentOf, componentsOf } from "./components.ts";
import { type CatalogComponent, componentFor, register, registeredComponents } from "./port.ts";

describe("which component renders an item (AD-9)", () => {
  test("a plain question is shown by the Choice atom", () => {
    const [question] = plainChoiceBoardDocument.items;
    expect(componentOf(question)).toBe(CHOICE);
    expect(CHOICE).toBe("choice");
  });

  test("a board needs each component once", () => {
    expect(componentsOf(plainChoiceBoardDocument)).toEqual(["choice"]);
  });
});

describe("the CatalogRenderer port", () => {
  const component: CatalogComponent = () => null;

  test("a registered component is found by its name", () => {
    register("test-widget", component);
    expect(componentFor("test-widget")).toBe(component);
    expect(registeredComponents()).toContain("test-widget");
  });

  test("an unknown name, an inherited one included, finds nothing", () => {
    expect(componentFor("test-unknown")).toBeUndefined();
    expect(componentFor("constructor")).toBeUndefined();
  });

  test("a second registration of one name fails, naming it", () => {
    register("test-twice", component);
    expect(() => register("test-twice", component)).toThrow('"test-twice"');
  });
});
