import { describe, expect, test } from "bun:test";
import { el, type FakeNode, fragment } from "../../test/fake-dom.ts";
import {
  blocksOf,
  boundaryOffset,
  layoutOf,
  type ReadingNode,
  readingOf,
  readingOfProps,
  readingTextOf,
  selectedOffsets,
} from "./reading.ts";

// The reading text and the blocks (document-review, design decisions 5, 7 and 9): what a quote
// quotes, where a selection's boundary points fall in it, and the blocks the keyboard moves
// through. Fake nodes: Bun has no DOM.
const ui = (...children: (FakeNode | string)[]) =>
  el("span", { "data-review-ui": "" }, ...children);
const mark = (...children: (FakeNode | string)[]) =>
  el("span", { "data-review-mark": "u-1" }, ...children);

describe("the reading text", () => {
  test("is the text nodes of nested inline elements and blocks, in document order", () => {
    const root = fragment(
      el("h1", {}, "Title"),
      "\n",
      el("p", {}, "a ", el("strong", {}, "bold ", el("em", {}, "and em")), " c"),
      "\n",
      el("ul", {}, el("li", {}, "one"), el("li", {}, "two")),
    );
    expect(readingTextOf(root)).toBe("Title\na bold and em c\none" + "two");
  });

  test("leaves out every element the widget adds and keeps the marks", () => {
    const root = fragment(
      el(
        "p",
        {},
        "x ",
        mark("pass", ui("PIN", el("span", {}, "inner"))),
        "age",
        ui("↦ replacement"),
        " y",
      ),
    );
    expect(readingTextOf(root)).toBe("x passage y");
  });

  test("of an empty document is empty", () => {
    expect(readingTextOf(fragment())).toBe("");
  });
});

describe("readingOf is cached by source", () => {
  test("a source is rendered once, another source again, and the text is the fragment's", () => {
    let rendered = 0;
    const render = (source: string) => {
      rendered += 1;
      return fragment(el("p", {}, `<${source}>`)) as unknown as DocumentFragment;
    };
    const win = {} as never;
    expect(readingOf("one", win, render).text).toBe("<one>");
    expect(readingOf("one", win, render).text).toBe("<one>");
    expect(rendered).toBe(1);
    expect(readingOf("two", win, render).text).toBe("<two>");
    expect(rendered).toBe(2);
    expect(readingOf("one", win, render).text).toBe("<one>");
    expect(rendered).toBe(2);
  });

  test("a source the renderer refuses reads as the source itself, with no fragment", () => {
    const reading = readingOf("plain *text*", {} as never, () => undefined);
    expect(reading.text).toBe("plain *text*");
    expect(reading.fragment).toBeUndefined();
  });

  test("a renderer given a different function is not answered from another's cache", () => {
    const win = {} as never;
    const first = readingOf("same", win, () => fragment(el("p", {}, "A")) as never);
    const second = readingOf("same", win, () => fragment(el("p", {}, "B")) as never);
    expect(first.text).toBe("A");
    expect(second.text).toBe("B");
  });
});

describe("the reading is kept per item, by its props object", () => {
  const win = {} as never;
  const counting = () => {
    const rendered: string[] = [];
    const render = (source: string) => {
      rendered.push(source);
      return fragment(el("p", {}, `<${source}>`)) as unknown as DocumentFragment;
    };
    return { rendered, render };
  };

  test("32 items read over 4 passes are each rendered once", () => {
    const { rendered, render } = counting();
    const items = Array.from({ length: 32 }, (_, index) => ({ markdown: `doc ${index}` }));
    for (let pass = 0; pass < 4; pass += 1) {
      for (const props of items) readingOfProps(props, win, render);
    }
    expect(rendered).toHaveLength(32);
    expect(readingOfProps(items[5] as object, win, render).text).toBe("<doc 5>");
    expect(rendered).toHaveLength(32);
  });

  test("a new props object with the same markdown (a replaced document) renders once more", () => {
    const { rendered, render } = counting();
    const first = { markdown: "same" };
    const one = readingOfProps(first, win, render);
    expect(readingOfProps(first, win, render)).toBe(one);
    const second = { markdown: "same" };
    expect(readingOfProps(second, win, render)).not.toBe(one);
    expect(readingOfProps(second, win, render).text).toBe("<same>");
    expect(rendered).toHaveLength(2);
  });

  test("a renderer or window other than the cached one reads again", () => {
    const props = { markdown: "m" };
    const one = readingOfProps(props, win, () => fragment(el("p", {}, "A")) as never);
    const two = readingOfProps(props, win, () => fragment(el("p", {}, "B")) as never);
    expect([one.text, two.text]).toEqual(["A", "B"]);
  });

  test("props that hold no markdown read as the empty text, never a throw", () => {
    expect(readingOfProps({}, win, () => undefined).text).toBe("");
    expect(readingOfProps(null as never, win, () => undefined).text).toBe("");
  });
});

