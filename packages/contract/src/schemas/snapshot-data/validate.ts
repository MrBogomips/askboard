// Validates a Snapshot's data block (snapshot design decision 2): an unsupported major of the
// set first, then the schema. `src/validate.ts` re-exports this module, which imports from it: the
// cycle is safe because neither module makes a call at its top level.
//
// The data's `origin` is push delivery's origin message, a standalone schema that E1's shared
// validator does not hold (push-delivery design decision 1). Until push delivery's follow-up joins
// it to the board protocol's set, the data compiles in a validator of its own, made at the first
// validation by `createAjv` with the board protocol's standalone messages beside E1's sets.

import type Ajv2020 from "ajv/dist/2020";
import { createAjv, errorsIn } from "../../compiled.ts";
import { pushBoardProtocolSchemas } from "../../push/messages.ts";
import { type Checked, problemOf } from "../../validate.ts";
import { unsupportedVersion } from "../../versions.ts";
import { SNAPSHOT_DATA_ID, type SnapshotData, snapshotDataSet } from "./index.ts";

let snapshotAjv: Ajv2020 | undefined;

const withOrigin = (): Ajv2020 => {
  if (snapshotAjv === undefined) {
    const ajv = createAjv();
    for (const schema of pushBoardProtocolSchemas.schemas) ajv.addSchema(schema);
    snapshotAjv = ajv;
  }
  return snapshotAjv;
};

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
  const errors = errorsIn(withOrigin(), SNAPSHOT_DATA_ID, value);
  if (errors.length === 0) return { ok: true, value: value as SnapshotData };
  return { ok: false, reason: "schema", problems: errors.map(problemOf) };
};
