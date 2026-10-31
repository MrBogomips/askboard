// Choice's selection logic (EXPERIENCE.md, Option and Keyboard core), apart from React: values
// are new arrays of option labels in the options' order, the arrow keys move focus through the
// boxes of a multiple choice as Radix's roving focus does through the radios of a single one, and
// option element IDs use `:`, which no item ID holds (ID_PATTERN), so two items never share one.

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

const STEPS: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/** The box a key moves focus to among `count`, wrapping; undefined for any other key. */
export const nextFocus = (key: string, index: number, count: number): number | undefined => {
  if (count === 0) return undefined;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const step = Object.hasOwn(STEPS, key) ? STEPS[key] : undefined;
  return step === undefined ? undefined : (index + step + count) % count;
};

export const optionLabelId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:label`;

export const optionDescriptionId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:description`;
