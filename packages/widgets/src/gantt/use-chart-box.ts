// The chart's scroll box measured (design decisions 9 and 10; view spec, "Gantt plan opening zoom"
// and "Gantt overflow cue"): its width, which the opening zoom and the stretch of a short span read,
// and the sides that hold more when the chart is wider than it, for the edge shadows. Measured
// before the first paint and again as the box or its content changes size or scrolls.

import { type RefObject, useLayoutEffect, useState } from "react";
import { type OverflowEdges, overflowEdges } from "./model/overflow.ts";

export type ChartBox = {
  /** The scroll box's width; undefined until it is measured. */
  readonly width: number | undefined;
  readonly edges: OverflowEdges;
};

const NONE: OverflowEdges = { before: false, after: false };

/** The box's own size and its content's (the chart) are both watched: either may change the edges. */
export const useChartBox = (box: RefObject<HTMLDivElement | null>): ChartBox => {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [edges, setEdges] = useState<OverflowEdges>(NONE);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    const measure = () => {
      setWidth(element.clientWidth);
      const next = overflowEdges(element.scrollLeft, element.clientWidth, element.scrollWidth);
      setEdges((shown) =>
        shown.before === next.before && shown.after === next.after ? shown : next,
      );
    };
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    if (typeof ResizeObserver === "undefined") {
      return () => element.removeEventListener("scroll", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild !== null) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [box]);
  return { width, edges };
};
