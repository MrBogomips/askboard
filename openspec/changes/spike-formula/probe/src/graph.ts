// `buildGraph(boardDocument)` stand-in (design decision 2, AD-13): expands each molecule of
// a board into graph nodes, with its built-in derived fields written as formulas over the
// whitelist, so the molecules' arithmetic lives in formulas and not in widget code. Nodes
// come out in document order, which is the order a wildcard resolves to.

import type { Address, GraphNode, NodeType, Scalar } from "./port.ts";
import { parseCell } from "./refs.ts";

// Board document shapes the stand-in reads (the model contract's examples, AD-6/AD-7).
export interface BoardItem {
  readonly type: string;
  readonly id: string;
  readonly props?: { readonly items?: readonly BoardItem[]; readonly molecule?: string; readonly data?: unknown; readonly cells?: unknown };
}
export interface BoardDocument {
  readonly items: readonly BoardItem[];
}
export interface WbsNode {
  readonly id: string;
  readonly children?: readonly WbsNode[];
  readonly optimistic?: number;
  readonly mostLikely?: number;
  readonly pessimistic?: number;
}
export interface GanttPlanData {
  readonly workPackages: string;
  readonly start: string;
  readonly dependencies?: Readonly<Record<string, readonly string[]>>;
}
/** Money: a decimal string in the item's currency, or an amount with its own ISO 4217 code (AD-7). */
export type MoneyValue = string | { readonly amount: string; readonly currency: string };
export interface SalesLine {
  readonly id: string;
  readonly days: number;
  readonly dailyCost: MoneyValue;
  readonly dailyRate: MoneyValue;
  readonly optional?: boolean;
  readonly included?: boolean;
}
export interface SalesData {
  readonly currency: string;
  readonly minMargin?: number | null;
  readonly lines: readonly SalesLine[];
}
export interface DecisionData {
  readonly criteria: readonly { readonly id: string; readonly weight: number }[];
  readonly options: readonly { readonly id: string; readonly ratings: Readonly<Record<string, number | null>> }[];
}
/** A cell: a plain value, an input with a declared type (a date), or a formula. */
export type CellInput = Scalar | { readonly formula?: string; readonly value?: Scalar; readonly type?: NodeType };

const ref = (address: Address): string => `[${address}]`;

export function buildGraph(board: BoardDocument): GraphNode[] {
  const nodes: GraphNode[] = [];
  const wbsLeaves = new Map<string, Address[]>();
  // Two passes: a Gantt plan names its WBS by item ID, which may come later in the document.
  const items = flatten(board.items);
  for (const item of items) {
    if (item.type === "molecule" && item.props?.molecule === "wbs-pert") {
      wbsLeaves.set(item.id, wbsPaths(item.id, (item.props.data as { nodes: WbsNode[] }).nodes));
    }
  }
  for (const item of items) {
    const data = item.props?.data;
    if (item.type === "molecule") {
      switch (item.props?.molecule) {
        case "wbs-pert":
          wbsNodes(item.id, (data as { nodes: WbsNode[] }).nodes, nodes);
          break;
        case "gantt-plan":
          ganttNodes(item.id, data as GanttPlanData, wbsLeaves, nodes);
          break;
        case "sales-estimate-review":
          salesNodes(item.id, data as SalesData, nodes);
          break;
        case "decision-matrix":
          decisionNodes(item.id, data as DecisionData, nodes);
          break;
      }
    } else if (item.type === "spreadsheet") {
      sheetNodes(item.id, (item.props?.cells ?? {}) as Readonly<Record<string, CellInput>>, nodes);
    }
  }
  return nodes;
}

function flatten(items: readonly BoardItem[]): BoardItem[] {
  const out: BoardItem[] = [];
  const stack = [...items].reverse();
  while (stack.length > 0) {
    const item = stack.pop() as BoardItem;
    out.push(item);
    const children = item.props?.items ?? [];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i] as BoardItem);
  }
  return out;
}

/** Leaf paths of a WBS (item ID then child IDs), in document order. */
function wbsPaths(item: string, roots: readonly WbsNode[]): Address[] {
  const out: Address[] = [];
  const walk = (node: WbsNode, path: string): void => {
    const here = `${path}.${node.id}`;
    if (node.children && node.children.length > 0) for (const c of node.children) walk(c, here);
    else out.push(here);
  };
  for (const r of roots) walk(r, item);
  return out;
}

