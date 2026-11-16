// Feeds the held-key guard from the view's document (answering-flow-guidance, design decision 3;
// NFR-10): keys down and up, and a repeat the guard keeps from the card the board moved to and from
// "Continue" is cancelled before any other handler of the document sees it. DOM only, so it is
// checked in the browser; `createHeldKeyGuard` holds the rule.

import { useEffect } from "react";
import type { HeldKeyGuard, KeyPlace } from "./held-key-guard.ts";

const placeOf = (target: EventTarget | null): KeyPlace => {
  const element = target instanceof Element ? target : null;
  return {
    card:
      element?.closest("[data-askboard-question]")?.getAttribute("data-askboard-question") ??
      undefined,
    continue: element?.closest("[data-askboard-continue]") != null,
    send: element?.closest("[data-askboard-submit]") != null,
  };
};

export const useHeldKeyGuard = (guard: HeldKeyGuard): void => {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const verdict = guard.keydown({
        key: event.key,
        repeat: event.repeat,
        at: placeOf(event.target),
      });
      if (verdict === "ignore") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const keyup = (event: KeyboardEvent) => guard.keyup(event.key);
    const reset = () => guard.reset();
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("keyup", keyup, true);
      window.removeEventListener("blur", reset);
    };
  }, [guard]);
};
