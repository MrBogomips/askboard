// Validates a Snapshot's data block (snapshot design decision 2): an unsupported major of the
// set first, then the schema. `src/validate.ts` re-exports this module, which imports from it: the
// cycle is safe because neither module makes a call at its top level.

import { type Checked, validateAgainst } from "../../validate.ts";
import { unsupportedVersion } from "../../versions.ts";
import { SNAPSHOT_DATA_ID, type SnapshotData, snapshotDataSet } from "./index.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validates parsed Snapshot data; `reason` is `version` when `versions.snapshot` names no
 * supported major, so a reader of this major refuses a later one's file by name.
 */
export const validateSnapshotData = (value: unknown): Checked<SnapshotData> => {
  const versions = isRecord(value) && isRecord(value.versions) ? value.versions : undefined;
  const refusal = unsupportedVersion(snapshotDataSet, versions?.snapshot);
  if (refusal !== undefined) {
    return {
      ok: false,
      reason: "version",
      problems: [{ path: "/versions/snapshot", message: refusal }],
    };
  }
  return validateAgainst<SnapshotData>(SNAPSHOT_DATA_ID, value);
};
