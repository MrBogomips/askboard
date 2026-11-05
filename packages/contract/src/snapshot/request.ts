// Validation of the `snapshot` request against its envelope (AD-6, AD-7; snapshot design decision
// 2): the ask's ID and nothing else, so a `path` the agent passes is refused by name.

import { ID_SHAPE } from "../ask-items.ts";
import { schemaErrors } from "../compiled.ts";
import { inDocumentOrder, located, schemaProblem, type Wording } from "../problems.ts";
import type { CheckedRequest } from "../requests.ts";
import type { SnapshotRequest } from "../schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS } from "../sets.ts";

const SNAPSHOT: Wording = {
  root: "(the request)",
  expected: { "": "a snapshot request: an object {askId}", askId: ID_SHAPE },
  fields: { "": "snapshot takes only askId: AskBoard chooses the file's folder and name" },
};

/** Validates a `snapshot` request against its envelope, each problem naming its field. */
export const validateSnapshotRequest = (value: unknown): CheckedRequest<SnapshotRequest> => {
  const problems = schemaErrors(SCHEMA_IDS.snapshotRequest, value)
    .map(located)
    .map((entry) => schemaProblem(SNAPSHOT, value, entry));
  if (problems.length === 0) return { ok: true, value: value as SnapshotRequest };
  return { ok: false, reason: "schema", problems: inDocumentOrder(value, problems) };
};
