// The key tables of the registered widget types, without the registry (keyboard-shortcuts-help,
// design decisions 13, 18 and 19; review 10.5, S-43; contract spec: The override check's default
// tables). The override check reads this list when it is given no tables, so `ask-core` and the
// board page run one check on the same tables without loading the registry, which brings every
// widget's props schema and checks. `keys-registered-tables.test.ts` ties the list to `WIDGET_TYPES` both ways; a type
// registered with a table is added here, in the registry's order. Only the tables and the
// vocabulary they are built from are imported: no module of `keys/` imports the registry.

import { CHART_KEYS } from "../widgets/chart/keys.ts";
import { GANTT_KEYS } from "../widgets/gantt/keys.ts";
import { KANBAN_KEYS } from "../widgets/kanban/keys.ts";
import { RANKING_KEYS } from "../widgets/ranking/keys.ts";
import { TIMELINE_KEYS } from "../widgets/timeline/keys.ts";
import { TREE_KEYS } from "../widgets/tree/keys.ts";
import type { KeyTable } from "./vocabulary.ts";

/** A registered type with a key table: what the override check reads of a registry entry. */
export type RegisteredKeyTable = { readonly type: string; readonly keys: KeyTable };

/**
 * What the check reads of a registry entry: its type and, when it has one, its key table. The
 * registry's `WidgetType` fits, and so does a probe registry; the default is the registered tables
 * alone (`REGISTERED_KEY_TABLES`), so the check loads no registry.
 */
export type KeyTypes = readonly { readonly type: string; readonly keys?: KeyTable }[];

/** The registered types that have a key table, in the registry's order, each with its table. Frozen. */
export const REGISTERED_KEY_TABLES: readonly RegisteredKeyTable[] = Object.freeze([
  { type: "tree", keys: TREE_KEYS },
  { type: "gantt", keys: GANTT_KEYS },
  { type: "ranking", keys: RANKING_KEYS },
  { type: "kanban", keys: KANBAN_KEYS },
  { type: "timeline", keys: TIMELINE_KEYS },
  { type: "chart", keys: CHART_KEYS },
]);
