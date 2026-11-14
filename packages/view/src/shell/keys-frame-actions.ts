// What an item frame's keys panel does, apart from drawing it (keyboard-shortcuts-help, design
// decision 5; spec: The keys panel): opening it from the Keys button or from a key, anchoring it,
// opening it on `?` only where the key was not taken, keeping panel keys inside it and giving the
// focus back where it was. Pure over refs and setters, so that a test reaches each without a DOM.

import type { KeyEntry } from "@askboard/contract";
import type { KeyboardEvent as ReactKeyEvent } from "react";
import { KEYS_OPEN_ENTRY, opensKeysPanel } from "../catalog/keys/hint.ts";
import type { KeysPanelControl } from "../catalog/keys/keys-button.ts";
import { type KeyEventFields, keyPressOf } from "../catalog/keys/press.ts";

/** What Radix's anchor reads of an element to place the panel by it. */
export type Measurable = { getBoundingClientRect(): DOMRect };

type Cell<Value> = { current: Value };

/** How the panel closed: Escape, the Close button, or an interaction outside it (a click or a focus elsewhere). */
export type CloseReason = "escape" | "close" | "outside";

/** The frame's elements: the Keys button, the panel's anchor, where the focus was, and how the panel closed. */
export type FrameElements = {
  readonly button: Cell<HTMLElement | null>;
  readonly anchor: Cell<Measurable | null>;
  readonly opener: Cell<HTMLElement | null>;
  readonly closedBy: Cell<CloseReason | undefined>;
};

/** An element that can take the focus back. */
type Focusable = { focus(): void };

const isFocusable = (target: unknown): target is HTMLElement & Focusable =>
  typeof target === "object" && target !== null && "focus" in target;

/** Opens the panel from `from`, the element that held the focus: the panel is placed by the Keys button, else by it. */
export const openFrom =
  (elements: FrameElements, setOpen: (open: boolean) => void) =>
  (from: HTMLElement | null): void => {
    elements.opener.current = from;
    elements.closedBy.current = undefined;
    elements.anchor.current = elements.button.current ?? from;
    setOpen(true);
  };

/** What the frame gives its widget: the Keys button opens the panel from itself and anchors it. */
export const controlOf = (
  elements: FrameElements,
  open: (from: HTMLElement | null) => void,
): KeysPanelControl => ({
  open: () => open(elements.button.current),
  anchor: (element) => {
    elements.button.current = element;
  },
});

/**
 * The frame's key handler: the keys of `keys.open` in effect (`keysOpen`: `?` unless the user's file
 * gives the panel others or none) open the panel unless the key was already prevented (a widget took
 * it, or a nested frame did, which is how the nearest frame wins), an input method composes or the
 * target is a text field; it then prevents the key. A key that is not `keys.open`'s is left alone.
 */
export const keyDownOf =
  (open: (from: HTMLElement | null) => void, keysOpen: KeyEntry = KEYS_OPEN_ENTRY) =>
  (event: ReactKeyEvent<HTMLElement>): void => {
    if (event.defaultPrevented || !opensKeysPanel(keyPressOf(event as KeyEventFields), keysOpen)) {
      return;
    }
    event.preventDefault();
    open(isFocusable(event.target) ? event.target : null);
  };

/** Keeps a key typed in the panel in it: React events bubble through the portal to the widget. */
export const stopKey = (event: { stopPropagation(): void }): void => event.stopPropagation();

/** Records how the panel is closing, for `restoreFocus` (Radix's close handlers call it before the close). */
export const noteClose = (elements: FrameElements, reason: CloseReason) => (): void => {
  elements.closedBy.current = reason;
};

/**
 * Takes the focus move from Radix. After Escape or "Close" the focus goes back to the element that
 * held it before the panel opened; after an interaction outside it stays where that interaction put
 * it (a click on another item's field), which Radix's own move to the opener would take away.
 */
export const restoreFocus =
  (elements: FrameElements) =>
  (event: { preventDefault(): void }): void => {
    event.preventDefault();
    if (elements.closedBy.current !== "outside") elements.opener.current?.focus();
  };
