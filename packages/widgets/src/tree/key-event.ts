// A keyboard event as the model's `keyAction` reads it (`keys.ts`). A key an input method is
// composing is never the Tree's: WebKit sends the Enter that confirms a candidate after
// `compositionend`, with `isComposing` false and the `keyCode` 229 that marks an input method's
// key, so that code counts as composing too.

import type { TreeKey } from "./model/keys.ts";

/** An input method's key, in the legacy `keyCode` (UI Events, Key Codes). */
const PROCESS_KEY = 229;

/** The fields of a React keyboard event this module reads. */
type KeyEventFields = {
  readonly key: string;
  readonly keyCode: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly nativeEvent: { readonly isComposing: boolean };
};

export const treeKeyOf = (event: KeyEventFields): TreeKey => ({
  key: event.key,
  altKey: event.altKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  shiftKey: event.shiftKey,
  isComposing: event.nativeEvent.isComposing || event.keyCode === PROCESS_KEY,
});
