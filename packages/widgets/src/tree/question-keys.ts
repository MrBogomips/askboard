// The key handler of the Tree's two inline questions (keyboard-shortcuts-help, design decision 9):
// the delete question and the group question both call it, so their parity test calls it too.

import type { KeyboardEvent } from "react";
import { treeKeyOf } from "./key-event.ts";
import { keyAction } from "./model/keys.ts";

/**
 * The question's key handler: Escape means "Cancel", as it cancels an edit (`keys.ts`); the buttons
 * take Enter and Space, and a key an input method is composing is not the question's.
 */
export const questionKeyDown =
  (onCancel: () => void) =>
  (event: KeyboardEvent<HTMLFieldSetElement>): void => {
    if (keyAction(treeKeyOf(event), "edit")?.kind !== "cancel") return;
    event.preventDefault();
    onCancel();
  };
