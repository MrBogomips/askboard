// IronCalc's view chunk, through the adapter: the module comes from inlined bytes and
// compiles with `initSync`, which needs `'wasm-unsafe-eval'` and nothing else. The marks split
// the engine's start into decoding the base64 and compiling and instantiating the module.

import "./mark.ts";
import { initSync } from "@ironcalc/wasm";
import { createIronCalcEngine } from "../ironcalc/engine.ts";
import { view } from "./api.ts";
import { runView } from "./runner.ts";
import { wasmBytes } from "./wasm-bytes.ts";

let bytes: Uint8Array | null = null;
runView({
  id: "ironcalc",
  prepare: () => {
    bytes = wasmBytes();
    view().post("decoded");
    initSync({ module: bytes });
    view().post("compiled");
  },
  create: () => createIronCalcEngine(bytes ?? wasmBytes()),
});
