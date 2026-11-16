// The theme a catalog component reads through the port (chart-widget, design decision 6): the pure
// core `themeOfClasses`, the store that watches the document root's class attribute with one
// observer however many components read it, and `useTheme` itself.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  colourSchemeOf,
  createThemeStore,
  themeOfClasses,
  useColourScheme,
  useTheme,
} from "./port.ts";

// The root as a class list a test can set, and an observer that records what it was asked and fires
// when the test says the attribute changed.
const fakeRoot = (...initial: string[]) => {
  const classes = new Set(initial);
  const attributes = new Map<string, string>();
  return {
    classes,
    attributes,
    classList: { contains: (name: string) => classes.has(name) },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
  };
};

const fakeObserver = () => {
  const made: {
    callback: () => void;
    observed: unknown[];
    options: unknown[];
    disconnected: number;
  }[] = [];
  class Observer {
    readonly #record: (typeof made)[number];
    constructor(callback: () => void) {
      this.#record = { callback, observed: [], options: [], disconnected: 0 };
      made.push(this.#record);
    }
    observe(target: unknown, options: unknown): void {
      this.#record.observed.push(target);
      this.#record.options.push(options);
    }
    disconnect(): void {
      this.#record.disconnected += 1;
    }
  }
  return { made, Observer };
};

describe("the theme a list of classes gives", () => {
  test("is dark while the list holds `dark`, else light", () => {
    expect(themeOfClasses(["dark"])).toBe("dark");
    expect(themeOfClasses(["comfortable", "dark"])).toBe("dark");
    expect(themeOfClasses([])).toBe("light");
    expect(themeOfClasses(["comfortable"])).toBe("light");
  });

  test("takes a whole token only", () => {
    expect(themeOfClasses(["darker", "not-dark", "dark-mode"])).toBe("light");
  });

  test("reads a DOM token list through `contains`", () => {
    expect(themeOfClasses(fakeRoot("dark").classList)).toBe("dark");
    expect(themeOfClasses(fakeRoot().classList)).toBe("light");
  });
});

describe("the theme store", () => {
  test("gives the theme of the root's classes and follows a change once notified", () => {
    const root = fakeRoot();
    const { made, Observer } = fakeObserver();
    const store = createThemeStore(root, Observer);
    expect(store.getSnapshot()).toBe("light");
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));
    root.toggle("dark", true);
    made[0]?.callback();
    expect(seen).toEqual(["dark"]);
    root.toggle("dark", false);
    made[0]?.callback();
    expect(seen).toEqual(["dark", "light"]);
  });

  test("watches the root's class and data-palette attributes and nothing else", () => {
    const root = fakeRoot();
    const { made, Observer } = fakeObserver();
    createThemeStore(root, Observer).subscribe(() => {});
    expect(made[0]?.observed).toEqual([root]);
    expect(made[0]?.options).toEqual([
      { attributes: true, attributeFilter: ["class", "data-palette"] },
    ]);
  });

  test("keeps one observer for two components, and lets go when the last leaves", () => {
    const root = fakeRoot();
    const { made, Observer } = fakeObserver();
    const store = createThemeStore(root, Observer);
    const calls = { first: 0, second: 0 };
    const stopFirst = store.subscribe(() => calls.first++);
    const stopSecond = store.subscribe(() => calls.second++);
    expect(made).toHaveLength(1);
    root.toggle("dark", true);
    made[0]?.callback();
    expect(calls).toEqual({ first: 1, second: 1 });
    stopFirst();
    expect(made[0]?.disconnected).toBe(0);
    made[0]?.callback();
    expect(calls).toEqual({ first: 1, second: 2 });
    stopSecond();
    expect(made[0]?.disconnected).toBe(1);
    store.subscribe(() => {});
    expect(made).toHaveLength(2);
  });

  test("an unsubscribe called twice disconnects once and spares the others", () => {
    const { made, Observer } = fakeObserver();
    const store = createThemeStore(fakeRoot(), Observer);
    const stop = store.subscribe(() => {});
    store.subscribe(() => {});
    stop();
    stop();
    expect(made[0]?.disconnected).toBe(0);
  });
});

