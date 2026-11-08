// The Document review's document in the DOM (document-review, design decisions 5, 7, 9 and 10): the
// sanitized fragment the shared renderer made, cloned, marked with the placed annotations and
// mounted through the shared `mountMarkdown`, so that a link is opened as a Text's is; the blocks
// the keyboard stands on; and the selection the toolbar acts on. The marks are applied again only
// when the places or kinds change (`samePlan`), and the pins' slots move into the new clone, so
// typing in a card never touches the document and a pin's card stays mounted when a plan is
// applied around it. Agent and user text reach the DOM only as text nodes; nothing here writes a
// `style` attribute or `innerHTML`.

import { markExternal, mountMarkdown, PLAIN } from "@askboard/view/markdown";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BLOCK } from "./classes.ts";
import { blockAfterKey, pinAfterKey } from "./keys.ts";
import {
  applyMarks,
  type MarkDocument,
  type Marked,
  type MarkSpec,
  reuseSlots,
  samePlan,
  setReplacements,
} from "./marks.ts";
import {
  blocksOf,
  layoutOf,
  type Reading,
  type ReadingBlock,
  type ReadingNode,
  type ReadingRoot,
  type Selected,
  type SelectionRange,
  selectedOffsets,
} from "./reading.ts";

/** What an application of the marks made: the pins' slots, the blocks, the plan it drew. */
export type Applied = {
  readonly marked: Marked;
  readonly specs: readonly MarkSpec[];
  readonly blocks: readonly ReadingBlock[];
};

/** The attribute the pin buttons carry, so that the keyboard finds the pins of a block. */
export const PIN_ATTRIBUTE = "data-review-pin";

export type ReviewDocumentInput = {
  readonly reading: Reading;
  /** The plan of the placed annotations, in the document's order. */
  readonly specs: readonly MarkSpec[];
  readonly hosted: boolean;
  readonly itemId: string;
  readonly openLink: (itemId: string, url: string) => void;
  /** Called with each selection the document holds, for the widget to take back a message. */
  readonly onSelect?: (selected: Selected | undefined) => void;
};

export type ReviewDocument = {
  readonly container: RefObject<HTMLElement | null>;
  /** The last application of the marks; `undefined` until the first. */
  readonly applied: Applied | undefined;
  /** The selection the user last made inside the document, `undefined` when it holds none. */
  readonly selected: () => Selected | undefined;
  /** The current block's index. */
  readonly current: () => number;
  /** Where focus returns when a card closes: the pin, else the current block, else the document. */
  readonly focusAfterCard: (id: string) => HTMLElement | null;
};

// The plain text of a source that is no Markdown, as one paragraph: the renderer gave no fragment,
// and the document is the source as it is, its line breaks kept by the class.
const plainFragment = (text: string, doc: Document): DocumentFragment => {
  const fragment = doc.createDocumentFragment();
  const paragraph = doc.createElement("p");
  paragraph.setAttribute("class", PLAIN);
  paragraph.appendChild(doc.createTextNode(text));
  fragment.appendChild(paragraph);
  return fragment;
};

const elementOf = (block: ReadingBlock): HTMLElement => block.element as unknown as HTMLElement;

// Gives each block the keyboard's stop: the current one tab index 0, the others -1, and the focus ring.
const decorate = (blocks: readonly ReadingBlock[], current: number): void => {
  blocks.forEach((block, at) => {
    const element = elementOf(block);
    element.setAttribute("tabindex", at === current ? "0" : "-1");
    for (const name of BLOCK.split(" ")) element.classList.add(name);
  });
};

const pinsOf = (block: ReadingBlock | undefined): HTMLElement[] =>
  block === undefined
    ? []
    : Array.from(elementOf(block).querySelectorAll<HTMLElement>(`[${PIN_ATTRIBUTE}]`));

const blockHolding = (blocks: readonly ReadingBlock[], node: Node): number =>
  blocks.findIndex((block) => elementOf(block).contains(node));

