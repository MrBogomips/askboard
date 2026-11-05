// The bottom action bar's "Snapshot" and its feedback (snapshot design decision 9; EXPERIENCE.md,
// Snapshot control, Bottom action bar): a secondary button, on every board, disabled while the
// connection is lost or the board moved, absent once the ask is discarded. Its feedback, in a
// live region, shows the unsent-work note first, then the path, or the failure with the folder.

import { useSyncExternalStore } from "react";
import { type SnapshotControl, type SnapshotOffer, snapshotLineOf } from "./snapshot-control.ts";
import { BUTTON_SECONDARY } from "./styles.ts";

const CODE = "rounded-sm bg-muted px-1 font-mono text-body break-all text-foreground";

const Feedback = ({ control }: { readonly control: SnapshotControl }) => {
  const state = useSyncExternalStore(control.subscribe, control.get);
  const line = snapshotLineOf(state);
  return (
    <p
      role="status"
      data-askboard-snapshot-feedback=""
      className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-body"
    >
      {line?.note === undefined ? null : (
        <span className="text-foreground-secondary">{line.note}</span>
      )}
      {line === undefined ? null : (
        <span className={line.failed ? "text-destructive-text" : "text-foreground"}>
          {line.text}
        </span>
      )}
      {line?.code === undefined ? null : <code className={CODE}>{line.code}</code>}
    </p>
  );
};

/** "Snapshot" and its feedback, as the board offers it. */
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
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <Feedback control={control} />
      <button
        type="button"
        className={BUTTON_SECONDARY}
        disabled={offer === "disabled" || state.phase === "taking"}
        onClick={() => control.take()}
      >
        Snapshot
      </button>
    </span>
  );
};
