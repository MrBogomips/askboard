// Engine factories behind the FormulaEngine port. The view and run.ts pick one by name.

export { createOwnEngine } from "./own/engine.ts";
// IronCalc: enable once src/ironcalc/engine.ts exists (owned by the IronCalc adapter's author).
export { createIronCalcEngine } from "./ironcalc/engine.ts";