export const useReviewDocument = ({
  reading,
  specs,
  hosted,
  itemId,
  openLink,
  onSelect,
}: ReviewDocumentInput): ReviewDocument => {
  const container = useRef<HTMLElement | null>(null);
  const [applied, setApplied] = useState<Applied | undefined>(undefined);
  const live = useRef<{
    readonly reading: Reading;
    readonly hosted: boolean;
    readonly itemId: string;
    readonly openLink: ReviewDocumentInput["openLink"];
    specs: readonly MarkSpec[];
    readonly applied: Applied;
    readonly unmount: () => void;
  } | null>(null);
  const currentBlock = useRef(0);
  const selection = useRef<Selected | undefined>(undefined);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // The marks are applied to a fresh clone when the reading, the places or the kinds change; while
  // they stay, only a replacement's text node is written.
  useLayoutEffect(() => {
    const target = container.current;
    if (target === null) return;
    const before = live.current;
    if (
      before !== null &&
      before.reading === reading &&
      before.hosted === hosted &&
      before.itemId === itemId &&
      before.openLink === openLink &&
      samePlan(before.specs, specs)
    ) {
      setReplacements(before.applied.marked, specs);
      before.specs = specs;
      return;
    }
    const doc = target.ownerDocument;
    const shown =
      reading.fragment === undefined
        ? plainFragment(reading.text, doc)
        : (reading.fragment.cloneNode(true) as DocumentFragment);
    const marked = reuseSlots(
      applyMarks(shown as unknown as ReadingNode, specs, doc as unknown as MarkDocument),
      before?.applied.marked,
    );
    if (!hosted) markExternal(shown);
    before?.unmount();
    const unmount = mountMarkdown({ target, shown, hosted, itemId, openLink });
    const blocks = blocksOf(target as unknown as ReadingNode);
    currentBlock.current = Math.min(currentBlock.current, Math.max(blocks.length - 1, 0));
    decorate(blocks, currentBlock.current);
    const made: Applied = { marked, specs, blocks };
    live.current = { reading, hosted, itemId, openLink, specs, applied: made, unmount };
    setApplied(made);
  }, [reading, specs, hosted, itemId, openLink]);

  useLayoutEffect(
    () => () => {
      live.current?.unmount();
      live.current = null;
    },
    [],
  );

  // The current block takes the focus ring and the Tab stop; the keys move it and the pins' focus.
  useEffect(() => {
    const target = container.current;
    if (target === null) return undefined;
    const setCurrent = (next: number): void => {
      const blocks = live.current?.applied.blocks ?? [];
      const previous = blocks[currentBlock.current];
      if (previous !== undefined) elementOf(previous).setAttribute("tabindex", "-1");
      currentBlock.current = next;
      const block = blocks[next];
      if (block !== undefined) elementOf(block).setAttribute("tabindex", "0");
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const blocks = live.current?.applied.blocks ?? [];
      const here = blockHolding(blocks, event.target as Node);
      const at = here < 0 ? currentBlock.current : here;
      const block = blockAfterKey(blocks.length, at, event.key);
      if (block !== undefined) {
        event.preventDefault();
        setCurrent(block);
        const next = blocks[block];
        if (next !== undefined) elementOf(next).focus();
        return;
      }
      const pins = pinsOf(blocks[at]);
      const from = pins.indexOf(event.target as HTMLElement);
      const move = pinAfterKey(pins.length, from < 0 ? "block" : from, event.key);
      if (move === undefined) return;
      event.preventDefault();
      setCurrent(at);
      const stop = blocks[at];
      const next =
        move === "block" ? (stop === undefined ? undefined : elementOf(stop)) : pins[move];
      next?.focus();
    };
    const onFocusIn = (event: FocusEvent): void => {
      const blocks = live.current?.applied.blocks ?? [];
      const here = blockHolding(blocks, event.target as Node);
      if (here >= 0 && here !== currentBlock.current) setCurrent(here);
    };
    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("focusin", onFocusIn);
    return () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  // The selection the user made inside the document, as offsets of the reading text: the toolbar's
  // buttons keep it, since their mousedown default is prevented. One outside the document is none.
  useEffect(() => {
    const target = container.current;
    if (target === null) return undefined;
    const doc = target.ownerDocument;
    const onChange = (): void => {
      const chosen = doc.defaultView?.getSelection();
      const ranges: Range[] = [];
      for (let at = 0; chosen !== null && chosen !== undefined && at < chosen.rangeCount; at += 1) {
        const range = chosen.getRangeAt(at);
        if (range.intersectsNode(target)) ranges.push(range);
      }
      selection.current =
        ranges.length === 0
          ? undefined
          : selectedOffsets(
              target as unknown as ReadingRoot,
              ranges as unknown as SelectionRange[],
              layoutOf(target as unknown as ReadingNode),
            );
      onSelectRef.current?.(selection.current);
    };
    doc.addEventListener("selectionchange", onChange);
    return () => doc.removeEventListener("selectionchange", onChange);
  }, []);

  return {
    container,
    applied,
    selected: () => selection.current,
    current: () => currentBlock.current,
    focusAfterCard: (id) => {
      const slot = live.current?.applied.marked.pins.get(id) as unknown as HTMLElement | undefined;
      const pin = slot?.querySelector<HTMLElement>(`[${PIN_ATTRIBUTE}]`);
      if (pin?.isConnected === true) return pin;
      const block = live.current?.applied.blocks[currentBlock.current];
      return block === undefined ? container.current : elementOf(block);
    },
  };
};
