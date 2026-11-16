// Keeps the draft's question in view in step with scrolling and focus (answering-flow-fixes,
// design decision 3; #181). Sections and tabs only: one question per view shows the question it is
// on. It never reads at mount, so a question in view restored after a reload stays until the user
// scrolls or moves focus. DOM only, so it is checked in the browser; `questionInView` holds the rule.

import { useEffect } from "react";
import { questionInView } from "./in-view.ts";
import { measureBoardInset } from "./measure-inset.ts";

const CARD = "[data-askboard-question]";

// The question whose card holds the focus, if any.
export const focusedQuestion = (doc: Document): string | undefined =>
  doc.activeElement?.closest(CARD)?.getAttribute("data-askboard-question") ?? undefined;

// The question in view now, from the cards of the main area, read in one pass.
const readInView = (doc: Document): string | undefined => {
  const main = doc.querySelector("main");
  if (main === null) return undefined;
  const view = doc.defaultView;
  const inset = measureBoardInset(doc);
  const cards = [...main.querySelectorAll(CARD)].flatMap((element) => {
    const id = element.getAttribute("data-askboard-question");
    if (id === null) return [];
    const { top, bottom } = element.getBoundingClientRect();
    return [{ id, top, bottom }];
  });
  const root = doc.documentElement;
  return questionInView({
    cards,
    band: { top: inset.top, bottom: (view?.innerHeight ?? 0) - inset.bottom },
    focused: focusedQuestion(doc),
    atEnd: (view?.scrollY ?? 0) + (view?.innerHeight ?? 0) >= root.scrollHeight - 1,
  });
};

/**
 * On `scroll` (passive, at most once per animation frame) and `focusin`, sets the question in view
 * when it differs from the draft's.
 */
export const useQuestionInView = (
  enabled: boolean,
  current: () => string | undefined,
  setInView: (questionId: string | undefined) => void,
): void => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `current` and `setInView` are the board store's, stable for the board's life
  useEffect(() => {
    if (!enabled) return;
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      const found = readInView(document);
      if (found !== undefined && found !== current()) setInView(found);
    };
    const schedule = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update);
    };
    // A focus on a control outside every card (the header, the rail, the outbox) is no move through
    // the questions: it leaves the question in view alone, so a mouse press on "Next to do" and
    // the key N agree on a fresh board (e2e-stabilise-answering-flow, D9; #241).
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(CARD) === null) return;
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", onFocus);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
};
