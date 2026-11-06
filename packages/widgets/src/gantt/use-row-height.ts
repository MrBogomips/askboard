// The height of a Gantt row, which the chart draws in SVG and so cannot take from the CSS alone: the
// density's `header-row` token (32px compact, 40px comfortable; review F-23), read from the view's
// root and read again when the root's class changes, which is how the density switches.

import { useSyncExternalStore } from "react";
import { ROW_HEIGHT } from "./model/layout.ts";
import { rowHeightOf } from "./model/row-height.ts";

const read = (): number =>
  typeof document === "undefined"
    ? ROW_HEIGHT
    : rowHeightOf(getComputedStyle(document.documentElement).getPropertyValue("--header-row"));

const subscribe = (onChange: () => void): (() => void) => {
  if (typeof MutationObserver === "undefined") return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};

/** The row height of the density now in force. */
export const useRowHeight = (): number => useSyncExternalStore(subscribe, read, () => ROW_HEIGHT);
