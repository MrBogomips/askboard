// zod's `jitless` setting, applied before json-render builds its schemas: zod then skips its
// `new Function` feature probe. Imported first, so it is evaluated first.

import { config } from "zod";

config({ jitless: true });
