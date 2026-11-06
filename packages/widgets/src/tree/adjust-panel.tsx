// The "Adjust by %…" panel (spec, "Tree bulk percentage adjustment panel", "The adjustment
// percentage", "Tree bulk adjustment preview"): a check box per number column, a percentage field
// with no echo, a preview drawn from `planAdjustment`, "Apply" and "Cancel". "Apply" applies exactly
// the plan the preview showed, and stays disabled while the percentage is refused, no column is
// checked, nothing would change or a row would break the estimates' order or range. Enter in the
// field submits; Escape and "Cancel" close the panel (the Popover around it closes it).

import { TREE_PERT_MAX_ESTIMATE, type TreeProps } from "@askboard/contract";
import { type Say, useLanguage, useLocale, useStrings } from "@askboard/view/catalog";
import { type FormEvent, useId, useState } from "react";
import { formatNumber } from "../shared/number.ts";
import {
  EDITOR,
  FIELD_ERROR,
  PANEL,
  PANEL_ACTIONS,
  PANEL_GROUP,
  PANEL_LABEL,
  PANEL_PREVIEW,
  TOOL,
} from "./classes.ts";
import {
  type AdjustedValue,
  type AdjustmentPlan,
  adjustableColumns,
  type PercentEntry,
  parsePercent,
  planAdjustment,
} from "./model/adjust.ts";
import type { Selection } from "./model/selection.ts";

/** An adjustment the panel applied: its plan, and the percentage as the announcement reads it. */
export type Applied = { readonly plan: AdjustmentPlan; readonly percent: string };

const FIRST_SHOWN = 3;

/** A percentage in tenths as the ask's locale writes it, signed: `+10%`, `-20%`, `+1.5%`. */
export const percentLabel = (
  tenths: number,
  locale: Parameters<typeof formatNumber>[1],
): string => {
  const sign = tenths > 0 ? "+" : tenths < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(tenths) / 10, locale)}%`;
};

const Preview = ({
  plan,
  locale,
  text,
}: {
  readonly plan: AdjustmentPlan;
  readonly locale: Parameters<typeof formatNumber>[1];
  readonly text: Say;
}) => {
  if (plan.kind === "refused") {
    const rows = plan.problems
      .slice(0, FIRST_SHOWN)
      .map((one) => text("tree.adjust.refusedRow", { name: one.label, column: one.column }))
      .join("; ");
    return (
      <p className={FIELD_ERROR}>
        {text("tree.adjust.refused", {
          count: plan.problems.length,
          max: TREE_PERT_MAX_ESTIMATE.toLocaleString(locale),
          rows,
        })}
      </p>
    );
  }
  const example = (one: AdjustedValue): string =>
    text("tree.adjust.example", {
      name: one.label,
      column: one.column,
      from: formatNumber(one.from, locale),
      to: formatNumber(one.to, locale),
    });
  return (
    <div className={PANEL_PREVIEW}>
      <p>{text("tree.adjust.changes", { count: plan.changes.length })}</p>
      {plan.skipped > 0 ? <p>{text("tree.adjust.skipped", { count: plan.skipped })}</p> : null}
      {plan.changes.slice(0, FIRST_SHOWN).map((one) => (
        <p key={`${one.nodeId}.${one.field}`} className="truncate">
          {example(one)}
        </p>
      ))}
    </div>
  );
};

// The refusal the field shows: the percentage's, or that no column is checked.
const problemOf = (entry: PercentEntry, checked: number, text: Say): string | undefined => {
  if (entry.kind === "refused") return entry.reason;
  return checked === 0 ? text("tree.adjust.noColumn") : undefined;
};

export const AdjustPanel = ({
  value,
  selection,
  onApply,
  onCancel,
}: {
  readonly value: TreeProps;
  readonly selection: Selection;
  readonly onApply: (applied: Applied) => void;
  readonly onCancel: () => void;
}) => {
  const text = useStrings();
  const locale = useLocale();
  const language = useLanguage();
  const ids = useId();
  const columns = adjustableColumns(value);
  const [checked, setChecked] = useState<readonly string[]>(() => columns.map((one) => one.field));
  const [typed, setTyped] = useState("");
  const entry = parsePercent(typed, locale, language);
  const plan =
    entry.kind === "percent" && checked.length > 0
      ? planAdjustment(value, selection, checked, entry.tenths)
      : undefined;
  const problem = problemOf(entry, checked.length, text);
  const canApply = plan?.kind === "ready" && plan.changes.length > 0;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (canApply && entry.kind === "percent") {
      onApply({ plan, percent: percentLabel(entry.tenths, locale) });
    }
  };
  const flip = (field: string): void =>
    setChecked((now) =>
      now.includes(field) ? now.filter((one) => one !== field) : [...now, field],
    );

  return (
    <form className={PANEL} onSubmit={submit} aria-label={text("tree.adjust.title")}>
      <fieldset className={PANEL_GROUP}>
        <legend>{text("tree.adjust.columns")}</legend>
        {columns.map((column) => (
          <label key={column.field} className={PANEL_LABEL}>
            <input
              type="checkbox"
              data-interactive=""
              checked={checked.includes(column.field)}
              onChange={() => flip(column.field)}
            />
            {column.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        {text("tree.adjust.percent")}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className={EDITOR}
          value={typed}
          aria-invalid={entry.kind === "refused" ? true : undefined}
          aria-describedby={problem === undefined ? undefined : `${ids}-problem`}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      {problem === undefined ? null : (
        <p id={`${ids}-problem`} className={FIELD_ERROR}>
          {problem}
        </p>
      )}
      {plan === undefined ? null : <Preview plan={plan} locale={locale} text={text} />}
      <div className={PANEL_ACTIONS}>
        <button type="button" className={TOOL} onClick={onCancel}>
          {text("tree.adjust.cancel")}
        </button>
        <button type="submit" className={TOOL} disabled={!canApply}>
          {text("tree.adjust.apply")}
        </button>
      </div>
    </form>
  );
};
