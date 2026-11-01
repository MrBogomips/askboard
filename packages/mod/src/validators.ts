// The checks on what the mod reads (AD-7, design decision 7): the session file, the poll and the
// local API's acknowledgements. Here they run the contract's validators, which tests can call. The
// mod compiles nothing at run time, so the mod build replaces this whole module with Ajv's
// standalone code for the same schemas (`tools/build/mod.ts`): keep its one export, `checks`, with
// these three members, and add nothing else here.

import { validateLocalApi, validateSessionFile } from "@askboard/contract/validate";

/** True when the value is valid against its schema, its version's major included. */
export type Check = (value: unknown) => boolean;

export const checks: {
  readonly sessionFile: Check;
  readonly poll: Check;
  readonly ack: Check;
} = {
  sessionFile: (value) => validateSessionFile(value).ok,
  poll: (value) => validateLocalApi("pollResponse", value).ok,
  ack: (value) => validateLocalApi("modHelloResponse", value).ok,
};