describe("boundary points as reading-text offsets", () => {
  const first = el("p", {}, "alpha ");
  const bold = el("strong", {}, "beta");
  const second = el("p", {}, "gamma");
  const inner = ui("PIN");
  const root = fragment(first, "\n", el("p", {}, bold, " ", inner, "x"), second);
  // "alpha " + "\n" + "beta" + " " + "x" + "gamma"
  const layout = layoutOf(root);

  test("inside a text node is its start plus the offset, cut to its length", () => {
    const alpha = first.childNodes[0] as FakeNode;
    expect(boundaryOffset(root, layout, alpha, 2)).toEqual({ kind: "in", offset: 2 });
    expect(boundaryOffset(root, layout, alpha, 99)).toEqual({ kind: "in", offset: 6 });
    const beta = bold.childNodes[0] as FakeNode;
    expect(boundaryOffset(root, layout, beta, 1)).toEqual({ kind: "in", offset: 8 });
  });

  test("on an element is the start of the child at that index, or the element's end", () => {
    expect(boundaryOffset(root, layout, first, 0)).toEqual({ kind: "in", offset: 0 });
    expect(boundaryOffset(root, layout, first, 1)).toEqual({ kind: "in", offset: 6 });
    expect(boundaryOffset(root, layout, root, 2)).toEqual({ kind: "in", offset: 7 });
  });

  test("inside a left-out element is where that element stands", () => {
    const pin = inner.childNodes[0] as FakeNode;
    expect(boundaryOffset(root, layout, pin, 2)).toEqual({ kind: "in", offset: 12 });
    expect(boundaryOffset(root, layout, inner, 0)).toEqual({ kind: "in", offset: 12 });
  });

  test("outside the document is before or after it, by document order", () => {
    const before = el("div", {}, "x");
    const after = el("div", {}, "y");
    const page = el("body", {}, before, root as FakeNode, after);
    expect(boundaryOffset(page.childNodes[1] as FakeNode, layout, before, 0)).toEqual({
      kind: "before",
    });
    expect(
      boundaryOffset(page.childNodes[1] as FakeNode, layout, after.childNodes[0] as FakeNode, 1),
    ).toEqual({
      kind: "after",
    });
  });

  test("an ancestor's offset is before or after the document by its child index", () => {
    const front = el("div", {});
    const back = el("div", {});
    const holder = el("div", {}, front, el("section", {}, "text"), back);
    const doc = holder.childNodes[1] as FakeNode;
    const docLayout = layoutOf(doc);
    expect(boundaryOffset(doc, docLayout, holder, 1)).toEqual({ kind: "before" });
    expect(boundaryOffset(doc, docLayout, holder, 2)).toEqual({ kind: "after" });
  });
});

