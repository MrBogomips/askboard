// Plain TypeScript reference implementation of the molecules' derived fields, standing in
// for AskBoard's in-house code (design decision 3). It reads the board document directly,
// with no formula and no engine, so it checks the formulas buildGraph writes. Dates use
// Date.UTC and getUTCDay day by day, a different method from the own engine's serials.

import type {
  BoardDocument,
  BoardItem,
  DecisionData,
  GanttPlanData,
  MoneyValue,
  SalesData,
  WbsNode,
} from "./graph.ts";
import type { Address, Scalar } from "./port.ts";

export type Expected = Scalar | { readonly error: string };

const DAY = 86400000;

function items(board: BoardDocument): BoardItem[] {
  const out: BoardItem[] = [];
  const walk = (list: readonly BoardItem[]): void => {
    for (const item of list) {
      out.push(item);
      walk(item.props?.items ?? []);
    }
  };
  walk(board.items);
  return out;
}

/** Derived values of every molecule on the board, by address. */
export function referenceValues(board: BoardDocument): Map<Address, Expected> {
  const out = new Map<Address, Expected>();
  const leaves = new Map<string, Array<{ path: string; expected: number }>>();
  for (const item of items(board)) {
    if (item.type !== "molecule") continue;
    const data = item.props?.data;
    if (item.props?.molecule === "wbs-pert") leaves.set(item.id, wbs(item.id, (data as { nodes: WbsNode[] }).nodes, out));
  }
  for (const item of items(board)) {
    if (item.type !== "molecule") continue;
    const data = item.props?.data;
    if (item.props?.molecule === "gantt-plan") gantt(item.id, data as GanttPlanData, leaves, out);
    if (item.props?.molecule === "sales-estimate-review") sales(item.id, data as SalesData, out);
    if (item.props?.molecule === "decision-matrix") decision(item.id, data as DecisionData, out);
  }
  return out;
}

function wbs(item: string, roots: readonly WbsNode[], out: Map<Address, Expected>): Array<{ path: string; expected: number }> {
  const leafList: Array<{ path: string; expected: number }> = [];
  const walk = (node: WbsNode, path: string): { e: number; s: number } => {
    const p = `${path}.${node.id}`;
    let e: number;
    let s: number;
    if (node.children && node.children.length > 0) {
      const parts = node.children.map((c) => walk(c, p));
      e = parts.reduce((acc, x) => acc + x.e, 0);
      s = Math.sqrt(parts.reduce((acc, x) => acc + x.s * x.s, 0));
    } else {
      const o = node.optimistic ?? 0;
      const m = node.mostLikely ?? 0;
      const pe = node.pessimistic ?? 0;
      e = (o + 4 * m + pe) / 6;
      s = (pe - o) / 6;
      leafList.push({ path: p, expected: e });
    }
    out.set(`${p}.expected`, e);
    out.set(`${p}.spread`, s);
    return { e, s };
  };
  const tops = roots.map((r) => walk(r, item));
  out.set(`${item}.expected`, tops.reduce((acc, x) => acc + x.e, 0));
  out.set(`${item}.spread`, Math.sqrt(tops.reduce((acc, x) => acc + x.s * x.s, 0)));
  return leafList;
}

function utcDays(text: string): number {
  const [y, m, d] = text.split("-").map(Number);
  return Date.UTC(y as number, (m as number) - 1, d as number) / DAY;
}

function isoDate(days: number): string {
  return new Date(days * DAY).toISOString().slice(0, 10);
}

function working(days: number): boolean {
  const w = new Date(days * DAY).getUTCDay();
  return w !== 0 && w !== 6;
}

/** The n-th working day after `day` (n >= 0), day by day. */
function addWorkingDays(day: number, n: number): number {
  let d = day;
  let left = n;
  while (left > 0) {
    d++;
    if (working(d)) left--;
  }
  return d;
}

