// The reading text and the blocks of a Document review (document-review, design decisions 5, 7 and
// 9): the document as the user reads it, which is what a quote quotes, and the places in it a
// selection's boundary points and the keyboard's current block stand at. The reads are structural,
// over the few properties of a DOM node they need, as the Markdown links' are, so that the logic
// runs in Bun without a DOM. Every element the widget adds carries `data-review-ui` and is left
// out of the reading text; the marks it wraps passages in (`data-review-mark`) are kept, since
// their text is the passage's. No regular expression over the text: it is agent text.

import { renderMarkdown } from "@askboard/view/markdown";

/** What the reads need of a node (a DOM `Node` has every property but `hasAttribute`'s). */
export type ReadingNode = {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly nodeValue: string | null;
  readonly childNodes: ArrayLike<ReadingNode>;
  readonly parentNode: ReadingNode | null;
  hasAttribute?(name: string): boolean;
};

/** The root of a document: a node that can tell where another stands against it. */
export type ReadingRoot = ReadingNode & { compareDocumentPosition(other: never): number };

const ELEMENT = 1;
const TEXT = 3;
const PRECEDING = 2;

/** The attribute every element the widget adds carries, so that the reading text leaves it out. */
export const UI_ATTRIBUTE = "data-review-ui";

// The blocks the keyboard moves through (design decision 9).
const BLOCK_NAMES: ReadonlySet<string> = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "PRE",
  "TD",
  "TH",
]);

const isLeftOut = (node: ReadingNode): boolean =>
  node.nodeType === ELEMENT && node.hasAttribute?.(UI_ATTRIBUTE) === true;

const children = (node: ReadingNode): ReadingNode[] => Array.from(node.childNodes);

/** One text node's place in the reading text: the UTF-16 range `[start, end)`. */
export type TextRun = { readonly node: ReadingNode; readonly start: number; readonly end: number };

/** The reading text of a document and where each of its nodes stands in it. */
export type Layout = {
  readonly text: string;
  /** The text nodes of the document, in order, with their ranges. */
  readonly runs: readonly TextRun[];
  /** Where each visited node starts and ends; a left-out element has no extent. */
  readonly starts: ReadonlyMap<ReadingNode, number>;
  readonly ends: ReadonlyMap<ReadingNode, number>;
};

/** The layout of the document below `root`: its text nodes in order, left-out subtrees skipped. */
export const layoutOf = (root: ReadingNode): Layout => {
  const runs: TextRun[] = [];
  const starts = new Map<ReadingNode, number>();
  const ends = new Map<ReadingNode, number>();
  const parts: string[] = [];
  let at = 0;
  const walk = (node: ReadingNode): void => {
    starts.set(node, at);
    if (node.nodeType === TEXT) {
      const data = node.nodeValue ?? "";
      parts.push(data);
      at += data.length;
      runs.push({ node, start: at - data.length, end: at });
    } else if (!isLeftOut(node)) {
      for (const child of children(node)) walk(child);
    }
    ends.set(node, at);
  };
  walk(root);
  return { text: parts.join(""), runs, starts, ends };
};

/** The reading text of the document below `root`. */
export const readingTextOf = (root: ReadingNode): string => layoutOf(root).text;

/** What a source reads as: its text, and the fragment the renderer made (none for plain text). */
export type Reading = { readonly text: string; readonly fragment: DocumentFragment | undefined };

type Win = Parameters<typeof renderMarkdown>[1];
type Render = (source: string, win: Win) => DocumentFragment | undefined;

const CACHE_SIZE = 8;
const cache = new Map<string, { readonly render: Render; readonly reading: Reading }>();

/**
 * The reading of a Markdown source through the shared renderer, cached by source in a small
 * least-recently-used cache, for a caller that has a source and no props object (the item path is
 * `readingOfProps`). A source the renderer
 * refuses, over its bounds or on a window that cannot sanitize, is shown as plain text, so its
 * reading text is the source. `render` is the renderer, given for a test.
 */
