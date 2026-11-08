// The PickField's selection logic apart from React (form-widget, design decision 4; view-and-widgets
// spec: The PickField, The PickField's filter): the options a filter shows, when it shows, and the
// list of option IDs a toggle gives. The filter is view state: it hides options and never changes
// what is picked, so a hidden pick stays picked and the filter's text is never in the draft. Option
// IDs are agent text, held in sets and compared, never used as keys of a plain object. Plain
// ECMAScript.

import { PICK_FILTER_OVER, type PickOption } from "@askboard/contract";

/**
 * The options whose label holds `filter` as text, ignoring case (both lowercased with
 * `toLowerCase`), in their order; every option for an empty filter. The text is no pattern.
 */
export const filteredOptions = (
  options: readonly PickOption[],
  filter: string,
): readonly PickOption[] => {
  if (filter === "") return options;
  const wanted = filter.toLowerCase();
  return options.filter(({ label }) => label.toLowerCase().includes(wanted));
};

/** Whether the filter shows: above `PICK_FILTER_OVER` options, and never on a read-only field. */
export const showsFilter = (optionCount: number, readOnly: boolean): boolean =>
  !readOnly && optionCount > PICK_FILTER_OVER;

/** Gives focus to the first radio under `root`, if there is one: where "Clear" leaves it. */
export const focusFirstRadio = (root: ParentNode | null): void => {
  root?.querySelector<HTMLElement>('[role="radio"]')?.focus();
};

/**
 * What "Clear" does: it puts no result, and, since the button leaves with the pick, hands focus to
 * the group's first radio once the draft has updated, so that it is not lost to the page.
 */
export const clearing = (put: (result: undefined) => void, focus: () => void) => (): void => {
  put(undefined);
  queueMicrotask(focus);
};

/**
 * The handler of a checkbox's `onCheckedChange` for the option `id`: the toggled list goes to `put`
 * (only a boolean `true` checks; Radix's "indeterminate" is no state of this field).
 */
export const toggling =
  (
    options: readonly PickOption[],
    picked: readonly string[] | undefined,
    id: string,
    put: (result: readonly string[] | undefined) => void,
  ) =>
  (next: boolean | "indeterminate"): void =>
    put(toggledIds(options, picked, id, next === true));

/**
 * The result of a multiple pick after `id` is picked or unpicked: the IDs picked, in the options'
 * order, each once, none that is no option's; no list at all, `undefined`, when none is left. A pick
 * the filter hides is among `picked` and stays.
 */
export const toggledIds = (
  options: readonly PickOption[],
  picked: readonly string[] | undefined,
  id: string,
  checked: boolean,
): readonly string[] | undefined => {
  const chosen = new Set(picked);
  if (checked) chosen.add(id);
  else chosen.delete(id);
  const next = options.map((option) => option.id).filter((each) => chosen.has(each));
  return next.length === 0 ? undefined : next;
};
