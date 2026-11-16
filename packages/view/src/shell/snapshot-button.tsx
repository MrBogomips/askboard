// The ask row's "Snapshot" and its outcome (snapshot design decision 9; EXPERIENCE.md, Snapshot
// control, Feedback tray): a secondary button with the camera icon, on every board, disabled while
// the connection is lost or the board moved, absent once the ask is discarded. Its outcome shows in
// the feedback tray (`SnapshotOutcome`).

import { useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
import { IconSnapshot } from "../icons/index.ts";
import { shownPath } from "../snapshot-path.ts";
import { copyText } from "./copy-text.ts";
import { type SnapshotControl, type SnapshotOffer, snapshotLineOf } from "./snapshot-control.ts";
import { BUTTON_LINK, BUTTON_SECONDARY } from "./styles.ts";

const CODE = "min-w-0 truncate rounded-sm bg-muted px-1 font-mono text-body text-foreground";

// "Copy path": the full path on the clipboard; a browser that copies nothing is logged.
const CopyPath = ({ path }: { readonly path: string }) => {
  const text = useStrings();
  return (
    <button
      type="button"
      className={BUTTON_LINK}
      onClick={() => {
        copyText(document, path).catch((error: unknown) =>
          console.error("askboard: the Snapshot's path could not be copied:", error),
        );
      }}
    >
      {text("snapshot.copyPath")}
    </button>
  );
};

/**
 * A Snapshot's outcome as the feedback tray shows it (answering-flow-visual, design decision 11):
 * the unsent-work note first, then the path, project-relative and cut in the middle with its full
 * text in the tooltip and a "Copy path" button, or the failure with the folder. Nothing while no
 * Snapshot was asked. The one message that is a live region, since its words are not strings of
 * the status region.
 */
export const SnapshotOutcome = ({ control }: { readonly control: SnapshotControl }) => {
  const state = useSyncExternalStore(control.subscribe, control.get);
  const line = snapshotLineOf(state);
  if (line === undefined) return null;
  return (
    <p
      role="status"
      data-askboard-snapshot-feedback=""
      className="m-0 flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-body"
    >
      {line.note === undefined ? null : (
        <span className="shrink-0 text-foreground-secondary">{line.note}</span>
      )}
      <span className={`shrink-0 ${line.failed ? "text-destructive-text" : "text-foreground"}`}>
        {line.text}
      </span>
      {line.code === undefined ? null : (
        <code className={CODE} title={line.code}>
          {shownPath(line.code)}
        </code>
      )}
      {line.savedPath === undefined ? null : <CopyPath path={line.savedPath} />}
    </p>
  );
};

/** "Snapshot", as the board offers it. */
export const SnapshotButton = ({
  control,
  offer,
}: {
  readonly control: SnapshotControl;
  readonly offer: SnapshotOffer;
}) => {
  const state = useSyncExternalStore(control.subscribe, control.get);
  if (offer === "hidden") return null;
  return (
    <button
      type="button"
      className={BUTTON_SECONDARY}
      disabled={offer === "disabled" || state.phase === "taking"}
      onClick={() => control.take()}
    >
      <IconSnapshot className="size-4" />
      Snapshot
    </button>
  );
};
