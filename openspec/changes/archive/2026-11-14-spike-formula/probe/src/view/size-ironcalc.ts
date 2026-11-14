// Size only (criterion 3): IronCalc's adapter with the module inlined, kept by a global.

import { createIronCalcEngine } from "../ironcalc/engine.ts";
import { wasmBytes } from "./wasm-bytes.ts";

Object.assign(globalThis, { __formulaEngine: () => createIronCalcEngine(wasmBytes()) });
