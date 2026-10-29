// json-render 0.21.3 with one named configuration change: zod set to `jitless` first.

import "./_zod-jitless.ts";
import { registerRenderer } from "../port/index.ts";
import { JsonRenderRenderer } from "./_json-render-adapter.tsx";

registerRenderer("json-render-jitless", JsonRenderRenderer);
