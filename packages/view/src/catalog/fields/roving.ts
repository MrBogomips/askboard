// The keys and attributes of a radio group whose radios are checked by an act, never by moving
// the focus (choice-documented-activation, design decision 3; EXPERIENCE.md, Option and Keyboard
// core; WAI-ARIA's radio group contained in a toolbar). It rests on HTML buttons, ARIA roles and
// the focus alone: a button's own activation (Space, Enter, a click) checks, and the arrow keys,
// Home and End only call `focus`. Plain ECMAScript, apart from React.

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

/** The part of a key event the radios read. */
export type RadioKey = { readonly key: string; preventDefault(): void };

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
      const next = nextFocus(event.key, index, group.count);
      if (next === undefined) return;
      event.preventDefault();
      group.focus(next);
    },
    onClick: () => {
      if (!checked) group.onCheck(index);
    },
  };
};