/** Whole working days: expected effort rounded up, at least 1 (Excel's ROUNDUP works on 15 digits). */
export function durationOf(expected: number): number {
  return Math.max(1, Math.ceil(Number(expected.toPrecision(15))));
}

function gantt(item: string, data: GanttPlanData, leaves: ReadonlyMap<string, Array<{ path: string; expected: number }>>, out: Map<Address, Expected>): void {
  const tasks = (leaves.get(data.workPackages) ?? []).map((l) => ({ id: l.path.slice(l.path.lastIndexOf(".") + 1), duration: durationOf(l.expected) }));
  const deps = new Map(Object.entries(data.dependencies ?? {}));
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  // Forward pass in dependency order (repeat until settled; the fixtures are acyclic).
  const pending = [...tasks];
  while (pending.length > 0) {
    const i = pending.findIndex((t) => (deps.get(t.id) ?? []).every((p) => ef.has(p)));
    if (i < 0) throw new Error(`gantt ${item}: cycle or unknown predecessor`);
    const t = pending.splice(i, 1)[0] as { id: string; duration: number };
    const start = Math.max(0, ...(deps.get(t.id) ?? []).map((p) => ef.get(p) as number));
    es.set(t.id, start);
    ef.set(t.id, start + t.duration);
  }
  const finish = Math.max(0, ...tasks.map((t) => ef.get(t.id) as number));
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  const succ = (id: string): string[] => tasks.filter((t) => (deps.get(t.id) ?? []).includes(id)).map((t) => t.id);
  const back = [...tasks];
  while (back.length > 0) {
    const i = back.findIndex((t) => succ(t.id).every((s) => ls.has(s)));
    const t = back.splice(i, 1)[0] as { id: string; duration: number };
    const s = succ(t.id);
    const late = s.length > 0 ? Math.min(...s.map((x) => ls.get(x) as number)) : finish;
    lf.set(t.id, late);
    ls.set(t.id, late - t.duration);
  }
  let first = utcDays(data.start);
  while (!working(first)) first++;
  out.set(`${item}.firstDay`, isoDate(first));
  for (const t of tasks) {
    const p = `${item}.${t.id}`;
    const e = es.get(t.id) as number;
    const f = ef.get(t.id) as number;
    out.set(`${p}.duration`, t.duration);
    out.set(`${p}.es`, e);
    out.set(`${p}.ef`, f);
    out.set(`${p}.lf`, lf.get(t.id) as number);
    out.set(`${p}.ls`, ls.get(t.id) as number);
    const slack = (ls.get(t.id) as number) - e;
    out.set(`${p}.slack`, slack);
    out.set(`${p}.critical`, slack === 0);
    out.set(`${p}.startDate`, isoDate(addWorkingDays(first, e)));
    out.set(`${p}.finishDate`, isoDate(addWorkingDays(first, f - 1)));
  }
  out.set(`${item}.finish`, finish);
  out.set(`${item}.finishDate`, isoDate(addWorkingDays(first, finish - 1)));
}

function amount(v: MoneyValue): { value: number; currency: string | null } {
  return typeof v === "string" ? { value: Number(v), currency: null } : { value: Number(v.amount), currency: v.currency };
}

