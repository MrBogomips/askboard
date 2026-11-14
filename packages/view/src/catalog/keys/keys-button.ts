// What the Keys button does, apart from drawing it (keyboard-shortcuts-help, design decision 5):
// it gives the frame its element, to anchor the panel by, beside any ref the caller passes, and a
// click opens the panel after the caller's own handler. Pure, so that a test reaches both.

import type { Ref } from "react";

/** What the item frame gives its widget to open the keys panel. */
export type KeysPanelControl = {
  readonly open: () => void;
  /** The element the panel is anchored to: the Keys button gives itself. */
  readonly anchor: (element: HTMLElement | null) => void;
};

/** The ref callback of the Keys button: tells the frame the element, then the caller's ref. */
export const buttonRefOf =
  (panel: KeysPanelControl, forwarded: Ref<HTMLButtonElement> | undefined) =>
  (element: HTMLButtonElement | null): void => {
    panel.anchor(element);
    if (typeof forwarded === "function") forwarded(element);
    else if (forwarded !== null && forwarded !== undefined) forwarded.current = element;
  };

/** The click handler of the Keys button: the caller's, if any, then the panel opens. */
export const clickOf =
  <Event>(panel: KeysPanelControl, onClick: ((event: Event) => void) | undefined) =>
  (event: Event): void => {
    onClick?.(event);
    panel.open();
  };
