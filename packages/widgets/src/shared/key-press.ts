// A keyboard event as the contract's matcher reads it (keyboard-shortcuts-help, design decision
// 7): the key, the hold its four modifiers make, whether an input method is composing and whether
// the target is a text field. A key an input method is composing is never a widget's: WebKit sends
// the Enter that confirms a candidate after `compositionend`, with `isComposing` false and the
// `keyCode` 229 that marks an input method's key, so that code counts as composing too.

import { type KeyPress, type Modifiers, pressHold } from "@askboard/contract";

/** An input method's key, in the legacy `keyCode` (UI Events, Key Codes). */
const PROCESS_KEY = 229;

/** The fields of a DOM or React keyboard event this module reads. */
export type PressFields = Modifiers & {
  readonly key: string;
  readonly keyCode?: number;
  readonly nativeEvent?: { readonly isComposing: boolean };
};

/** The press an event is; `inText` when its target is a text field. */
export const pressOfEvent = (event: PressFields, inText = false): KeyPress => ({
  key: event.key,
  hold: pressHold(event),
  composing: event.nativeEvent?.isComposing === true || event.keyCode === PROCESS_KEY,
  inText,
});