function sales(item: string, data: SalesData, out: Map<Address, Expected>): void {
  let cost = 0;
  let revenue = 0;
  // A summed column has one fixed currency: the item's, plus any a line declares.
  const costCurrencies = new Set<string>([data.currency]);
  const revenueCurrencies = new Set<string>([data.currency]);
  for (const line of data.lines) {
    const on = !line.optional || (line.included ?? true);
    const c = amount(line.dailyCost);
    const r = amount(line.dailyRate);
    const lc = on ? line.days * c.value : 0;
    const lr = on ? line.days * r.value : 0;
    out.set(`${item}.${line.id}.cost`, lc);
    out.set(`${item}.${line.id}.revenue`, lr);
    cost += lc;
    revenue += lr;
    if (c.currency) costCurrencies.add(c.currency);
    if (r.currency) revenueCurrencies.add(r.currency);
  }
  const mixed = { error: "mixed-currencies" } as const;
  out.set(`${item}.totalCost`, costCurrencies.size > 1 ? mixed : cost);
  out.set(`${item}.totalRevenue`, revenueCurrencies.size > 1 ? mixed : revenue);
  if (costCurrencies.size > 1 || revenueCurrencies.size > 1) {
    out.set(`${item}.margin`, mixed);
    out.set(`${item}.belowMinimum`, mixed);
    return;
  }
  if (revenue === 0) {
    out.set(`${item}.margin`, { error: "division-by-zero" });
    out.set(`${item}.belowMinimum`, { error: "division-by-zero" });
    return;
  }
  const margin = (revenue - cost) / revenue;
  out.set(`${item}.margin`, margin);
  const min = data.minMargin;
  out.set(`${item}.belowMinimum`, typeof min === "number" && margin < min);
}

function decision(item: string, data: DecisionData, out: Map<Address, Expected>): void {
  const total = data.criteria.reduce((s, c) => s + c.weight, 0);
  let best = Number.NEGATIVE_INFINITY;
  for (const o of data.options) {
    let sum = 0;
    for (const c of data.criteria) {
      const r = Object.hasOwn(o.ratings, c.id) ? (o.ratings[c.id] ?? 0) : 0;
      sum += c.weight * r;
    }
    const score = sum / total;
    out.set(`${item}.options.${o.id}.score`, score);
    if (score > best) best = score;
  }
  out.set(`${item}.best`, data.options.length > 0 ? best : 0);
}

/**
 * Applies an input edit, given by address, to a copy of the board document, so the
 * reference can recompute after the edits a fixture makes through the port.
 */
export function applySet(board: BoardDocument, address: Address, value: Scalar): BoardDocument {
  const copy = structuredCloneJson(board);
  const segs = address.split(".");
  const item = items(copy).find((i) => i.id === segs[0]);
  if (!item) throw new Error(`applySet: no item ${segs[0]}`);
  const data = item.props?.data as Record<string, unknown>;
  const field = segs[segs.length - 1] as string;
  const path = segs.slice(1, -1);
  const molecule = item.props?.molecule;
  if (molecule === "wbs-pert") {
    let list = (data as unknown as { nodes: WbsNode[] }).nodes;
    let node: WbsNode | undefined;
    for (const id of path) {
      node = list.find((n) => n.id === id);
      if (!node) throw new Error(`applySet: no node ${address}`);
      list = (node.children ?? []) as WbsNode[];
    }
    (node as unknown as Record<string, Scalar>)[field] = value;
  } else if (molecule === "gantt-plan" && path.length === 0 && field === "start") {
    data.start = value;
  } else if (molecule === "sales-estimate-review") {
    if (path.length === 0) data[field] = value;
    else {
      const line = (data.lines as Array<Record<string, unknown>>).find((l) => l.id === path[0]);
      if (!line) throw new Error(`applySet: no line ${address}`);
      const old = line[field];
      line[field] = old !== null && typeof old === "object" ? { ...(old as object), amount: value } : value;
    }
  } else if (molecule === "decision-matrix") {
    if (path[0] === "criteria") {
      const c = (data.criteria as Array<Record<string, unknown>>).find((x) => x.id === path[1]);
      if (!c) throw new Error(`applySet: no criterion ${address}`);
      c.weight = value;
    } else {
      const o = (data.options as Array<{ id: string; ratings: Record<string, unknown> }>).find((x) => x.id === path[1]);
      if (!o) throw new Error(`applySet: no option ${address}`);
      o.ratings[path[2] as string] = value;
    }
  } else {
    throw new Error(`applySet: cannot edit ${address}`);
  }
  return copy;
}

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
