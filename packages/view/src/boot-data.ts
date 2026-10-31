// The `askboard-data` block of the view's srcdoc: what the view boots from (AD-9, design decision
// 8). `assemble` writes it with `<` escaped; the board page built it from messages it validated.

import type { BoardState } from "@askboard/contract";
import type { ViewDocument } from "./view-document.ts";

/** The id of the `<script type="application/json">` element that holds the block. */
export const BOOT_DATA_ID = "askboard-data";

export type BootData = {
  /** The board document, whose question may hold widget items as the view document allows. */
  readonly document: ViewDocument;
  readonly state: BoardState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The block's data, from the element's text; throws when the block is missing or malformed. */
export const parseBootData = (text: string | null | undefined): BootData => {
  if (text === null || text === undefined || text === "") {
    throw new Error(`the view has no ${BOOT_DATA_ID} block to boot from`);
  }
  const data: unknown = JSON.parse(text);
  if (!isRecord(data) || !isRecord(data.document)) {
    throw new Error(`the ${BOOT_DATA_ID} block holds no board document`);
  }
  if (!isRecord(data.state)) throw new Error(`the ${BOOT_DATA_ID} block holds no state`);
  return data as BootData;
};
