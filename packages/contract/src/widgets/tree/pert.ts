// The Tree's PERT rules (molecules design decision 8; contract spec, "Tree PERT props"): with
// `pert`, the columns declare the three estimates as numbers and every estimate is a number of
// working days from 0 to 100,000 (F8), a parent's too, which PERT ignores; `openDepth`, a whole
// number of levels from 1 to 8, comes only with `pert`. Estimates are unordered. The schema says
// the props' own types; these rules hold also for the props the Tree's chunk reads, which no
// schema has seen. Plain ECMAScript with no JSON and no Ajv; never throws.

import { pointerOf } from "../../molecules/pointer.ts";
import type { Problem } from "../../validate.ts";
import { TREE_MAX_DEPTH, TREE_PERT_MAX_ESTIMATE, type TreeColumnType } from "./index.ts";

/** The three estimates PERT reads, the fields a Gantt plan's link reads from its Tree. */
const PERT_ESTIMATES = ["optimistic", "mostLikely", "pessimistic"] as const;

type Json = Readonly<Record<string, unknown>>;
type Path = readonly (string | number)[];

/** The declared fields by name; `undefined` for a column whose type is refused. */
type Columns = ReadonlyMap<string, TreeColumnType | undefined>;

const RANGE = `where an estimate is 0 to ${TREE_PERT_MAX_ESTIMATE.toLocaleString("en-US")} working days`;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const columnProblems = (columns: Columns): Problem[] =>
  PERT_ESTIMATES.flatMap((field) => {
    const type = columns.get(field);
    if (type === "number") return [];
    const why = columns.has(field)
      ? `its column is ${type ?? "of no known type"}`
      : "no column declares it";
    const message = `a work breakdown with pert declares "${field}" as a number column, and ${why}`;
    return [{ path: "/pert", message }];
  });

// Every node's estimates outside the range, in document order; a value that is no number is the
// column type check's to report.
const estimateProblems = (list: unknown, at: Path): Problem[] => {
  if (!Array.isArray(list)) return [];
  return list.flatMap((node: unknown, index) => {
    if (!isObject(node)) return [];
    const path = [...at, index];
    const own = PERT_ESTIMATES.flatMap((field) => {
      const value = node[field];
      if (typeof value !== "number" || !Number.isFinite(value)) return [];
      if (value >= 0 && value <= TREE_PERT_MAX_ESTIMATE) return [];
      const message = `the estimate "${field}" of the node "${String(node.id)}" is ${value}, ${RANGE}`;
      return [{ path: pointerOf([...path, field]), message }];
    });
    return [...own, ...estimateProblems(node.children, [...path, "children"])];
  });
};

const depthProblems = (openDepth: unknown, pert: unknown): Problem[] => {
  if (openDepth === undefined) return [];
  const whole =
    typeof openDepth === "number" &&
    Number.isInteger(openDepth) &&
    openDepth >= 1 &&
    openDepth <= TREE_MAX_DEPTH;
  if (!whole) {
    const message = `openDepth is a whole number of levels from 1 to ${TREE_MAX_DEPTH}`;
    return [{ path: "/openDepth", message }];
  }
  if (pert === true) return [];
  const message = "openDepth needs pert: a Tree without pert opens fully expanded";
  return [{ path: "/openDepth", message }];
};

/** The PERT rules on a Tree's props, given the columns `treePropsProblems` read. */
export const treePertProblems = (props: Json, columns: Columns): Problem[] => {
  const { pert, openDepth } = props;
  const problems = depthProblems(openDepth, pert);
  if (pert === undefined) return problems;
  if (pert !== true) {
    const message = "pert is true when given: a Tree without it computes nothing";
    return [{ path: "/pert", message }, ...problems];
  }
  return [...problems, ...columnProblems(columns), ...estimateProblems(props.nodes, ["nodes"])];
};
