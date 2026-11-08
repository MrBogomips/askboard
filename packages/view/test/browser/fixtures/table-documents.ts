// Test-only board documents holding a Table (table-widget, group 6): the fixture Table of roles
// (`costs`) or another Table in the fixture Tree's question `plan`, as the agent sends it, for the
// widget host; the Tables the scenarios name; and the host's mirror read for the Table's value and
// cell entries. The board page and the session process take the Table only after its registration.

import type { Locale, TableColumn, TableProps, TableRow } from "@askboard/contract";
import { TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { WidgetHostRun } from "../harness/widget-host-test.ts";
import { atomDocument } from "./atom-documents.ts";

export const TABLE_ID = "costs";

/** The Table of roles, whose rows are `pm` (18 days at 1,040) and `dev` (72 days at 720). */
export const ROLES: TableProps = TABLE_FIXTURE_ITEM.props;

/** The item `costs` with `props`. */
export const tableItem = (props: TableProps = ROLES, id: string = TABLE_ID) => ({
  type: "table" as const,
  id,
  props,
});

/** The question `plan` holding `props` as the Table `costs`, in `language` (en-US by default). */
export const tableDocument = (props: TableProps = ROLES, language?: Locale): ViewDocument =>
  atomDocument([tableItem(props)], language);

/** The Table of roles with `rows` or `columns` replaced. */
export const rolesWith = (
  changes: { rows?: readonly TableRow[]; columns?: readonly TableColumn[] } & Partial<TableProps>,
): TableProps => ({ ...ROLES, ...changes }) as TableProps;

/** The Table of roles with its `amount` formula replaced. */
export const withFormula = (formula: string): TableProps =>
  rolesWith({
    columns: ROLES.columns.map((column) =>
      column.field === "amount" ? { ...column, formula } : column,
    ),
  });

/** A word of `length` characters without a space. */
export const longWord = (length = 200, letter = "w"): string => letter.repeat(length);

type Mirrored = {
  readonly record: {
    readonly questions: Record<
      string,
      {
        readonly values?: Record<string, TableProps>;
        readonly cellEntries?: Record<string, Record<string, string>>;
      }
    >;
  };
};

const lastRecord = (run: WidgetHostRun) =>
  (run.drafts.at(-1) as unknown as Mirrored | undefined)?.record.questions.plan;

/** The value the latest draft mirror holds for the Table; undefined when it holds none. */
export const draftTable = (run: WidgetHostRun, id = TABLE_ID): TableProps | undefined =>
  lastRecord(run)?.values?.[id];

/** The cell entries the latest draft mirror holds for the Table; undefined when it holds none. */
export const draftCellEntries = (
  run: WidgetHostRun,
  id = TABLE_ID,
): Record<string, string> | undefined => lastRecord(run)?.cellEntries?.[id];

/** One cell of a row of the Table's draft value. */
export const draftCell = (run: WidgetHostRun, rowId: string, field: string): unknown =>
  draftTable(run)?.rows.find((row) => row.id === rowId)?.[field];
