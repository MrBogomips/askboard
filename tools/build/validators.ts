// The board page's standalone validators (AD-7, design decision 7). The board page cannot compile
// a schema under its CSP, so the build generates Ajv's standalone code for each message
// `board-host` sends, push delivery's origin and agent messages included (design decision 12), with
// the contract's own Ajv instance, and bundles it in place of the view's `board-page/validators.ts`,
// which compiles the same schemas for tests. The code needs only Ajv's `ucs2length` helper at run
// time and holds no `eval` or `new Function`.

import { BOARD_PROTOCOL_MESSAGES, PUSH_HOST_MESSAGES, PUSH_SCHEMAS } from "@askboard/contract";
import { createAjv } from "@askboard/contract/validate";
import standaloneCode from "ajv/dist/standalone";
import type { BunPlugin } from "bun";
import { VALIDATORS_FILE } from "./paths.ts";

/** The one module the generated code requires, resolved from the board page's folder. */
export const HOST_VALIDATORS_RUNTIME = "ajv/dist/runtime/ucs2length";

/**
 * ESM exporting `hostMessageSchemas`, one validator per message type, as the view's module does.
 * Ajv exports each validator under a name that must be an identifier, which a message name such as
 * `snapshot-saved` is not, so each is exported by its place in the list and keyed in
 * `hostMessageSchemas` by its quoted message name. `messages` is the contract's list, with push delivery's host messages, by default.
 */
export const hostValidatorsCode = (
  messages: Readonly<Record<string, string>> = {
    ...BOARD_PROTOCOL_MESSAGES.toPage,
    ...PUSH_HOST_MESSAGES,
  },
): string => {
  const ajv = createAjv({ code: { source: true, esm: true } });
  // Push delivery's schemas are standalone (design decision 1): in no set `createAjv` holds.
  for (const schema of PUSH_SCHEMAS) ajv.addSchema(schema);
  const entries = Object.entries(messages);
  const exportName = (index: number) => `hostMessage${index}`;
  const exports = Object.fromEntries(entries.map(([, id], index) => [exportName(index), id]));
  const keyed = entries.map(([type], index) => `${JSON.stringify(type)}: ${exportName(index)}`);
  const lookup = `export const hostMessageSchemas = { ${keyed.join(", ")} };`;
  return `${standaloneCode(ajv, exports)}\n${lookup}\n`;
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
