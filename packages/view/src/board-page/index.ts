// The board page's entry, bundled into `board-page.js` (design decisions 7 and 8). zod's
// `jitless` comes first, before ext-apps loads (renderer rows 16 and 17).

import "../zod-jitless.ts";
import { startBoardPage } from "./start.ts";

startBoardPage(window);
