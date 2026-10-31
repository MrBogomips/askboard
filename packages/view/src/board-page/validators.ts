// The schema validators for the messages `board-host` sends to the board page (AD-7). Here they
// are compiled from the contract's schemas with Ajv, which tests can run. The board page cannot
// compile under its CSP (no `eval`), so the view build replaces this whole module with Ajv's
// standalone code for the same schemas (design decision 7, `tools/build/validators.ts`): keep its
// one export, `hostMessageSchemas`, and add nothing else here.

import { BOARD_PROTOCOL_MESSAGES } from "@askboard/contract";
import { createAjv } from "@askboard/contract/validate";
import type { ErrorObject } from "ajv";

/** A compiled schema: true when the value is valid, with Ajv's errors otherwise. */
export type SchemaCheck = {
  (value: unknown): boolean;
  errors?: readonly ErrorObject[] | null;
};

export type HostMessageType = keyof typeof BOARD_PROTOCOL_MESSAGES.toPage;

const ajv = createAjv();

const compiled = (id: string): SchemaCheck => {
  const check = ajv.getSchema(id);
  if (check === undefined) throw new Error(`the contract has no schema ${id}`);
  return check;
};

const { board, state, receipt, discarded, moved, refused } = BOARD_PROTOCOL_MESSAGES.toPage;

/** One validator per message type `board-host` sends. */
export const hostMessageSchemas: Readonly<Record<HostMessageType, SchemaCheck>> = {
  board: compiled(board),
  state: compiled(state),
  receipt: compiled(receipt),
  discarded: compiled(discarded),
  moved: compiled(moved),
  refused: compiled(refused),
};
