// Baseline for criterion 3: a view document with no engine, so the engine's share of a load
// is the difference.

import "./mark.ts";
import { view } from "./api.ts";

const v = view();
v.post("result", { mode: "baseline", engine: "none", failed: 0, pass: true });
v.done();