export const readingOf = (markdown: string, win: Win, render: Render = renderMarkdown): Reading => {
  const known = cache.get(markdown);
  if (known !== undefined && known.render === render) return known.reading;
  const fragment = render(markdown, win);
  const reading: Reading = {
    text: fragment === undefined ? markdown : readingTextOf(fragment as unknown as ReadingNode),
    fragment,
  };
  cache.delete(markdown);
  cache.set(markdown, { render, reading });
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return reading;
};

const kept = new WeakMap<
  object,
  { readonly win: Win; readonly render: Render; readonly reading: Reading }
>();

/**
 * The reading of an item, kept per item (review X-1 and U-1 of 5.6, design decision 7): in a
 * `WeakMap` keyed by the item's props object, which the shell passes unchanged while the document
 * stays, so a board of any number of Document reviews renders each source once, with no capacity
 * to outgrow, the component and the chunk's `check` sharing the one reading. A props object that
 * replaces another, even with the same `markdown`, renders once more, and the old one's reading
 * goes with it. Props that hold no `markdown` read as the empty text.
 */
export const readingOfProps = (
  props: object,
  win: Win,
  render: Render = renderMarkdown,
): Reading => {
  const known = typeof props === "object" && props !== null ? kept.get(props) : undefined;
  if (known !== undefined && known.win === win && known.render === render) return known.reading;
  const markdown = (props as { markdown?: unknown } | null)?.markdown;
  const source = typeof markdown === "string" ? markdown : "";
  const fragment = render(source, win);
  const reading: Reading = {
    text: fragment === undefined ? source : readingTextOf(fragment as unknown as ReadingNode),
    fragment,
  };
  if (typeof props === "object" && props !== null) kept.set(props, { win, render, reading });
  return reading;
};

/** The reading text of a source: `readingOf(...).text`. */
export const readingText = (markdown: string, win: Win, render: Render = renderMarkdown): string =>
  readingOf(markdown, win, render).text;

/** Where a boundary point stands against the document: at an offset of its text, or outside. */
export type Boundary =
  | { readonly kind: "in"; readonly offset: number }
  | { readonly kind: "before" }
  | { readonly kind: "after" };

const within = (root: ReadingNode, node: ReadingNode): boolean => {
  for (let at: ReadingNode | null = node; at !== null; at = at.parentNode)
    if (at === root) return true;
  return false;
};

// The element the widget added that holds the node, or is it: it stands for everything inside.
const leftOutHolding = (layout: Layout, node: ReadingNode): ReadingNode | undefined => {
  for (let at: ReadingNode | null = node; at !== null; at = at.parentNode) {
    if (isLeftOut(at) && layout.starts.has(at)) return at;
  }
  return undefined;
};

// The side of the document a node outside it stands: the ancestors by their child index.
const sideOf = (root: ReadingRoot, node: ReadingNode, offset: number): Boundary => {
  if (within(node, root)) {
    let child: ReadingNode = root;
    while (child.parentNode !== null && child.parentNode !== node) child = child.parentNode;
    const index = children(node).indexOf(child);
    return offset <= index ? { kind: "before" } : { kind: "after" };
  }
  const position = root.compareDocumentPosition(node as never);
  return position & PRECEDING ? { kind: "before" } : { kind: "after" };
};

/**
 * A DOM boundary point, a node and an offset in it, as an offset of the reading text: inside a text
 * node it is the node's start plus the offset, cut to its length; on an element, the start of the
 * child at that index, or the element's end; inside an element the widget added, where that element
 * stands. A point outside the document is `before` or `after` it, by document order.
 */
export const boundaryOffset = (
  root: ReadingRoot,
  layout: Layout,
  node: ReadingNode,
  offset: number,
): Boundary => {
  if (!within(root, node)) return sideOf(root, node, offset);
  const stand = leftOutHolding(layout, node);
  if (stand !== undefined) return { kind: "in", offset: layout.starts.get(stand) ?? 0 };
  if (node.nodeType === TEXT) {
    const start = layout.starts.get(node) ?? 0;
    const length = (node.nodeValue ?? "").length;
    return { kind: "in", offset: start + Math.min(Math.max(offset, 0), length) };
  }
  const own = children(node);
  const child = own[offset];
  return {
    kind: "in",
    offset: (child === undefined ? layout.ends.get(node) : layout.starts.get(child)) ?? 0,
  };
};

