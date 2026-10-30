// Negative control (task 4.2): IronCalc's default async loader, `init()` with no bytes. It
// resolves `wasm_bg.wasm` against the module URL and fetches it, which the view's
// `connect-src 'none'` must block. build.ts replaces `import.meta.url`, which a classic
// script cannot hold, with the document's base URL, the URL an inline module would resolve against.

import "./mark.ts";
import init from "@ironcalc/wasm";
import { view } from "./api.ts";

const v = view();
init()
  .then(() => v.post("result", { mode: "async-loader", loaded: true }))
  .catch((e: unknown) =>
    v.post("result", { mode: "async-loader", loaded: false, message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }),
  )
  .finally(() => v.done());
