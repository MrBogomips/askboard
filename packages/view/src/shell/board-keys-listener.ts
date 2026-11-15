// The board's keys on the view's document (board-keys, design decision 3): one `keydown` listener,
// in the bubbling phase, after every widget handler and each keys frame, because a click on blank
// space leaves the focus on `<body>`, outside React's root. DOM only, so it is checked in the
// browser (`board-keys.browser.ts`); `boardKeyActOf` holds the rule.

import type { KeyEntry } from "@askboard/contract";
import { useEffect, useRef } from "react";
import { keyPressOf } from "../catalog/keys/press.ts";
import { boardKeyScopeOf, scopeTargetOf } from "./board-key-scope.ts";
import { boardKeyActOf } from "./use-board-keys.ts";

/** What each action does; one that is undefined is unavailable. `keysOpen` gets the element that had the focus. */
export type BoardKeyHandlers = {
  readonly nextOpen: (() => void) | undefined;
  readonly previousOpen: (() => void) | undefined;
  readonly keysOpen: ((from: HTMLElement | null) => void) | undefined;
};

export const useBoardKeys = (handlers: BoardKeyHandlers, table: readonly KeyEntry[]): void => {
  const latest = useRef({ handlers, table });
  latest.current = { handlers, table };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { handlers: now, table: keys } = latest.current;
      // Any element is the target, an SVG or MathML node inside a widget included (review S-10).
      const target = scopeTargetOf(event.target, document.body);
      const act = boardKeyActOf(
        keys,
        keyPressOf(event),
        boardKeyScopeOf(target),
        {
          nextOpen: now.nextOpen !== undefined,
          previousOpen: now.previousOpen !== undefined,
          keysOpen: now.keysOpen !== undefined,
        },
        event.defaultPrevented,
        event.repeat,
      );
      if (act === undefined) return;
      event.preventDefault();
      if (act === "board.nextOpen") now.nextOpen?.();
      else if (act === "board.previousOpen") now.previousOpen?.();
      else
        now.keysOpen?.(target instanceof HTMLElement && target !== document.body ? target : null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
};
