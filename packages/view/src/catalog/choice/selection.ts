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

export const optionLabelId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:label`;

export const optionDescriptionId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:description`;

/** The ID of the "Other…" row's label, which names its radio or box. */
export const otherLabelId = (itemId: string): string => `${itemId}:other:label`;
