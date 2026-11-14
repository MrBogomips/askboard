// Every fixture, imported as JSON modules or generated, so `bun build` inlines them for the
// view and no runtime needs a file system.

import decisionMatrix from "../fixtures/boards/decision-matrix.json" with { type: "json" };
import spreadsheet from "../fixtures/boards/spreadsheet.json" with { type: "json" };
import uj2 from "../fixtures/boards/uj2-wbs-gantt.json" with { type: "json" };
import uj3 from "../fixtures/boards/uj3-sales-review.json" with { type: "json" };
import errors from "../fixtures/errors.json" with { type: "json" };
import { type ErrorFixture, hostileFixtures } from "../fixtures/hostile.ts";
import whitelist from "../fixtures/whitelist.json" with { type: "json" };
import type { BoardDocument } from "./graph.ts";
import type { Address, GraphNode, NodeType, Scalar } from "./port.ts";
import type { Expected } from "./reference.ts";

export type { ErrorFixture };

export interface WhitelistCase {
  readonly id: string;
  readonly op: string;
  readonly formula: string;
  readonly expected: Expected;
  readonly type?: NodeType;
  readonly use?: readonly string[];
  readonly inputs?: readonly GraphNode[];
  readonly warnings?: readonly { readonly error: string; readonly address: string }[];
  readonly excel?: string;
  readonly js?: unknown;
  readonly note?: string;
}

export interface BoardEdit {
  readonly set: Readonly<Record<Address, Scalar>>;
  readonly expected: Readonly<Record<Address, Expected>>;
}

export interface BoardFixture {
  readonly name: string;
  readonly source?: string;
  /** A molecule fixture: its expected values come from src/reference.ts. */
  readonly molecule: boolean;
  readonly board: BoardDocument;
  readonly expected: Readonly<Record<Address, Expected>>;
  readonly warnings: readonly { readonly error: string; readonly address: string }[];
  readonly edits: readonly BoardEdit[];
}

export const WHITELIST_CASES = whitelist.cases as unknown as readonly WhitelistCase[];
export const INPUT_SETS = whitelist.inputSets as unknown as Readonly<Record<string, readonly GraphNode[]>>;
export const BOARD_FIXTURES = [uj2, uj3, decisionMatrix, spreadsheet] as unknown as readonly BoardFixture[];

let hostile: ErrorFixture[] | null = null;
export function errorFixtures(): readonly ErrorFixture[] {
  hostile ??= hostileFixtures();
  return [...(errors.cases as unknown as ErrorFixture[]), ...hostile];
}

/** The graph a whitelist case loads: its inputs, then the result node t.r. */
export function whitelistNodes(c: WhitelistCase): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (const name of c.use ?? []) nodes.push(...(INPUT_SETS[name] ?? []));
  nodes.push(...(c.inputs ?? []));
  nodes.push({ address: "t.r", type: c.type ?? "number", formula: c.formula });
  return nodes;
}
