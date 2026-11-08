// A radio group's React side (choice-documented-activation, design decision 3): the refs of its
// buttons, so that the arrow keys can hand the focus on, and each radio's props from `radioAt`.
// The component draws the group's own element and the radios' content; nothing here checks a radio
// but an activation of its button.

import { useRef } from "react";
import { type RadioGroupState, radioAt } from "./roving.ts";

export type RadiosState = Omit<RadioGroupState, "focus">;

/** `radio(index)`: the props of the radio at `index`, with the ref that lets focus reach it. */
export const useRadios = (state: RadiosState) => {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const group: RadioGroupState = {
    ...state,
    focus: (index) => buttons.current[index]?.focus(),
  };
  return (index: number) => ({
    ...radioAt(index, group),
    ref: (button: HTMLButtonElement | null) => {
      buttons.current[index] = button;
    },
  });
};
