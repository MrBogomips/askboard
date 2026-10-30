// The board page's standalone validators (AD-7, design decision 7). The board page cannot compile
// a schema under its CSP, so the build generates Ajv's standalone code for each message
// `board-host` sends, with the contract's own Ajv instance, and bundles it in place of the view's
// `board-page/validators.ts`, which compiles the same schemas for tests. The code needs only Ajv's
// `ucs2length` helper at run time and holds no `eval` or `new Function`.

import { BOARD_PROTOCOL_MESSAGES } from "@askboard/contract";
import { createAjv } from "@askboard/contract/validate";
import standaloneCode from "ajv/dist/standalone";
import type { BunPlugin } from "bun";
import { VALIDATORS_FILE } from "./paths.ts";

/** The one module the generated code requires, resolved from the board page's folder. */
export const HOST_VALIDATORS_RUNTIME = "ajv/dist/runtime/ucs2length";

/** ESM exporting one validator per message type and `hostMessageSchemas`, as the view's module does. */
export const hostValidatorsCode = (): string => {
  const schemas = BOARD_PROTOCOL_MESSAGES.toPage;
  const ajv = createAjv({ code: { source: true, esm: true } });
  const types = Object.keys(schemas).join(", ");
  return `${standaloneCode(ajv, schemas)}\nexport const hostMessageSchemas = { ${types} };\n`;
};

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Loads the generated code in place of the view's validators module, and only that module. */
export const validatorsPlugin = (code: string): BunPlugin => ({
  name: "askboard-board-page-validators",
  setup(build) {
    build.onLoad({ filter: new RegExp(`^${escaped(VALIDATORS_FILE)}$`) }, () => ({
      contents: code,
      loader: "js",
    }));
  },
});