function wbsNodes(item: string, roots: readonly WbsNode[], out: GraphNode[]): void {
  const walk = (node: WbsNode, path: string): void => {
    const p = `${path}.${node.id}`;
    if (node.children && node.children.length > 0) {
      out.push({ address: `${p}.expected`, type: "number", formula: `SUM(${ref(`${p}.*.expected`)})` });
      out.push({ address: `${p}.spread`, type: "number", formula: `SQRT(SUMSQ(${ref(`${p}.*.spread`)}))` });
      for (const c of node.children) walk(c, p);
      return;
    }
    out.push({ address: `${p}.optimistic`, type: "number", value: node.optimistic ?? null });
    out.push({ address: `${p}.mostLikely`, type: "number", value: node.mostLikely ?? null });
    out.push({ address: `${p}.pessimistic`, type: "number", value: node.pessimistic ?? null });
    out.push({
      address: `${p}.expected`,
      type: "number",
      formula: `(${ref(`${p}.optimistic`)}+4*${ref(`${p}.mostLikely`)}+${ref(`${p}.pessimistic`)})/6`,
    });
    out.push({ address: `${p}.spread`, type: "number", formula: `(${ref(`${p}.pessimistic`)}-${ref(`${p}.optimistic`)})/6` });
  };
  out.push({ address: `${item}.expected`, type: "number", formula: `SUM(${ref(`${item}.*.expected`)})` });
  out.push({ address: `${item}.spread`, type: "number", formula: `SQRT(SUMSQ(${ref(`${item}.*.spread`)}))` });
  for (const r of roots) walk(r, item);
}

/** CPM in working-day offsets from the plan's first working day; dates through WORKDAY. */
function ganttNodes(item: string, data: GanttPlanData, wbsLeaves: ReadonlyMap<string, Address[]>, out: GraphNode[]): void {
  const leaves = wbsLeaves.get(data.workPackages) ?? [];
  const ids = leaves.map((a) => a.slice(a.lastIndexOf(".") + 1));
  const preds = new Map<string, readonly string[]>();
  for (const [task, list] of Object.entries(data.dependencies ?? {})) preds.set(task, list);
  const succs = new Map<string, string[]>();
  for (const id of ids) {
    for (const p of preds.get(id) ?? []) {
      const list = succs.get(p);
      if (list) list.push(id);
      else succs.set(p, [id]);
    }
  }
  const t = (id: string, field: string): string => ref(`${item}.${id}.${field}`);
  out.push({ address: `${item}.start`, type: "date", value: data.start });
  // The first working day on or after the start: WORKDAY(d, 0) would keep a weekend start.
  out.push({ address: `${item}.firstDay`, type: "date", formula: `WORKDAY(${ref(`${item}.start`)}-1,1)` });
  leaves.forEach((leaf, i) => {
    const id = ids[i] as string;
    const p = `${item}.${id}`;
    const before = preds.get(id) ?? [];
    const after = succs.get(id) ?? [];
    out.push({ address: `${p}.duration`, type: "number", formula: `MAX(1,ROUNDUP(${ref(`${leaf}.expected`)},0))` });
    out.push({ address: `${p}.es`, type: "number", formula: before.length > 0 ? `MAX(0,${before.map((b) => t(b, "ef")).join(",")})` : "0" });
    out.push({ address: `${p}.ef`, type: "number", formula: `${t(id, "es")}+${t(id, "duration")}` });
    out.push({ address: `${p}.lf`, type: "number", formula: after.length > 0 ? `MIN(${after.map((s) => t(s, "ls")).join(",")})` : ref(`${item}.finish`) });
    out.push({ address: `${p}.ls`, type: "number", formula: `${t(id, "lf")}-${t(id, "duration")}` });
    out.push({ address: `${p}.slack`, type: "number", formula: `${t(id, "ls")}-${t(id, "es")}` });
    out.push({ address: `${p}.critical`, type: "boolean", formula: `${t(id, "slack")}=0` });
    out.push({ address: `${p}.startDate`, type: "date", formula: `WORKDAY(${ref(`${item}.firstDay`)},${t(id, "es")})` });
    out.push({ address: `${p}.finishDate`, type: "date", formula: `WORKDAY(${ref(`${item}.firstDay`)},${t(id, "ef")}-1)` });
  });
  out.push({ address: `${item}.finish`, type: "number", formula: `MAX(${ref(`${item}.*.ef`)})` });
  out.push({ address: `${item}.finishDate`, type: "date", formula: `WORKDAY(${ref(`${item}.firstDay`)},${ref(`${item}.finish`)}-1)` });
}

