// The key hint and the Keys button of the port (keyboard-shortcuts-help, design decision 5; specs:
// Keyboard shortcuts are discoverable, The keys panel). `KeyHint` wraps a control in a Radix
// Tooltip that opens on hover and on keyboard focus and that Escape closes, showing the action's
// name with its keys as key caps, and puts `aria-keyshortcuts` on the control from the table.
// `KeysButton` opens the keys panel of the item frame it sits in. The look is DESIGN's tooltip for
// agent-written labels and key caps; every class is written in full for Tailwind. Imported by the
// widget chunks through the port, which re-exports these names.

import type { KeyEntry } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { type ComponentPropsWithRef, createContext, type ReactElement, useContext } from "react";
import { useStrings } from "../port.ts";
import { entryInEffect } from "./effective.ts";
import { hintOf } from "./hint.ts";
import { KeyTableContext, useKeysOpenEntry } from "./key-table.tsx";
import { buttonRefOf, clickOf, type KeysPanelControl } from "./keys-button.ts";
import { useKeyPlatform } from "./label.ts";

const TOOLTIP =
  "z-30 flex items-center gap-sm rounded-md border border-border bg-popover px-sm py-1 text-body text-popover-foreground shadow-md";
const KEY_CAP = "rounded-sm border border-border bg-muted px-1 font-mono text-code text-foreground";

/**
 * Wraps `children`, one control, in a tooltip with the entry's name and keys, and gives it the
 * entry's `aria-keyshortcuts`. The keys are those in effect: inside an item frame the entry is looked
 * up in the frame's table by action and part, so a widget that passes its static entry shows the
 * user's keys; outside a frame it shows the entry as given. A table's keyless entry leaves the
 * control as it is: no tooltip and no attribute. An action the user's file removed the keys of keeps
 * its tooltip, with its name and no key, and carries no attribute. The shell provides the provider.
 */
export const KeyHint = ({
  entry,
  children,
}: {
  readonly entry: KeyEntry;
  readonly children: ReactElement;
}) => {
  const platform = useKeyPlatform();
  const text = useStrings();
  const table = useContext(KeyTableContext);
  const hint = hintOf(entryInEffect(table, entry), platform, text);
  if (hint === undefined) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild aria-keyshortcuts={hint.aria === "" ? undefined : hint.aria}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={4} className={TOOLTIP}>
          <span>{hint.name}</span>
          {hint.caps.map((cap) => (
            <kbd key={cap} className={KEY_CAP}>
              {cap}
            </kbd>
          ))}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

/** The frame's panel, provided by the item frame of a type that registered a key table. */
export const KeysPanelContext = createContext<KeysPanelControl | undefined>(undefined);

/** The panel of the item frame the caller sits in; undefined where the type has no table. */
export const useKeysPanel = (): KeysPanelControl | undefined => useContext(KeysPanelContext);

const KEYS_BUTTON =
  "h-[28px] shrink-0 rounded-md border border-border bg-muted px-[12px] text-control text-foreground hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * The Keys button, a `button-secondary` that opens the frame's panel (`aria-haspopup="dialog"`),
 * its tooltip "Keys" with `keys.open`'s keys in effect (`?` by default): the last stop of a toolbar row, never in "More". It draws nothing in
 * a frame with no panel. The props are a button's, for a toolbar's roving focus and its classes.
 */
export const KeysButton = ({
  ref,
  className,
  onClick,
  ...rest
}: ComponentPropsWithRef<"button">) => {
  const panel = useKeysPanel();
  const text = useStrings();
  const keysOpen = useKeysOpenEntry();
  if (panel === undefined) return null;
  return (
    <KeyHint entry={keysOpen}>
      <button
        {...rest}
        type="button"
        aria-haspopup="dialog"
        className={className ?? KEYS_BUTTON}
        ref={buttonRefOf(panel, ref)}
        onClick={clickOf(panel, onClick)}
      >
        {text("keys.button")}
      </button>
    </KeyHint>
  );
};
