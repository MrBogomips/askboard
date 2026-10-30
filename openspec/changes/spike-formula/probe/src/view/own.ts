// The own evaluator's view chunk.

import "./mark.ts";
import { createOwnEngine } from "../own/engine.ts";
import { runView } from "./runner.ts";

runView({ id: "own", prepare: () => undefined, create: createOwnEngine });
