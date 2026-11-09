// The press reader of the port (keyboard-shortcuts-help, design decision 3): a DOM or React keyboard
// event into the contract's `KeyPress`, which `keyActionOf` matches against a key table. A key an
// input method is composing is never a widget's: WebKit sends the Enter that confirms a candidate
// after `compositionend`, with `isComposing` false and the `keyCode` 229 that marks an input
// method's key, so that code counts as composing too (as the Tree's `treeKeyOf` reads it).

import { type KeyPress, pressHold } from "@askboard/contract";

/** An input method's key, in the legacy `keyCode` (UI Events, Key Codes). */
const PROCESS_KEY = 229;

/** The `type`s of an `input` that takes no text. */
const NO_TEXT_TYPES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** What `isTextTarget` reads of an event's target: any DOM element, or a stand-in. */
export type TargetLike = {
  readonly tagName?: string;
  readonly type?: string | undefined;
  readonly isContentEditable?: boolean;
  readonly getAttribute?: (name: string) => string | null;
};

/**
 * Whether the target takes typed text: an `input` that takes text, a `textarea`, a `contenteditable`
 * element or one with `role="textbox"`. A key pressed there is the field's, apart from an editor's.
 */
export const isTextTarget = (candidate: object | null | undefined): boolean => {
  if (candidate === null || candidate === undefined) return false;
  const target = candidate as TargetLike;
  const tag = target.tagName?.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return !NO_TEXT_TYPES.has((target.type ?? "text").toLowerCase());
  if (target.isContentEditable === true) return true;
  return target.getAttribute?.("role") === "textbox";
};

/** The fields of a React or DOM keyboard event this module reads. */
export type KeyEventFields = {
  readonly key: string;
  readonly keyCode: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly nativeEvent?: { readonly isComposing: boolean };
  readonly isComposing?: boolean;
  readonly target: object | null;
};

/** The press an event is: its key, its hold, whether an input method composes, whether a field has it. */
export const keyPressOf = (event: KeyEventFields): KeyPress => ({
  key: event.key,
  hold: pressHold(event),
  composing:
    (event.nativeEvent?.isComposing ?? event.isComposing ?? false) || event.keyCode === PROCESS_KEY,
  inText: isTextTarget(event.target),
});
