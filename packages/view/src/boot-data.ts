// The `askboard-data` block of the view's srcdoc: what the view boots from (AD-9, design decision
// 8). `assemble` writes it with `<` escaped; the board page built it from messages it validated.
// Beside the board document and the state it holds the fields of a view update that
// `UPDATE_FIELDS` marks `atBoot`, when the board page had them as the view loaded: who asked and
// where and the agent status (push delivery, design decision 12). A later field joins them with
// its entry in that table alone (review M4).

import type { LifecycleBoardState } from "@askboard/contract";
import type { ViewDocument } from "./view-document.ts";
import { UPDATE_FIELDS, type UpdateField, type ViewUpdate } from "./view-protocol.ts";

/** The id of the `<script type="application/json">` element that holds the block. */
export const BOOT_DATA_ID = "askboard-data";

/** The optional fields of a view update the view also boots from: those marked `atBoot`. */
export type BootField = {
  [K in UpdateField]: (typeof UPDATE_FIELDS)[K] extends { readonly atBoot: true } ? K : never;
}[UpdateField];

const BOOT_FIELDS: readonly BootField[] = (Object.keys(UPDATE_FIELDS) as UpdateField[]).filter(
  (field): field is BootField => "atBoot" in UPDATE_FIELDS[field],
);

export type BootData = {
  /** The board document, whose question may hold widget items as the view document allows. */
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
} & Pick<ViewUpdate, BootField>;

/** The fields the view boots from that a record holds, and none of its others. */
export const bootFieldsOf = (fields: Pick<ViewUpdate, BootField>): Pick<ViewUpdate, BootField> =>
  Object.fromEntries(
    BOOT_FIELDS.flatMap((field) => (fields[field] === undefined ? [] : [[field, fields[field]]])),
  );

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
  // The fields the view boots from, each only in a shape it can show; the others pass through.
  const unshowable = new Set<string>(
    BOOT_FIELDS.filter((field) => !UPDATE_FIELDS[field].check(data[field])),
  );
  return Object.fromEntries(
    Object.entries(data).filter(([field]) => !unshowable.has(field)),
  ) as BootData;
};
