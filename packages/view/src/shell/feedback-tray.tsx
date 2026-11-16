// The feedback tray (answering-flow-visual, design decision 11; EXPERIENCE.md, Feedback tray): a
// Snapshot's outcome, a prefill's result and the questions the agent added, at the top right of the
// content, under the header. A message stays until its close control, its own end or a newer one of
// its kind; there is no timer (WCAG 2.2 SC 2.2.1). The tray never takes focus on its own and is not a
// live region (the status region speaks), but for the Snapshot's outcome, whose words are the page's.

import { useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
import { IconClose, IconGo } from "../icons/index.ts";
import type { TrayEntry, TrayKind, Tray as TrayStore } from "./feedback-tray-store.ts";
import { SnapshotOutcome } from "./snapshot-button.tsx";
import type { SnapshotControl } from "./snapshot-control.ts";
import { BUTTON_LINK, BUTTON_SECONDARY, FOCUS_RING } from "./styles.ts";

/** What the tray needs of the board beyond its store. */
export type TrayProps = {
  readonly tray: TrayStore;
  readonly snapshot: SnapshotControl;
  /** "Go": reveals and focuses the first question of the message still unseen. */
  readonly onGo: (questionIds: readonly string[]) => void;
};

const CLOSE = `inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground enabled:hover:bg-accent ${FOCUS_RING}`;

const Message = ({ entry, props }: { readonly entry: TrayEntry; readonly props: TrayProps }) => {
  const text = useStrings();
  const close = (kind: TrayKind) => props.tray.close(kind);
  return (
    <li
      data-askboard-tray={entry.kind}
      className="flex items-start gap-sm rounded-md border border-border bg-popover p-sm text-body text-popover-foreground shadow-md"
    >
      {entry.kind === "snapshot" ? (
        <SnapshotOutcome control={props.snapshot} />
      ) : (
        <>
          <span
            data-askboard-prefilled={entry.kind === "prefill" ? "" : undefined}
            className="min-w-0 flex-1"
          >
            {entry.text === undefined ? null : text(entry.text.key, entry.text.params)}
          </span>
          {entry.kind === "prefill" && entry.onUndo !== undefined ? (
            <button
              type="button"
              className={BUTTON_SECONDARY}
              data-askboard-undo=""
              onClick={entry.onUndo}
            >
              {text("bar.undoPrefill")}
            </button>
          ) : null}
          {entry.kind === "added" ? (
            <button
              type="button"
              className={BUTTON_LINK}
              onClick={() => {
                props.onGo(entry.questions);
                close("added");
              }}
            >
              {text("tray.go")}
              <IconGo className="ml-1 size-4" />
            </button>
          ) : null}
        </>
      )}
      <button
        type="button"
        aria-label={text("tray.close")}
        title={text("tray.close")}
        className={CLOSE}
        onClick={() => close(entry.kind)}
      >
        <IconClose className="size-4" />
      </button>
    </li>
  );
};

/** The tray: nothing while it holds no message. */
export const FeedbackTray = (props: TrayProps) => {
  const entries = useSyncExternalStore(props.tray.subscribe, props.tray.get);
  if (entries.length === 0) return null;
  return (
    <ul
      data-askboard-tray-box=""
      style={{ top: "calc(var(--askboard-header-height, 0px) + 0.5rem)" }}
      className="fixed right-lg z-20 m-0 flex w-[360px] max-w-[calc(100vw-2rem)] list-none flex-col gap-sm p-0"
    >
      {entries.map((entry) => (
        <Message key={entry.kind} entry={entry} props={props} />
      ))}
    </ul>
  );
};
