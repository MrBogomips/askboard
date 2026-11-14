// The marks of a Document review (document-review, design decision 7): the plan of the placed
// annotations, and its application to a fresh clone of the document. Each text node segment of a
// passage is wrapped in a `span`, and after the passage stands one element the widget adds, which
// holds the pin's slot and, for a suggested edit, the replacement as a text node. Everything the
// widget creates carries `data-review-ui` (or `data-review-mark` on a passage's span) so that the
// reading text leaves it out; only `class` and those two attributes are ever set, never `style`,
// and agent and user text reach the document as text nodes, never as markup. The reads and writes
// are structural, so that the logic runs in Bun without a DOM.

import type { AnnotationPlace, DocumentReviewAnnotation } from "@askboard/contract";
import { AFTER, MARK, MARK_SUGGESTED, PIN_SLOT, REPLACEMENT } from "./classes.ts";
import { layoutOf, type ReadingNode, type TextRun, UI_ATTRIBUTE } from "./reading.ts";

/** The attribute a passage's span carries: the annotation's ID. */
export const MARK_ATTRIBUTE = "data-review-mark";

/** One placed annotation, as the marks need it: where, its pin's number and its kind. */
export type MarkSpec = {
  readonly id: string;
  /** The pin's number: its place among the placed annotations, in the document's order. */
  readonly number: number;
  readonly start: number;
  readonly end: number;
  /** The annotation holds a `replacement`: a suggested edit. */
  readonly suggested: boolean;
  readonly replacement: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The plan of the placed annotations, in the document's order and numbered from 1; a detached one
 * has no mark and no number. `places` are `placeAnnotations`' over the same `annotations`.
 */
export const markSpecs = (
  places: readonly AnnotationPlace[],
  annotations: readonly DocumentReviewAnnotation[],
): MarkSpec[] => {
  const placed: Omit<MarkSpec, "number">[] = [];
  places.forEach((place, index) => {
    if (place.status !== "placed") return;
    const body: unknown = isRecord(annotations[index]) ? annotations[index]?.body : undefined;
    const replacement = isRecord(body) ? body.replacement : undefined;
    placed.push({
      id: place.id,
      start: place.start,
      end: place.end,
      suggested: typeof replacement === "string",
      replacement: typeof replacement === "string" ? replacement : "",
    });
  });
  return placed
    .sort((a, b) => a.start - b.start)
    .map((spec, index) => ({ ...spec, number: index + 1 }));
};

/**
 * Whether two plans mark the same places in the same way: the same annotations over the same
 * ranges, each a comment or a suggestion alike. A replacement's text is no part of it, since
 * typing updates its text node in place (`setReplacements`), and a plan that is the same is not
 * applied again.
 */
export const samePlan = (a: readonly MarkSpec[], b: readonly MarkSpec[]): boolean =>
  a.length === b.length &&
  a.every((spec, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      spec.id === other.id &&
      spec.start === other.start &&
      spec.end === other.end &&
      spec.suggested === other.suggested
    );
  });

/** A node that can be written into: the part of a DOM element the marks use. */
export type MarkElement = ReadingNode & {
  setAttribute(name: string, value: string): void;
  appendChild(node: never): unknown;
};

/** A text node the marks split and update. */
export type MarkText = ReadingNode & {
  data: string;
  readonly nextSibling: unknown;
  splitText(offset: number): MarkText;
};

/** What the marks create nodes through: the document the clone belongs to. */
export type MarkDocument = {
  createElement(name: "span"): MarkElement;
  createTextNode(data: string): MarkText;
};

type Parent = { insertBefore(node: never, before: never): unknown };

/** The nodes applying a plan made, which the component draws pins into and updates. */
export type Marked = {
  /** Each pin's slot, by annotation ID: where the shared pin is drawn. */
  readonly pins: ReadonlyMap<string, MarkElement>;
  /** Each suggested edit's replacement text node, by annotation ID. */
  readonly replacements: ReadonlyMap<string, MarkText>;
};

// White-space text between blocks and list items is not content: a mark over it would put an
// element where only markup structure may stand.
const LOOSE: ReadonlySet<string> = new Set(["UL", "OL", "TABLE", "THEAD", "TBODY", "TFOOT", "TR"]);

type Segment = { readonly node: MarkText; readonly from: number; readonly to: number };

const segmentsOf = (runs: readonly TextRun[], spec: MarkSpec, root: ReadingNode): Segment[] =>
  runs.flatMap((run): Segment[] => {
    const from = Math.max(spec.start, run.start);
    const to = Math.min(spec.end, run.end);
    if (to <= from) return [];
    const data = run.node.nodeValue ?? "";
    const parent = run.node.parentNode;
    const loose = parent === root || (parent !== null && LOOSE.has(parent.nodeName.toUpperCase()));
    if (loose && data.slice(from - run.start, to - run.start).trim() === "") return [];
    return [{ node: run.node as MarkText, from: from - run.start, to: to - run.start }];
  });

const withAttributes = (
  element: MarkElement,
  attributes: Readonly<Record<string, string>>,
): MarkElement => {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
};

