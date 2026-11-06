// The Tree's one undo slot for a bulk adjustment (widget-editing-plus design decision 4; spec,
// "Tree adjustment undo"): the value before the last adjustment and the one it gave. The slot is
// available only while the Tree is editable and still holds the value the adjustment gave, so any
// other edit empties it; undoing puts the value before back through the normal change path, so the
// draft is `undefined` again when that is the agent's value. View state: never in a draft or an
// answer. Plain ECMAScript.

import type { TreeProps } from "@askboard/contract";
import { sameNodes } from "./marks.ts";

/** The value before the last adjustment, and the one the adjustment gave. */
export type UndoSlot = { readonly before: TreeProps; readonly after: TreeProps };

/** The slot of an adjustment from `before` to `after`. */
export const slotOf = (before: TreeProps, after: TreeProps): UndoSlot =>
  Object.freeze({ before, after });

/** `slot` while it still applies to `value` and the Tree is editable, else `undefined`. */
export const liveSlot = (
  slot: UndoSlot | undefined,
  value: TreeProps,
  disabled: boolean,
): UndoSlot | undefined =>
  slot !== undefined && !disabled && sameNodes(slot.after, value) ? slot : undefined;

/** What the draft holds after undoing `slot`: `undefined` when that is the agent's `sent` value. */
export const draftAfterUndo = (slot: UndoSlot, sent: TreeProps): TreeProps | undefined =>
  sameNodes(sent, slot.before) ? undefined : slot.before;
