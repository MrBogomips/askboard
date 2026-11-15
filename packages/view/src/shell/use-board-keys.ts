// The board's keys (board-keys, design decision 3): `N`, `Shift+N` and `?`. `boardKeyActOf` is the
// pure part: which action a press runs, if any. The listener on the view's document, `useBoardKeys`,
// is DOM only and lives in `board-keys-listener.ts`, which the browser files check.

import {
  BOARD_KEYS,
  BOARD_PART,
  type KeyEntry,
  type KeyPress,
  keyActionOf,
} from "@askboard/contract";
import type { KeyInEffect } from "../catalog/keys/effective.ts";
import { useKeyTable } from "../catalog/keys/key-table.tsx";
import type { BoardKeyScope } from "./board-key-scope.ts";

/** The board's table with the user's keys applied: the listener, the hints and the panel read it. */
export const useBoardKeyTable = (): readonly KeyInEffect[] =>
  useKeyTable(BOARD_KEYS as readonly KeyEntry[]);

/** The actions the listener runs. */
export type BoardKeyAct = "board.nextOpen" | "board.previousOpen" | "keys.open";

/** Whether the control each action twins is there to act: the jump with a target, the Keys button. */
export type BoardKeyAvailable = {
  readonly nextOpen: boolean;
  readonly previousOpen: boolean;
  readonly keysOpen: boolean;
};

const ACTS: Readonly<Record<BoardKeyAct, keyof BoardKeyAvailable>> = {
  "board.nextOpen": "nextOpen",
  "board.previousOpen": "previousOpen",
  "keys.open": "keysOpen",
};

/**
 * The action a press runs: the key must not have been prevented, not be a repeat, and be in the
 * scope `board` or `card`, and its twin must be available. `board.answer` is the card's, never run here.
 */
export const boardKeyActOf = (
  table: readonly KeyEntry[],
  press: KeyPress,
  scope: BoardKeyScope,
  available: BoardKeyAvailable,
  prevented: boolean,
  repeat: boolean,
): BoardKeyAct | undefined => {
  if (prevented || repeat || scope === "none") return undefined;
  const entry = keyActionOf(table, BOARD_PART, press, false);
  if (entry === undefined || !Object.hasOwn(ACTS, entry.action)) return undefined;
  const act = entry.action as BoardKeyAct;
  return available[ACTS[act]] ? act : undefined;
};
