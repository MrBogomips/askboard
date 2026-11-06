// An element's width measured (design decision 7): the Gantt frame's, which the TASK column's
// limit is a share of. Measured before the first paint and again whenever the element resizes.

import { type RefObject, useLayoutEffect, useState } from "react";

/** The element's width, undefined until it is measured. */
export const useElementWidth = (element: RefObject<HTMLElement | null>): number | undefined => {
  const [width, setWidth] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const target = element.current;
    if (target === null) return;
    const measure = () => setWidth(target.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return width;
};