describe("a selection as offsets", () => {
  const body = el("p", {}, "hello world");
  const doc = el("div", {}, body, el("p", {}, "second"));
  const text1 = body.childNodes[0] as FakeNode;
  const text2 = (doc.childNodes[1] as FakeNode).childNodes[0] as FakeNode;
  const range = (a: FakeNode, i: number, b: FakeNode, j: number) => ({
    startContainer: a,
    startOffset: i,
    endContainer: b,
    endOffset: j,
  });
  const read = (...ranges: ReturnType<typeof range>[]) => selectedOffsets(doc, ranges);

  test("one range inside the document gives its two offsets", () => {
    expect(read(range(text1, 6, text2, 3))).toEqual({ ok: true, start: 6, end: 14 });
  });

  test("no range and a collapsed one are no selection", () => {
    expect(read()).toEqual({ ok: false, reason: "none" });
    expect(read(range(text1, 4, text1, 4))).toEqual({ ok: false, reason: "none" });
  });

  test("several ranges are refused", () => {
    expect(read(range(text1, 0, text1, 2), range(text1, 3, text1, 5))).toEqual({
      ok: false,
      reason: "several-ranges",
    });
  });

  test("a range reaching outside the document is cut to it", () => {
    const outside = el("body", {}, el("p", {}, "head"), doc as FakeNode, el("p", {}, "tail"));
    const page = outside.childNodes[0]?.childNodes[0] as FakeNode;
    const tail = outside.childNodes[2]?.childNodes[0] as FakeNode;
    expect(selectedOffsets(doc, [range(page, 1, text1, 5)])).toEqual({
      ok: true,
      start: 0,
      end: 5,
    });
    expect(selectedOffsets(doc, [range(text2, 2, tail, 1)])).toEqual({
      ok: true,
      start: 13,
      end: 17,
    });
    expect(selectedOffsets(doc, [range(page, 0, tail, 1)])).toEqual({
      ok: true,
      start: 0,
      end: 17,
    });
  });

  test("a range wholly outside the document is refused as outside", () => {
    const outside = el("body", {}, el("p", {}, "head"), doc as FakeNode, el("p", {}, "tail"));
    const head = outside.childNodes[0]?.childNodes[0] as FakeNode;
    const tail = outside.childNodes[2]?.childNodes[0] as FakeNode;
    expect(selectedOffsets(doc, [range(head, 0, head, 3)])).toEqual({
      ok: false,
      reason: "outside",
    });
    expect(selectedOffsets(doc, [range(tail, 0, tail, 3)])).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  test("a range inside only a left-out element is no selection", () => {
    const pin = ui("PIN");
    const withPin = el("div", {}, el("p", {}, "text ", pin));
    const pinText = pin.childNodes[0] as FakeNode;
    expect(selectedOffsets(withPin, [range(pinText, 0, pinText, 3)])).toEqual({
      ok: false,
      reason: "none",
    });
  });
});

describe("blocks", () => {
  const offsets = (root: ReadingNode) =>
    blocksOf(root).map((block) => [block.element.nodeName, block.start, block.end]);

  test("are the innermost paragraph, heading, list item, code block or cell holding text", () => {
    const root = fragment(
      el("h2", {}, "Head"),
      "\n",
      el("ul", {}, el("li", {}, "\n", el("p", {}, "item para"), "\n")),
      el("pre", {}, el("code", {}, "code")),
      el("table", {}, el("tr", {}, el("th", {}, "H"), el("td", {}, "D"))),
    );
    expect(blocksOf(root).map((block) => block.element.nodeName)).toEqual([
      "H2",
      "P",
      "PRE",
      "TH",
      "TD",
    ]);
  });

  test("a list item with its own text is a block beside its nested items", () => {
    const root = fragment(
      el("ul", {}, el("li", {}, "outer ", el("ul", {}, el("li", {}, "inner")))),
    );
    expect(offsets(root)).toEqual([
      ["LI", 0, 5],
      ["LI", 6, 11],
    ]);
  });

  test("a range is trimmed of white space and a blank block is no block", () => {
    const root = fragment(el("p", {}, "  padded  "), el("p", {}, "   "), el("p", {}, "x"));
    expect(offsets(root)).toEqual([
      ["P", 2, 8],
      ["P", 13, 14],
    ]);
  });

  test("text in elements the widget adds belongs to no block, and marks do not split one", () => {
    const root = fragment(el("p", {}, "ab", mark("cd"), ui("PIN")), el("p", {}, "ef"));
    expect(offsets(root)).toEqual([
      ["P", 0, 4],
      ["P", 4, 6],
    ]);
  });
});
