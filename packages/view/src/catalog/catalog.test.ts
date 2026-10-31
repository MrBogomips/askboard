import { describe, expect, mock, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { CHOICE, componentOf, componentsOf } from "./components.ts";
import {
  type CatalogComponent,
  componentFor,
  readyEffect,
  register,
  registeredComponents,
} from "./port.ts";

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

describe("a component reports ready after its content is laid out (AD-9)", () => {
  const frames = () => {
    const pending = new Map<number, () => void>();
    let next = 0;
    const request = mock((callback: () => void) => {
      next += 1;
      pending.set(next, callback);
      return next;
    });
    const cancel = mock((id: number) => {
      pending.delete(id);
    });
    const run = () => {
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback();
      }
    };
    return { request, cancel, run };
  };

  test("once settled, on the next frame, not during the layout effect", () => {
    const { request, cancel, run } = frames();
    const ready = mock(() => {});
    readyEffect(ready, true, request, cancel)();
    expect(ready).not.toHaveBeenCalled();
    run();
    expect(ready).toHaveBeenCalledTimes(1);
  });

  test("not while its asynchronous work has not settled", () => {
    const { request, cancel, run } = frames();
    const ready = mock(() => {});
    expect(readyEffect(ready, false, request, cancel)()).toBeUndefined();
    run();
    expect(request).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });

  test("not once the component is gone before the frame", () => {
    const { request, cancel, run } = frames();
    const ready = mock(() => {});
    readyEffect(ready, true, request, cancel)()?.();
    run();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
  });
});
