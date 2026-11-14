// Whether the toolbar row is too narrow for all its tools (`crowded.ts`; the Tree's, since its
// review F-16, and the Ranking's): the tools' width with all of them shown is measured while none
// is given up, and kept, so that the row's width alone decides after that. A new language
// re-measures, its labels having other widths.

import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";
import { isCrowded } from "./crowded.ts";

export const useCrowded = (
  tools: RefObject<HTMLElement | null>,
  language: string,
  present: boolean,
): boolean => {
  const [crowded, setCrowded] = useState(false);
  const full = useRef(0);
  const givenUp = useRef(false);

  const measure = useCallback(() => {
    const element = tools.current;
    const row = element?.parentElement;
    if (element === null || element === undefined || row === null || row === undefined) return;
    if (!givenUp.current) full.current = element.scrollWidth;
    const next = isCrowded(row.clientWidth, full.current);
    givenUp.current = next;
    setCrowded(next);
  }, [tools]);

  // A new language: show every tool again, to measure them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `language` is the trigger.
  useLayoutEffect(() => {
    full.current = 0;
    givenUp.current = false;
    setCrowded(false);
  }, [language]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `crowded` and `language` re-measure once the tools are shown again.
  useLayoutEffect(() => {
    const row = tools.current?.parentElement;
    if (!present || row === null || row === undefined) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure, present, tools, crowded, language]);

  return crowded;
};