function money(value: MoneyValue, itemCurrency: string): { value: string; currency: string } {
  return typeof value === "string" ? { value, currency: itemCurrency } : { value: value.amount, currency: value.currency };
}

function salesNodes(item: string, data: SalesData, out: GraphNode[]): void {
  out.push({ address: `${item}.minMargin`, type: "number", value: data.minMargin ?? null });
  for (const line of data.lines) {
    const p = `${item}.${line.id}`;
    const cost = money(line.dailyCost, data.currency);
    const rate = money(line.dailyRate, data.currency);
    out.push({ address: `${p}.days`, type: "number", value: line.days });
    out.push({ address: `${p}.dailyCost`, type: "money", value: cost.value, currency: cost.currency });
    out.push({ address: `${p}.dailyRate`, type: "money", value: rate.value, currency: rate.currency });
    const product = (field: string): string => `${ref(`${p}.days`)}*${ref(`${p}.${field}`)}`;
    if (line.optional) {
      out.push({ address: `${p}.included`, type: "boolean", value: line.included ?? true });
      const guard = (e: string): string => `IF(${ref(`${p}.included`)},${e},0)`;
      out.push({ address: `${p}.cost`, type: "money", formula: guard(product("dailyCost")) });
      out.push({ address: `${p}.revenue`, type: "money", formula: guard(product("dailyRate")) });
    } else {
      out.push({ address: `${p}.cost`, type: "money", formula: product("dailyCost") });
      out.push({ address: `${p}.revenue`, type: "money", formula: product("dailyRate") });
    }
  }
  // A summed money column has one fixed currency: the item's (EXPERIENCE, Derived value).
  out.push({ address: `${item}.totalCost`, type: "money", currency: data.currency, formula: `SUM(${ref(`${item}.*.cost`)})` });
  out.push({ address: `${item}.totalRevenue`, type: "money", currency: data.currency, formula: `SUM(${ref(`${item}.*.revenue`)})` });
  out.push({
    address: `${item}.margin`,
    type: "number",
    formula: `(${ref(`${item}.totalRevenue`)}-${ref(`${item}.totalCost`)})/${ref(`${item}.totalRevenue`)}`,
  });
  out.push({
    address: `${item}.belowMinimum`,
    type: "boolean",
    formula: `AND(${ref(`${item}.minMargin`)}<>"",${ref(`${item}.margin`)}<${ref(`${item}.minMargin`)})`,
  });
}

function decisionNodes(item: string, data: DecisionData, out: GraphNode[]): void {
  for (const c of data.criteria) out.push({ address: `${item}.criteria.${c.id}.weight`, type: "number", value: c.weight });
  const weights = ref(`${item}.criteria.*.weight`);
  for (const o of data.options) {
    const p = `${item}.options.${o.id}`;
    // Ratings follow the criteria's order, so the two wildcard lists line up in SUMPRODUCT.
    for (const c of data.criteria) out.push({ address: `${p}.${c.id}.rating`, type: "number", value: Object.hasOwn(o.ratings, c.id) ? (o.ratings[c.id] ?? null) : null });
    out.push({ address: `${p}.score`, type: "number", formula: `SUMPRODUCT(${weights},${ref(`${p}.*.rating`)})/SUM(${weights})` });
  }
  out.push({ address: `${item}.best`, type: "number", formula: `MAX(${ref(`${item}.options.*.score`)})` });
}

function sheetNodes(item: string, cells: Readonly<Record<string, CellInput>>, out: GraphNode[]): void {
  const sorted = Object.keys(cells)
    .filter((k) => parseCell(k) !== null)
    .sort((a, b) => {
      const x = parseCell(a) as { col: number; row: number };
      const y = parseCell(b) as { col: number; row: number };
      return x.row - y.row || x.col - y.col;
    });
  for (const cell of sorted) {
    const input = cells[cell] as CellInput;
    const address = `${item}.${cell}`;
    if (input === null || typeof input !== "object") out.push({ address, type: typeOf(input), value: input });
    else if (input.formula !== undefined) out.push({ address, type: input.type ?? "number", formula: input.formula });
    else out.push({ address, type: input.type ?? typeOf(input.value ?? null), value: input.value ?? null });
  }
}

function typeOf(v: Scalar): NodeType {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "string") return "text";
  return "number";
}
