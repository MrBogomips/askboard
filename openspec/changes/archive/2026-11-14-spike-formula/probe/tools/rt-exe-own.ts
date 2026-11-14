// The same executable with the own evaluator and no .wasm: the size baseline for criterion 2.

import { createOwnEngine } from "../src/own/engine.ts";
import { runSuite } from "../src/suite.ts";
import { exeEnvironment } from "./rt-env.ts";

const r = runSuite(createOwnEngine());
console.log(JSON.stringify({ env: exeEnvironment(), engine: "own", suite: r }));
