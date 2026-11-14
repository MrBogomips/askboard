// Imported first by a chunk that bundles zod: `jitless` before any schema is built, so zod never
// probes `new Function` (D21; group 4's AppChannel).
import { config } from "zod";

config({ jitless: true });
