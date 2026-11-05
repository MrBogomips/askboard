// The top line of an opened Snapshot (DESIGN.md, Snapshot view): a full-width band above the
// context header, on the muted fill with a bottom rule, "Snapshot" semibold; no marker, no action.

import { type OpenedSnapshot, topLineOf } from "./opened-snapshot.ts";

export const SnapshotTopLine = ({ opened }: { readonly opened: OpenedSnapshot }) => {
  const { taken, note } = topLineOf(opened);
  return (
    <p className="border-b border-border bg-muted px-4 py-2 text-body text-foreground-secondary">
      <span className="font-semibold text-foreground">Snapshot</span>
      {taken}
      {note === undefined ? null : ` · ${note}`}
    </p>
  );
};
