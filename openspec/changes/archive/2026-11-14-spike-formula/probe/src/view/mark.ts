// Imported first by every engine entry: its body is the first code of the chunk that runs,
// so its mark is "the chunk is running" (after the browser parsed the whole chunk).

import { view } from "./api.ts";

view().post("chunk-running");
