// The schema validators for the messages `board-host` sends to the board page (AD-7), push
// delivery's origin and agent messages included (design decision 12). Here they are compiled from
// the contract's schemas with Ajv, which tests can run. The board page cannot compile under its CSP
// (no `eval`), so the view build replaces this whole module with Ajv's standalone code for the same
// schemas (design decision 7, `tools/build/validators.ts`): keep its one export,
// `hostMessageSchemas`, and add nothing else here.

import { BOARD_PROTOCOL_MESSAGES, PUSH_HOST_MESSAGES, PUSH_SCHEMAS } from "@askboard/contract";
import { createAjv } from "@askboard/contract/validate";
import type { ErrorObject } from "ajv";

/** A compiled schema: true when the value is valid, with Ajv's errors otherwise. */
export type SchemaCheck = {
  (value: unknown): boolean;
  errors?: readonly ErrorObject[] | null;
};

export type HostMessageType =
  | keyof typeof BOARD_PROTOCOL_MESSAGES.toPage
  | keyof typeof PUSH_HOST_MESSAGES;

const ajv = createAjv();
// Push delivery's schemas are standalone (design decision 1): in no set `createAjv` holds.
for (const schema of PUSH_SCHEMAS) ajv.addSchema(schema);

const compiled = (id: string): SchemaCheck => {
  const check = ajv.getSchema(id);
  if (check === undefined) throw new Error(`the contract has no schema ${id}`);
  return check;
};

/**
 * One validator per message type `board-host` sends, keyed by its name in the contract's list with
 * push delivery's host messages beside it (design decision 12), so a message either list gains needs
 * no edit here. Readers look a type up as an own property.
 */
export const hostMessageSchemas = Object.fromEntries(
  Object.entries({ ...BOARD_PROTOCOL_MESSAGES.toPage, ...PUSH_HOST_MESSAGES }).map(([type, id]) => [
    type,
    compiled(id),
  ]),
) as Readonly<Record<HostMessageType, SchemaCheck>>;
