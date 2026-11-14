// json-render 0.21.3 as documented: zod's `new Function` feature probe runs when json-render's
// schemas are built, and the view CSP blocks it (a caught probe, design decision 2).

import { registerRenderer } from "../port/index.ts";
import { JsonRenderRenderer } from "./_json-render-adapter.tsx";

registerRenderer("json-render", JsonRenderRenderer);
