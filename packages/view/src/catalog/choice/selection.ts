// Choice's selection logic (EXPERIENCE.md, Option and Keyboard core), apart from React: values
// are new arrays of option labels in the options' order, and option element IDs use `:`, which no
// item ID holds (ID_PATTERN), so two items never share one.

import type { ChoiceOption } from "@askboard/contract";

/** The value with `label` checked or unchecked, in the options' order; an unset value is none. */
export const toggled = (
  options: readonly ChoiceOption[],
  value: readonly string[] | undefined,
  label: string,
  checked: boolean,
): string[] => {
  const chosen = new Set(value);
  if (checked) chosen.add(label);
  else chosen.delete(label);
  return options.map((option) => option.label).filter((each) => chosen.has(each));
};

/** What a single Choice's check puts where: the options, the "Other…" text and the setters. */
export type SingleChoosing = {
  readonly options: readonly ChoiceOption[];
  /** The "Other…" row's text; undefined while "Other…" is not chosen. */
  readonly other: string | undefined;
  readonly onValueChange: (value: readonly string[] | undefined) => void;
  /** Absent where the question offers no "Other…", which then no row can check. */
  readonly onOtherChange?: (other: string | undefined) => void;
};

/**
 * What checking the radio at `index` does in a single Choice: an option, by its place in the
 * options, becomes the whole value and clears the "Other…" text; "Other…", the row after the
 * options, clears the value and keeps its text, empty at first (FR-3). A row that is neither
 * changes nothing. Rows are told apart by position, never by an agent label.
 */
export const choosingSingle =
  ({ options, other, onValueChange, onOtherChange }: SingleChoosing) =>
  (index: number): void => {
    if (index === options.length) {
      onValueChange(undefined);
      onOtherChange?.(other ?? "");
      return;
    }
    const label = options[index]?.label;
    if (label === undefined) return;
    onValueChange([label]);
    if (other !== undefined) onOtherChange?.(undefined);
  };

/**
 * The handler of the "Show preview" press of option `index`, given the option whose preview is open:
 * it opens that one in place of the open one, or closes it if it is the open one.
 */
export const previewToggling =
  (open: number | undefined, set: (next: number | undefined) => void) =>
  (index: number) =>
  (): void =>
    set(open === index ? undefined : index);

export const optionLabelId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:label`;

export const optionDescriptionId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:description`;

/** The ID of the "Other…" row's label, which names its radio or box. */
export const otherLabelId = (itemId: string): string => `${itemId}:other:label`;
