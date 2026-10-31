// zod's `jitless`, set before any module that uses zod loads (renderer rows 16 and 17). Without it
// zod probes `new Function` once, which the board page's and the view's CSP block, and CI counts
// even a caught probe as a violation. The board page and the ext-apps library chunk, the two
// scripts that bundle zod, import this module first.

import { config } from "zod";

config({ jitless: true });
