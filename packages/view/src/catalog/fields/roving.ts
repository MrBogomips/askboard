// The keys and attributes of a radio group whose radios are checked by an act, never by moving
// the focus (choice-documented-activation, design decision 3; EXPERIENCE.md, Option and Keyboard
// core; WAI-ARIA's radio group contained in a toolbar). It rests on HTML buttons, ARIA roles and
// the focus alone: a button's own activation (Space, Enter, a click) checks, and the arrow keys,
// Home and End only call `focus`, and only with no modifier held. Plain ECMAScript, apart from React.

import { pressHold } from "@askboard/contract";

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

/**
 * The radio Tab enters on among `count`: the checked one, else the first, none for an empty group.
 * A `checked` that is no radio of the group (the filter hides it) leaves the first.
 */
export const radioTabStop = (checked: number | undefined, count: number): number | undefined => {
  if (count === 0) return undefined;
  return checked !== undefined && checked >= 0 && checked < count ? checked : 0;
};

/** What a radio group is: how many radios, which one is checked, and what its acts call. */
export type RadioGroupState = {
  readonly count: number;
  /** The checked radio's index, none when nothing is checked or the checked one is not shown. */
  readonly checked: number | undefined;
  readonly disabled: boolean;
  /** An unchecked radio was activated. */
  readonly onCheck: (index: number) => void;
  /** The arrow keys, Home or End moved the focus to this radio. */
  readonly focus: (index: number) => void;
};

/** The part of a key event the radios read: the key, the modifiers held, and its default. */
export type RadioKey = {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  preventDefault(): void;
};

/**
 * The box an options' key moves the focus to: the arrows, Home and End with no modifier held, and
 * nothing for the same keys with Alt, Shift, Ctrl or Cmd, which stay the browser's, such as Alt with
 * an arrow for history (keyboard-shortcuts-help, design decision 7; spec: Keys left to the browser).
 */
export const optionMoveOf = (event: RadioKey, index: number, count: number): number | undefined =>
  pressHold(event) === "none" ? nextFocus(event.key, index, count) : undefined;

/** What a key does to the multiple choice's box at `index`: flip it (Enter), or move the focus. */
export type CheckboxKey =
  | { readonly kind: "flip" }
  | { readonly kind: "focus"; readonly index: number };

/** The multiple choice's reading of a key on a box: Enter flips it, the options' keys move the focus. */
export const checkboxKeyOf = (
  event: RadioKey,
  index: number,
  count: number,
): CheckboxKey | undefined => {
  if (event.key === "Enter") return { kind: "flip" };
  const next = optionMoveOf(event, index, count);
  return next === undefined ? undefined : { kind: "focus", index: next };
};

/** The attributes and handlers that make a `button` the radio at `index` of `group`. */
export const radioAt = (index: number, group: RadioGroupState) => {
  const checked = index === group.checked;
  return {
    type: "button" as const,
    role: "radio" as const,
    "aria-checked": checked,
    "data-state": checked ? ("checked" as const) : ("unchecked" as const),
    "data-disabled": group.disabled ? "" : undefined,
    disabled: group.disabled,
    tabIndex: !group.disabled && radioTabStop(group.checked, group.count) === index ? 0 : -1,
    onKeyDown: (event: RadioKey) => {
      const next = optionMoveOf(event, index, group.count);
      if (next === undefined) return;
      event.preventDefault();
      group.focus(next);
    },
    onClick: () => {
      if (!checked) group.onCheck(index);
    },
  };
};
