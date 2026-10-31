// Where the Tree puts the DOM focus (design decision 6; EXPERIENCE, Accessibility Floor: focus is
// never lost). When the Tree moves it, after a key, a commit or an answered question, it goes to
// the Tab stop asked for, the treegrid's or the toolbar's, each the other's fallback: an empty
// Tree has no treegrid stop, a read-only Tree no toolbar stop. When the element that holds the
// focus, or the one the focus is moving to, goes while the focus stays in the Tree, as a new node
// taken away by Shift+Tab from its name does, the focus goes to the Tab stop of that element's
// part. A focus that leaves the Tree, or moves to an element that stays, is the user's and is left
// where it is.

import { type FocusEvent, useLayoutEffect, useRef } from "react";

/** A part of the Tree that holds a Tab stop: the treegrid or the toolbar row. */
export type TreePart = "grid" | "toolbar";

type FocusAt = { readonly element: Node; readonly in: TreePart };

const STOP = '[tabindex="0"]';

export const useTreeFocus = () => {
  const grid = useRef<HTMLTableElement>(null);
  const toolbar = useRef<HTMLElement | null>(null);
  // The Tab stop the focus moves to once the next render is laid out.
  const moveTo = useRef<TreePart | undefined>(undefined);
  // The element of the Tree that holds the focus, and the one it is moving to within the Tree.
  const holder = useRef<FocusAt | undefined>(undefined);
  const going = useRef<FocusAt | undefined>(undefined);

  useLayoutEffect(() => {
    const at = going.current ?? holder.current;
    const to = moveTo.current ?? (at !== undefined && !at.element.isConnected ? at.in : undefined);
    if (to === undefined) return;
    moveTo.current = undefined;
    holder.current = undefined;
    going.current = undefined;
    const inGrid = grid.current?.querySelector<HTMLElement>(STOP);
    const inToolbar = toolbar.current?.querySelector<HTMLElement>(STOP);
    (to === "grid" ? (inGrid ?? inToolbar) : (inToolbar ?? inGrid))?.focus();
  });

  const placeOf = (target: EventTarget | null): FocusAt | undefined => {
    if (!(target instanceof Node)) return undefined;
    if (grid.current?.contains(target) === true) return { element: target, in: "grid" };
    return toolbar.current?.contains(target) === true
      ? { element: target, in: "toolbar" }
      : undefined;
  };

  return {
    grid,
    /** The toolbar row's element: the tools' or the delete question's. */
    toolbarRow: (row: HTMLElement | null): void => {
      toolbar.current = row;
    },
    /** Moves the focus to `to`'s Tab stop after the next render; `undefined` moves it nowhere. */
    moveFocusTo: (to: TreePart | undefined): void => {
      moveTo.current = to;
    },
    /** The frame's focus handlers, which follow the focus in the Tree. */
    onFocus: (event: FocusEvent<HTMLElement>): void => {
      holder.current = placeOf(event.target);
      going.current = undefined;
    },
    onBlur: (event: FocusEvent<HTMLElement>): void => {
      // A blur from an element already taken out is no move of the user's.
      if (event.target instanceof Node && !event.target.isConnected) return;
      going.current = placeOf(event.relatedTarget);
      if (going.current === undefined) holder.current = undefined;
    },
  };
};
