// A field's text, capped in code points (atoms, design decision 7). The browser's `maxLength`
// counts UTF-16 units, so a field takes no such attribute: its input handler cuts the text here.

/** The first `max` code points of the text, never half of an astral character. */
export const cutCodePoints = (text: string, max: number): string => {
  const points = Array.from(text);
  return points.length <= max ? text : points.slice(0, max).join("");
};

/**
 * The handler of a field's typed text: the text cut at `max` code points goes to `put`, an empty
 * one as `undefined`, so that an empty field holds no result (AD-10).
 */
export const textChange =
  (max: number, put: (result: string | undefined) => void) =>
  (typed: string): void => {
    const kept = cutCodePoints(typed, max);
    put(kept === "" ? undefined : kept);
  };

/** An input's change handler, which reads the typed text off the event's target. */
export const typed =
  (change: (text: string) => void) =>
  (event: { readonly target: { readonly value: string } }): void =>
    change(event.target.value);

/** A handler that calls `put` with `value`, whatever it is given: "Clear" puts none. */
export const putting =
  <Value>(put: (value: Value) => void, value: Value) =>
  (): void =>
    put(value);
