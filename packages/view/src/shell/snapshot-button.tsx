// The bottom action bar's "Snapshot" and its feedback (snapshot design decision 9; EXPERIENCE.md,
// Snapshot control, Bottom action bar): a secondary button, on every board, disabled while the
// connection is lost or the board moved, absent once the ask is discarded. Its feedback, in a live
// region on a line of its own under the bar's controls (review F-06), shows the unsent-work note
// first, then the path, project-relative and cut in the middle with its full text in the tooltip
// and a "Copy path" button, or the failure with the folder.

import { useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
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

/** The Snapshot's feedback: the bar places it on its own line; empty, it takes no room. */
export const SnapshotFeedback = ({
  control,
  offer,
}: {
  readonly control: SnapshotControl;
  readonly offer: SnapshotOffer;
}) => {
  const state = useSyncExternalStore(control.subscribe, control.get);
  const line = snapshotLineOf(state);
  if (offer === "hidden") return null;
  return (
    <p
      role="status"
      data-askboard-snapshot-feedback=""
      className={
        line === undefined
          ? "sr-only"
          : "order-last flex min-w-0 basis-full items-baseline gap-x-2 text-body"
      }
    >
      {line?.note === undefined ? null : (
        <span className="shrink-0 text-foreground-secondary">{line.note}</span>
      )}
      {line === undefined ? null : (
        <span className={`shrink-0 ${line.failed ? "text-destructive-text" : "text-foreground"}`}>
          {line.text}
        </span>
      )}
      {line?.code === undefined ? null : (
        <code className={CODE} title={line.code}>
          {shownPath(line.code)}
        </code>
      )}
      {line?.savedPath === undefined ? null : <CopyPath path={line.savedPath} />}
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
      Snapshot
    </button>
  );
};