/** The ends of a DOM range, as the selection gives them. */
export type SelectionRange = {
  readonly startContainer: ReadingNode;
  readonly startOffset: number;
  readonly endContainer: ReadingNode;
  readonly endOffset: number;
};

export type Selected =
  | { readonly ok: true; readonly start: number; readonly end: number }
  | { readonly ok: false; readonly reason: "none" | "several-ranges" | "outside" };

/**
 * The selection `ranges` as offsets of the document's reading text. No range, a collapsed one, or
 * one inside only elements the widget added is no selection (`none`); more than one range is
 * refused (`several-ranges`, Firefox's multiple selection); one that reaches outside the document
 * is cut to it, and one wholly outside is `outside`.
 */
export const selectedOffsets = (
  root: ReadingRoot,
  ranges: readonly SelectionRange[],
  layout: Layout = layoutOf(root),
): Selected => {
  if (ranges.length > 1) return { ok: false, reason: "several-ranges" };
  const range = ranges[0];
  if (range === undefined) return { ok: false, reason: "none" };
  const from = boundaryOffset(root, layout, range.startContainer, range.startOffset);
  const to = boundaryOffset(root, layout, range.endContainer, range.endOffset);
  if (from.kind === "after" || to.kind === "before") return { ok: false, reason: "outside" };
  const start = from.kind === "in" ? from.offset : 0;
  const end = to.kind === "in" ? to.offset : layout.text.length;
  return end > start ? { ok: true, start, end } : { ok: false, reason: "none" };
};

/** A block of the document: its element and the range of its own text, trimmed of white space. */
export type ReadingBlock = {
  readonly element: ReadingNode;
  readonly start: number;
  readonly end: number;
};

/**
 * The blocks of the document in order: the innermost paragraph, heading, list item, code block or
 * table cell that holds text of its own (so a list item holding a paragraph gives the paragraph),
 * each with the range of that text trimmed of white space. A block holding only white space is
 * none, and text inside elements the widget added belongs to no block.
 */
export const blocksOf = (root: ReadingNode, layout: Layout = layoutOf(root)): ReadingBlock[] => {
  const order: ReadingNode[] = [];
  const found = new Map<ReadingNode, { start: number; end: number }>();
  const stack: ReadingNode[] = [];
  const walk = (node: ReadingNode): void => {
    if (node.nodeType === TEXT) {
      const owner = stack.at(-1);
      const start = layout.starts.get(node) ?? 0;
      const end = layout.ends.get(node) ?? start;
      // Only text that is more than white space makes a block: a list item holding a paragraph
      // owns the line feeds around it and no more.
      if (owner === undefined || (node.nodeValue ?? "").trim() === "") return;
      found.set(owner, { start: found.get(owner)?.start ?? start, end });
      return;
    }
    if (node.nodeType !== ELEMENT && node.nodeType !== 11) return;
    if (isLeftOut(node)) return;
    const block = node.nodeType === ELEMENT && BLOCK_NAMES.has(node.nodeName.toUpperCase());
    if (block) {
      stack.push(node);
      order.push(node);
    }
    for (const child of children(node)) walk(child);
    if (block) stack.pop();
  };
  walk(root);
  const blocks: ReadingBlock[] = [];
  for (const element of order) {
    const range = found.get(element);
    if (range === undefined) continue;
    const own = layout.text.slice(range.start, range.end);
    const lead = own.length - own.trimStart().length;
    const trail = own.length - own.trimEnd().length;
    if (lead === own.length) continue;
    blocks.push({ element, start: range.start + lead, end: range.end - trail });
  }
  return blocks;
};
