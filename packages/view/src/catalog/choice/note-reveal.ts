/**
 * How "+ Add your note to this option" shows (F-52, review F-27): always on a selected option, on
 * any other under hover or keyboard focus. It is hidden by `visibility`, not removed, so its line
 * stays reserved and the options below it do not move when it appears.
 */
export const noteReveal = (selected: boolean): string =>
  selected ? "visible" : "invisible group-hover/option:visible group-focus-within/option:visible";