// Wraps the segment's text in a mark: the node is split at both ends so that the middle is the
// segment, and goes into a new span. Splitting keeps the first part in the original node, so the
// segments of earlier annotations in the same text node keep their offsets when later ones are
// applied first.
const wrap = (segment: Segment, spec: MarkSpec, doc: MarkDocument): MarkElement | undefined => {
  let target = segment.node;
  if (segment.from > 0) target = target.splitText(segment.from);
  if (segment.to - segment.from < target.data.length) target.splitText(segment.to - segment.from);
  const parent = target.parentNode as unknown as Parent | null;
  if (parent === null) return undefined;
  const span = withAttributes(doc.createElement("span"), {
    class: spec.suggested ? MARK_SUGGESTED : MARK,
    [MARK_ATTRIBUTE]: spec.id,
  });
  parent.insertBefore(span as never, target as never);
  span.appendChild(target as never);
  return span;
};

// The node a passage's last mark is followed by: the mark itself, or the outermost `a` above it
// inside `root` (the agent's own link, never the widget's).
const outsideAnchors = (mark: MarkElement, root: ReadingNode): MarkElement => {
  let end: ReadingNode = mark;
  for (let at = mark.parentNode; at !== null && at !== root; at = at.parentNode) {
    if (at.nodeName.toUpperCase() === "A") end = at;
  }
  return end as MarkElement;
};

/**
 * Applies the plan to `root`, a fresh clone of the document (the plan is for the clone's reading
 * text, which a clone shares with the original): the segments of each passage in marks, and after
 * each passage the element holding the replacement text node (a suggested edit's) and the pin's
 * slot. Annotations are applied from the last to the first, so that offsets of a text node an
 * earlier one also marks stay valid. A passage with no segment to mark gets none.
 */
export const applyMarks = (
  root: ReadingNode,
  specs: readonly MarkSpec[],
  doc: MarkDocument,
): Marked => {
  const { runs } = layoutOf(root);
  const planned = specs.map((spec) => ({ spec, segments: segmentsOf(runs, spec, root) }));
  const pins = new Map<string, MarkElement>();
  const replacements = new Map<string, MarkText>();
  for (const { spec, segments } of [...planned].reverse()) {
    let last: MarkElement | undefined;
    for (const segment of [...segments].reverse()) {
      const span = wrap(segment, spec, doc);
      last ??= span;
    }
    if (last === undefined) continue;
    // After the passage, and after the outermost anchor it ends in, never inside one: the agent's
    // link must keep its own text and name, and a click or Enter on a pin must not open it.
    const end = outsideAnchors(last, root);
    const parent = end.parentNode as unknown as Parent | null;
    if (parent === null) continue;
    const after = withAttributes(doc.createElement("span"), {
      class: spec.suggested ? `${AFTER} ${REPLACEMENT}` : AFTER,
      [UI_ATTRIBUTE]: "",
    });
    if (spec.suggested) {
      const replacement = doc.createTextNode(spec.replacement);
      after.appendChild(replacement as never);
      replacements.set(spec.id, replacement);
    }
    const slot = withAttributes(doc.createElement("span"), {
      class: PIN_SLOT,
      [UI_ATTRIBUTE]: "",
    });
    after.appendChild(slot as never);
    pins.set(spec.id, slot);
    parent.insertBefore(after as never, (end as unknown as { nextSibling: never }).nextSibling);
  }
  return { pins: orderOf(pins, specs), replacements };
};

// The pins in the plan's order, whichever order they were made in.
const orderOf = (
  pins: ReadonlyMap<string, MarkElement>,
  specs: readonly MarkSpec[],
): ReadonlyMap<string, MarkElement> =>
  new Map(
    specs.flatMap((spec): [string, MarkElement][] => {
      const slot = pins.get(spec.id);
      return slot === undefined ? [] : [[spec.id, slot]];
    }),
  );

type Replacer = { replaceChild(node: never, old: never): unknown };

/**
 * `next`, a plan applied to a fresh clone, with each pin slot an earlier application of the plan
 * also had put back in the clone's place for it, by annotation ID: the slot moves into the new
 * holder, so what React drew into it (the pin, and the card anchored to it) stays mounted, and an
 * open card keeps its text and focus while a new plan is applied around it. A slot with no
 * counterpart in `previous` stays the new one; with no `previous`, `next` is returned as it is.
 */
export const reuseSlots = (next: Marked, previous: Marked | undefined): Marked => {
  if (previous === undefined) return next;
  const pins = new Map<string, MarkElement>();
  for (const [id, fresh] of next.pins) {
    const old = previous.pins.get(id);
    const parent = fresh.parentNode as unknown as Replacer | null;
    if (old === undefined || parent === null || old === fresh) {
      pins.set(id, fresh);
      continue;
    }
    parent.replaceChild(old as never, fresh as never);
    pins.set(id, old);
  }
  return { pins, replacements: next.replacements };
};

/**
 * Writes each suggested edit's replacement into its text node, where it differs: typing in a card
 * changes the text and nothing else, so no mark is applied again.
 */
export const setReplacements = (marked: Marked, specs: readonly MarkSpec[]): void => {
  for (const spec of specs) {
    const node = marked.replacements.get(spec.id);
    if (node !== undefined && node.data !== spec.replacement) node.data = spec.replacement;
  }
};
