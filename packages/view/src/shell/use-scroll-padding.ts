// A control reached with Tab ends clear of the sticky bars (answering-flow-visual, design decision
// 12; requirement "Tab clears the sticky bars"; probe P2): `scroll-padding-top` on the view's
// scrolling element follows the top inset, the header, the strip of tabs and the tray included while
// it holds a message, so that the engine's own focus scrolling keeps the control below them. Chromium
// and WebKit honour it (probe P2).
//
// The padding is in force only while Tab is down, from its keydown, where the browser moves focus
// and scrolls, to its keyup. Always on, it would make the browser's other scrolls treat the sticky
// header's own controls as out of view (the actionability scroll of an automated click, for one) and
// move the page under the pointer. DOM only, so it is checked in the browser.

import { useLayoutEffect } from "react";
import { measureBoardInset } from "./measure-inset.ts";

/** Whether this key press moves focus by Tab, forwards or backwards. */
export const isTabPress = (event: Pick<KeyboardEvent, "key">): boolean => event.key === "Tab";

/** The root's `scroll-padding-top` while Tab is down: the board's top inset; empty otherwise. */
export const useScrollPadding = (): void => {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.style.scrollPaddingTop = "";
    };
    const down = (event: KeyboardEvent) => {
      if (isTabPress(event)) root.style.scrollPaddingTop = `${measureBoardInset().top}px`;
    };
    const up = (event: KeyboardEvent) => {
      if (isTabPress(event)) clear();
    };
    document.addEventListener("keydown", down, true);
    document.addEventListener("keyup", up, true);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("keydown", down, true);
      document.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
};
