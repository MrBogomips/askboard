// snapshot-toolbar's fixture: an agent's Snapshot whose record carries the presentation a board
// would open with, `light` and `comfortable`, on the lifecycle Snapshot's data otherwise.

import type { SnapshotData } from "../schemas/snapshot-data/index.ts";
import { SNAPSHOT_DATA_VERSION } from "../schemas/snapshot-data/index.ts";
import { lifecycleSnapshotData } from "./snapshot.ts";

export const snapshotToolbarData: SnapshotData = {
  ...lifecycleSnapshotData,
  versions: { ...lifecycleSnapshotData.versions, snapshot: SNAPSHOT_DATA_VERSION },
  snapshot: {
    ...lifecycleSnapshotData.snapshot,
    presentation: { theme: "light", density: "comfortable" },
  },
};
