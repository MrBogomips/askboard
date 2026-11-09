// The keys panel of an item frame (keyboard-shortcuts-help, design decision 5; spec: The keys
// panel). The frame of a type that registered a key table wraps its content in this: it gives the
// widget the panel's control through `KeysPanelContext` (the Keys button opens it), opens it on `?`
// when the key was not prevented, no input method composes and the target is not a text field (the
// nearest frame wins, since it prevents the key), shows it as a non-modal Radix Popover named
// "<Widget> keys" with the focus moving in, and returns the focus on Escape or "Close" to the
// element that held it before it opened; a close from an interaction outside (a click or a focus
// elsewhere) leaves the focus where that interaction put it.

import { Popover } from "radix-ui";
import { type ReactNode, type RefObject, useMemo, useRef, useState } from "react";
import type { KeyInEffect } from "../catalog/keys/effective.ts";
import { KeysPanelContext } from "../catalog/keys/key-help.tsx";
import { KeyTableContext } from "../catalog/keys/key-table.tsx";
import type { StringKey } from "../catalog/port.ts";
import { useStrings } from "../catalog/port.ts";
import {
  controlOf,
  type FrameElements,
  keyDownOf,
  type Measurable,
  noteClose,
  openFrom,
  restoreFocus,
  stopKey,
} from "./keys-frame-actions.ts";
import { KeysPanelBody } from "./keys-panel.tsx";

const PANEL =
  "z-30 flex w-80 max-w-[90vw] flex-col gap-sm rounded-md border border-border bg-popover p-sm text-body text-popover-foreground shadow-md";
const CLOSE =
  "self-end rounded-md border border-border bg-muted px-sm py-1 text-control text-foreground hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export const KeysFrame = ({
  itemId,
  table,
  name,
  takesEdits,
  className,
  children,
}: {
  /** The item the frame belongs to, which marks its panel for tests and for the nearest-frame rule. */
  readonly itemId: string;
  /** The type's table with the user's keys applied (`useKeyTable`): the frame provides it to its widget. */
  readonly table: readonly KeyInEffect[];
  /** The string key of the type's name, which titles the panel; none: the panel is titled "Keys". */
  readonly name: StringKey | undefined;
  /** The item takes edits: not answered, locked, read-only or in a Snapshot. */
  readonly takesEdits: boolean;
  readonly className: string | undefined;
  readonly children: ReactNode;
}) => {
  const text = useStrings();
  const [open, setOpen] = useState(false);
  const elements = useRef<FrameElements>({
    button: { current: null },
    anchor: { current: null },
    opener: { current: null },
    closedBy: { current: undefined },
  }).current;
  const opening = useMemo(() => openFrom(elements, setOpen), [elements]);
  const control = useMemo(() => controlOf(elements, opening), [elements, opening]);
  const onKeyDown = useMemo(() => keyDownOf(opening), [opening]);
  const title =
    name === undefined ? text("keys.button") : text("keys.panel.title", { widget: text(name) });
  return (
    <KeysPanelContext.Provider value={control}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the frame only hears keys the widget inside it left unprevented, to open the panel on `?`; it has no role of its own. */}
      <div className={className} onKeyDown={onKeyDown} data-askboard-keys-edits={takesEdits}>
        <KeyTableContext.Provider value={table}>{children}</KeyTableContext.Provider>
      </div>
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Anchor virtualRef={elements.anchor as RefObject<Measurable>} />
        <Popover.Portal>
          <Popover.Content
            aria-label={title}
            data-askboard-keys-for={itemId}
            side="bottom"
            align="end"
            sideOffset={4}
            className={PANEL}
            onEscapeKeyDown={noteClose(elements, "escape")}
            onInteractOutside={noteClose(elements, "outside")}
            onCloseAutoFocus={restoreFocus(elements)}
          >
            {/* Keys typed in the panel stay in it: React events bubble through the portal to the widget. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: it only stops a bubbling key; it has no role of its own. */}
            <div className="flex flex-col gap-sm" onKeyDown={stopKey}>
              <KeysPanelBody table={table} takesEdits={takesEdits} />
              <Popover.Close className={CLOSE} onClick={noteClose(elements, "close")}>
                {text("keys.panel.close")}
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </KeysPanelContext.Provider>
  );
};