// A component that reads the theme and writes it as text.
const Probe = (): ReactNode => createElement("span", null, useTheme());

describe("useTheme", () => {
  const root = fakeRoot();
  const { Observer } = fakeObserver();
  const saved = { document: globalThis.document, observer: globalThis.MutationObserver };

  beforeAll(() => {
    Object.assign(globalThis, {
      document: { documentElement: root },
      MutationObserver: Observer,
    });
  });
  afterAll(() => {
    Object.assign(globalThis, { document: saved.document, MutationObserver: saved.observer });
  });

  test("gives the theme the document's root holds, each time it renders", () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>light</span>");
    root.toggle("dark", true);
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>dark</span>");
    root.toggle("dark", false);
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>light</span>");
  });

  test("two components read the same theme", () => {
    root.toggle("dark", true);
    const html = renderToStaticMarkup(
      createElement("div", null, createElement(Probe), createElement(Probe)),
    );
    expect(html).toBe("<div><span>dark</span><span>dark</span></div>");
  });
});

describe("useTheme without a document", () => {
  test("is light", () => {
    const saved = globalThis.document;
    Object.assign(globalThis, { document: undefined });
    try {
      expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>light</span>");
    } finally {
      Object.assign(globalThis, { document: saved });
    }
  });
});

// The colour scheme (palettes, task 3.3, design decision D7): "<palette>/<theme>", from the root's
// class and its data-palette attribute, which a renderer re-reads its tokens on.
describe("the colour scheme a root gives", () => {
  test("is carta without the attribute, else the palette, with the theme", () => {
    expect(colourSchemeOf(fakeRoot())).toBe("carta/light");
    expect(colourSchemeOf(fakeRoot("dark"))).toBe("carta/dark");
    const root = fakeRoot();
    root.attributes.set("data-palette", "grafite");
    expect(colourSchemeOf(root)).toBe("grafite/light");
    root.toggle("dark", true);
    expect(colourSchemeOf(root)).toBe("grafite/dark");
  });

  test("an attribute that is no listed palette reads as carta", () => {
    const root = fakeRoot();
    for (const value of ["inchiostro", 'x"] body{', ""]) {
      root.attributes.set("data-palette", value);
      expect(colourSchemeOf(root)).toBe("carta/light");
    }
  });

  test("the store's scheme follows a change of the attribute alone, once notified", () => {
    const root = fakeRoot();
    const { made, Observer } = fakeObserver();
    const store = createThemeStore(root, Observer);
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getColourScheme()));
    root.attributes.set("data-palette", "nordico");
    made[0]?.callback();
    expect(seen).toEqual(["nordico/light"]);
    expect(store.getSnapshot()).toBe("light");
  });
});

const SchemeProbe = (): ReactNode => createElement("span", null, useColourScheme());

describe("useColourScheme", () => {
  const root = fakeRoot();
  const { Observer } = fakeObserver();
  const saved = { document: globalThis.document, observer: globalThis.MutationObserver };

  beforeAll(() => {
    Object.assign(globalThis, {
      document: { documentElement: root },
      MutationObserver: Observer,
    });
  });
  afterAll(() => {
    Object.assign(globalThis, { document: saved.document, MutationObserver: saved.observer });
  });

  test("gives the palette and theme the document's root holds", () => {
    expect(renderToStaticMarkup(createElement(SchemeProbe))).toBe("<span>carta/light</span>");
    root.attributes.set("data-palette", "contrasto");
    root.toggle("dark", true);
    expect(renderToStaticMarkup(createElement(SchemeProbe))).toBe("<span>contrasto/dark</span>");
  });
});
