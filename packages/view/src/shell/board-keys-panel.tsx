// The board's keys panel (board-keys, design decision 5): a non-modal Radix Popover anchored to the
// header's Keys button, built from the item frame's own parts (`keys-frame-actions.ts`) and
// `KeysPanelBody`. Its entries are the board's table in effect, and a locked board or an opened
// Snapshot lists only the keys that still act. Board strings only, never agent text (AD-8).

import { Popover } from "radix-ui";
import { type RefObject, useMemo, useRef, useState } from "react";
import { KeyHint } from "../catalog/keys/key-help.tsx";
import { buttonRefOf, clickOf, type KeysPanelControl } from "../catalog/keys/keys-button.ts";
import { useStrings } from "../catalog/port.ts";
import { IconKeys } from "../icons/index.ts";
import {
  controlOf,
  type FrameElements,
  type Measurable,
  noteClose,
  openFrom,
  restoreFocus,
  stopKey,
} from "./keys-frame-actions.ts";
import { KeysPanelBody } from "./keys-panel.tsx";
import { BUTTON_SECONDARY } from "./styles.ts";
import { useBoardKeyTable } from "./use-board-keys.ts";

const PANEL =
  "z-30 flex w-80 max-w-[90vw] flex-col gap-sm rounded-md border border-border bg-popover p-sm text-body text-popover-foreground shadow-md";
const CLOSE =
  "self-end rounded-md border border-border bg-muted px-sm py-1 text-control text-foreground hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The panel's state and what opens it: the Keys button, the `?` key and the board hold one. */
export type BoardPanel = {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly elements: FrameElements;
  /** Opens the panel from the element that held the focus, which Escape gives it back to. */
  readonly opening: (from: HTMLElement | null) => void;
  readonly control: KeysPanelControl;
};

export const useBoardPanel = (): BoardPanel => {
  const [open, setOpen] = useState(false);
  const elements = useRef<FrameElements>({
    button: { current: null },
    anchor: { current: null },
    opener: { current: null },
    closedBy: { current: undefined },
  }).current;
  const opening = useMemo(() => openFrom(elements, setOpen), [elements]);
  const control = useMemo(() => controlOf(elements, opening), [elements, opening]);
  return { open, setOpen, elements, opening, control };
};

/** What the header needs of the panel: its state, and whether the board takes edits. */
export type BoardKeysProps = { readonly panel: BoardPanel; readonly takesEdits: boolean };

/** The title, the groups and the closing note. */
export const BoardKeysPanelBody = ({ takesEdits }: { readonly takesEdits: boolean }) => {
  const text = useStrings();
  const table = useBoardKeyTable();
  return (
    <div className="flex flex-col gap-sm">
      <h2 className="text-body font-semibold text-foreground">{text("keys.panel.boardTitle")}</h2>
      <KeysPanelBody table={table} takesEdits={takesEdits} />
      <p className="text-label text-muted-foreground">{text("keys.panel.boardNote")}</p>
    </div>
  );
};

/** The header's "Keys" button and the panel it opens. */
export const BoardKeysButton = ({ panel, takesEdits }: BoardKeysProps) => {
  const text = useStrings();
  const table = useBoardKeyTable();
  const entry = table.find((each) => each.action === "keys.open");
  const button = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={text("keys.button")}
      className={`${BUTTON_SECONDARY} w-control-height justify-center px-0`}
      ref={buttonRefOf(panel.control, undefined)}
      onClick={clickOf(panel.control, undefined)}
    >
      <IconKeys className="size-4" />
    </button>
  );
  return (
    <>
      {entry === undefined ? button : <KeyHint entry={entry}>{button}</KeyHint>}
      <Popover.Root open={panel.open} onOpenChange={panel.setOpen} modal={false}>
        <Popover.Anchor virtualRef={panel.elements.anchor as RefObject<Measurable>} />
        <Popover.Portal>
          <Popover.Content
            aria-label={text("keys.panel.boardTitle")}
            data-askboard-keys-for="board"
            side="bottom"
            align="end"
            sideOffset={4}
            className={PANEL}
            onEscapeKeyDown={noteClose(panel.elements, "escape")}
            onInteractOutside={noteClose(panel.elements, "outside")}
            onCloseAutoFocus={restoreFocus(panel.elements)}
          >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: it only stops a bubbling key; it has no role of its own. */}
            <div className="flex flex-col gap-sm" onKeyDown={stopKey}>
              <BoardKeysPanelBody takesEdits={takesEdits} />
              <Popover.Close className={CLOSE} onClick={noteClose(panel.elements, "close")}>
                {text("keys.panel.close")}
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
};
