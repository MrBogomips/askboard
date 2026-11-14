import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DocumentReviewAnnotation } from "@askboard/contract";
import { el, fragment } from "../../test/fake-dom.ts";
import { detachedCheck } from "./detached-check.ts";
import { check, createPlaces, placesOf } from "./model.ts";
import { readingOfProps } from "./reading.ts";

// The check the chunk registers (document-review, design decision 8; re-review X-1 of 5.11):
// `check(result, props, (p) => readingOfProps(p, window))`, with the default renderer and the
// module's own `placesOf`. The `window` is read when it runs, so the module loads where there is
// none; the tests give it a stand-in that cannot sanitize, which the renderer answers with the
// source as plain text, so the reading text is the document's source.
const note = (id: string, exact: string): DocumentReviewAnnotation => ({
  id,
  target: { selector: { type: "quote", exact } },
  body: { text: "t" },
});

const SOURCE = "The board remembers drafts and keeps unsent answers.";
const WINDOW = {};
const host = globalThis as unknown as { window?: unknown };
let before: unknown;
beforeEach(() => {
  before = host.window;
  host.window = WINDOW;
});
afterEach(() => {
  host.window = before;
});

describe("the registered check", () => {
  test("loads and is a function where no window exists, and reads the window only when it runs", async () => {
    host.window = undefined;
    delete host.window;
    const module = await import("./detached-check.ts");
    expect(typeof module.detachedCheck).toBe("function");
    host.window = WINDOW;
    expect(module.detachedCheck({ annotations: [] }, { markdown: SOURCE })).toBeUndefined();
  });

  test("gives {code: detached, count} when an annotation has no place in the reading, and none when each has one", () => {
    const props = { markdown: SOURCE };
    expect(
      detachedCheck({ annotations: [note("u-1", "remembers"), note("u-2", "keeps")] }, props),
    ).toBeUndefined();
    expect(
      detachedCheck({ annotations: [note("u-1", "remembers"), note("u-2", "nowhere")] }, props),
    ).toEqual({ code: "detached", count: 1 });
    expect(
      detachedCheck({ annotations: [note("u-1", "gone"), note("u-2", "nowhere")] }, props),
    ).toEqual({ code: "detached", count: 2 });
  });

  test("agrees with the reading the component reads for the same props object: the one text", () => {
    const props = { markdown: SOURCE };
    const annotations = [note("u-1", "remembers"), note("u-2", "**remembers**")];
    const reading = readingOfProps(props, WINDOW as never);
    expect(reading.text).toBe(SOURCE);
    // The component places `annotations` in `reading` through `placesOf`: the check counts the same.
    const detached = placesOf(reading, annotations).filter((p) => p.status === "detached").length;
    expect(detached).toBe(1);
    expect(detachedCheck({ annotations }, props)).toEqual({ code: "detached", count: detached });
  });

  test("never throws on a value that is no result or no props, and has no result to fail with none", () => {
    for (const result of [undefined, null, 3, "x", [], {}, { annotations: "no" }]) {
      expect(detachedCheck(result, { markdown: SOURCE })).toBeUndefined();
    }
    expect(detachedCheck({ annotations: [note("u-1", "gone")] }, null)).toBeUndefined();
    expect(detachedCheck({ annotations: [note("u-1", "gone")] }, { markdown: 3 })).toBeUndefined();
  });
});

// Identity (re-review X-1 of 5.11): the check shares the component's reading and places. After it
// has run, `readingOfProps(props, window)` is the same reading, rendered once; placing the same list
// again does no new placement; and a wrapped renderer would break both.
describe("what the check shares with the component", () => {
  const countingRender = () => {
    const calls: string[] = [];
    const render = (source: string) => {
      calls.push(source);
      return undefined;
    };
    return { calls, render };
  };

  test("the reading is made once per props object, whoever asks first", () => {
    const { calls, render } = countingRender();
    const props = { markdown: SOURCE };
    const win = WINDOW as never;
    const annotations = [note("u-1", "remembers")];
    check({ annotations }, props, (p) => readingOfProps(p, win, render));
    const reading = readingOfProps(props, win, render);
    expect(readingOfProps(props, win, render)).toBe(reading);
    expect(calls).toEqual([SOURCE]);
  });

  test("placing the same list again does no new placement", () => {
    const props = { markdown: SOURCE };
    const win = WINDOW as never;
    const annotations = [note("u-1", "remembers"), note("u-2", "gone")];
    let placements = 0;
    const places = createPlaces((text, list) => {
      placements += 1;
      return placesOf(text, list);
    });
    check({ annotations }, props, (p) => readingOfProps(p, win), places);
    expect(placements).toBe(1);
    places(readingOfProps(props, win), annotations);
    places(readingOfProps(props, win), [...annotations]);
    expect(placements).toBe(1);
    // Typing in a card changes a body, never a selector: still the one placement.
    places(readingOfProps(props, win), [
      { ...annotations[0], body: { text: "typed" } } as DocumentReviewAnnotation,
      annotations[1] as DocumentReviewAnnotation,
    ]);
    expect(placements).toBe(1);
  });

  test("the component and the registered check name the shared calls, not a wrapped renderer", async () => {
    const read = (name: string) => Bun.file(new URL(name, import.meta.url)).text();
    const widget = await read("./widget.tsx");
    const registered = await read("./detached-check.ts");
    expect(widget).toContain("readingOfProps(props, window)");
    expect(widget).toContain("placesOf(reading, annotations)");
    expect(registered).toContain("readingOfProps(p, window)");
    expect(registered).not.toMatch(/renderMarkdown|=>\s*renderMarkdown/);
    expect(widget).not.toContain("renderMarkdown(");
  });

  test("a fragment's reading is shared too: a rendered fragment reads once for the component and the check", () => {
    // A renderer that gives a fragment of one paragraph, so that the reading text comes from the nodes.
    const render = () => fragment(el("p", {}, SOURCE)) as never;
    const props = { markdown: SOURCE };
    const win = WINDOW as never;
    const read = readingOfProps(props, win, render);
    expect(
      check({ annotations: [note("u-1", "remembers")] }, props, (p) =>
        readingOfProps(p, win, render),
      ),
    ).toBeUndefined();
    expect(readingOfProps(props, win, render)).toBe(read);
  });
});
