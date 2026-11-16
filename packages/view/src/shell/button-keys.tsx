// The key cap inside a main button (answering-flow-visual, design decision 10; spec: Key caps on the
// board's main controls): "Next to do" and a question's primary show the first combination of their
// action's entry in effect, from the board's table, so a user's remap shows at once. The cap is
// `aria-hidden`: the button's `aria-keyshortcuts`, from `KeyHint`, says it to assistive technology.
// An action with no keys in effect shows none. `platform` is the page's unless a test draws the other.

import type { KeyEntry } from "@askboard/contract";
import { useContext } from "react";
import { entryInEffect } from "../catalog/keys/effective.ts";
import { hintOf } from "../catalog/keys/hint.ts";
import { KEY_CAP } from "../catalog/keys/key-help.tsx";
import { KeyTableContext } from "../catalog/keys/key-table.tsx";
import { type KeyPlatform, useKeyPlatform } from "../catalog/keys/label.ts";
import { useStrings } from "../catalog/port.ts";

export const ButtonKeys = ({
  entry,
  platform,
}: {
  /** The action's entry, as `useBoardKeyTable` gives it; none when the table has no such entry. */
  readonly entry: KeyEntry | undefined;
  readonly platform?: KeyPlatform;
}) => {
  const own = useKeyPlatform();
  const text = useStrings();
  const table = useContext(KeyTableContext);
  if (entry === undefined) return null;
  const cap = hintOf(entryInEffect(table, entry), platform ?? own, text)?.caps[0];
  if (cap === undefined) return null;
  return (
    <span aria-hidden="true" className="ml-1.5 inline-flex items-center">
      <kbd className={KEY_CAP}>{cap}</kbd>
    </span>
  );
};
