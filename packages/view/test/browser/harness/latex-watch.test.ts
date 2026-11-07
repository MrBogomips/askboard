import { describe, expect, test } from "bun:test";
import type { BrowserContext } from "playwright";
import { WATCH, watching } from "./latex-watch.ts";

// The init script that watches a LaTeX board (task 6.8), run against stand-ins for the page.
const MATHML = "http://www.w3.org/1998/Math/MathML";

type Page = {
  __mathml: number;
  __lag: number;
  __events: { t: number; tex: string; at: number }[];
  __inputs: { t: number; value: string }[];
};

const run = () => {
  const created: string[] = [];
  const listeners: Record<string, (event: unknown) => void> = {};
  const observed: ((records: unknown[]) => void)[] = [];
  const page = {} as Page;
  class Document {
    createElementNS(_namespace: string, name: string) {
      created.push(name);
      return { name };
    }
    querySelectorAll() {
      return [];
    }
  }
  const document = Object.assign(new Document(), {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
  });
  class Observer {
    constructor(callback: (records: unknown[]) => void) {
      observed.push(callback);
    }
    observe() {}
  }
  const timers: (() => void)[] = [];
  new Function(
    "window",
    "document",
    "Document",
    "MutationObserver",
    "performance",
    "setInterval",
    WATCH,
  )(page, document, Document, Observer, { now: () => 100 }, (tick: () => void) =>
    timers.push(tick),
  );
  return { page, document, created, listeners, observed, timers, Document };
};

describe("the LaTeX board's watch script", () => {
  test("counts the MathML elements created and no others", () => {
    const { page, document } = run();
    expect(page.__mathml).toBe(0);
    document.createElementNS(MATHML, "math");
    document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    document.createElementNS(MATHML, "mi");
    expect(page.__mathml).toBe(2);
  });

  test("logs each input with the start of its value, and each annotation added with its source", () => {
    const { page, listeners, observed } = run();
    listeners.input?.({ target: { value: "abcdefghijkl" } });
    expect(page.__inputs.map((one) => one.value)).toEqual(["abcdefgh"]);
    const annotation = { textContent: "x^2", closest: () => null };
    observed[0]?.([
      {
        addedNodes: [
          {
            nodeType: 1,
            matches: () => true,
            textContent: "",
            closest: () => null,
            querySelectorAll: () => [],
          },
        ],
      },
      { addedNodes: [{ nodeType: 3 }] },
    ]);
    expect(page.__events).toHaveLength(1);
    observed[0]?.([
      {
        addedNodes: [{ nodeType: 1, matches: () => false, querySelectorAll: () => [annotation] }],
      },
    ]);
    expect(page.__events.map((one) => one.tex)).toEqual(["", "x^2"]);
  });

  test("registers the script on the context", async () => {
    const scripts: string[] = [];
    await watching({
      addInitScript: async (script: string) => scripts.push(script),
    } as never as BrowserContext);
    expect(scripts).toEqual([WATCH]);
  });
});
