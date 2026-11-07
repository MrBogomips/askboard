// `compute` (AD-13): one graph per board, checked before any engine runs, evaluated by AskBoard's
// own restricted evaluator behind the `FormulaEngine` port, with PERT and CPM written as formulas.
// Plain ECMAScript: it runs in the view and in the session process alike (AD-1).

export { type BoardSourceItem, boardGraphSource } from "./board.ts";
export { BOARD_SOURCES, type BoardSource } from "./board-sources.ts";
export {
  addWorkingDays,
  firstWorkingDateFrom,
  isWorkingDate,
  workingDaysBetween,
} from "./dates.ts";
export { roundNumber } from "./engine/functions.ts";
export { createOwnEngine } from "./engine/own-engine.ts";
export type {
  EngineCell,
  EngineError,
  EngineReference,
  EngineScalar,
  EngineValue,
  FormulaEngine,
} from "./engine/port.ts";
export { evaluateGraph, type GraphValues } from "./evaluate.ts";
export type { Expression } from "./formula/expression.ts";
export { buildGraph, type Graph, type GraphNode } from "./graph/build.ts";
export {
  type FieldInput,
  type Fields,
  type FieldsItem,
  type GraphChild,
  type GraphItem,
  type GraphSource,
  GraphSourceError,
} from "./source.ts";
export {
  type Address,
  type FormulaError,
  isFormulaError,
  type NodeResult,
  type Scalar,
  type ValueType,
} from "./types.ts";
