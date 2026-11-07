// The Scale's slider (view-and-widgets spec: Scale as a slider; design decision 8): Radix's Slider,
// controlled, once a value is set. Radix sets none where it is unset, so while nothing is set
// AskBoard's wrapper stands in for it: a focusable `slider` with the text "Not set", which takes
// the first pointer down on the track, at that point's value, and the first key, Home and the
// arrows for `min` and End for `max`; once set, Radix's thumbs and keys apply. A range starts
// with both thumbs at the first value. Each change goes up as thumb values, snapped by the caller.

import type { ScaleProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { Slider } from "radix-ui";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react";
import { trackFraction } from "./change.ts";
import { RANGE, ROOT, THUMB, TRACK, UNSET } from "./classes.ts";
import { firstValue, valueAt } from "./model.ts";

/**
 * Focuses the first thumb of a Radix root once Radix shows it. Radix renders a thumb with
 * `display: none` until it has registered the thumb among its items, which happens after the
 * render that sets the first value, so a focus at that render finds nothing to focus. Returns what
 * stops the wait.
 */
const focusWhenShown = (root: HTMLElement): (() => void) => {
  const thumb = root.querySelector<HTMLElement>('[role="slider"]');
  if (thumb === null) return () => {};
  const shown = () => thumb.style.display !== "none";
  if (shown()) {
    thumb.focus();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (!shown()) return;
    observer.disconnect();
    thumb.focus();
  });
  observer.observe(thumb, { attributes: true, attributeFilter: ["style"] });
  return () => observer.disconnect();
};

const Unset = ({
  props,
  labelledBy,
  disabled,
  onFirst,
}: {
  readonly props: ScaleProps;
  readonly labelledBy: string;
  readonly disabled: boolean;
  readonly onFirst: (value: number) => void;
}) => {
  const text = useStrings();
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    const box = event.currentTarget.getBoundingClientRect();
    onFirst(valueAt(props, trackFraction(event.clientX, box.left, box.width)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const value = disabled ? undefined : firstValue(props, event.key);
    if (value === undefined) return;
    event.preventDefault();
    onFirst(value);
  };
  return (
    <div
      // biome-ignore lint/a11y/useAriaPropsForRole: an unset slider has no valuenow, by design
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-orientation="horizontal"
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      aria-valuetext={text("scale.notSet")}
      aria-labelledby={labelledBy}
      aria-disabled={disabled ? true : undefined}
      className={UNSET}
      data-scale-unset=""
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className={TRACK} />
    </div>
  );
};

export const ScaleSlider = ({
  props,
  values,
  labelledBy,
  disabled,
  onFirst,
  onValues,
}: {
  readonly props: ScaleProps;
  /** The thumbs' values, or none while unset. */
  readonly values: readonly number[] | undefined;
  /** The ID of the question's text, which names the slider. */
  readonly labelledBy: string;
  readonly disabled: boolean;
  /** The first value of an unset slider, from the pointer or the keyboard. */
  readonly onFirst: (value: number) => void;
  /** The thumbs' values after a change of a set slider. */
  readonly onValues: (values: readonly number[]) => void;
}) => {
  const text = useStrings();
  const root = useRef<HTMLSpanElement>(null);
  // The wrapper that took the first key or press is gone once a value is set: the first thumb
  // takes the focus, so that the keyboard goes on with Radix's keys.
  const refocus = useRef(false);
  const set = values !== undefined;
  useEffect(() => {
    if (!set || !refocus.current || root.current === null) return;
    refocus.current = false;
    return focusWhenShown(root.current);
  }, [set]);
  if (values === undefined) {
    return (
      <Unset
        props={props}
        labelledBy={labelledBy}
        disabled={disabled}
        onFirst={(value) => {
          refocus.current = true;
          onFirst(value);
        }}
      />
    );
  }
  const labels = props.range === true ? [text("scale.low"), text("scale.high")] : [];
  return (
    <Slider.Root
      ref={root}
      className={ROOT}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      value={[...values]}
      disabled={disabled}
      onValueChange={onValues}
    >
      <Slider.Track className={TRACK}>
        <Slider.Range className={RANGE} />
      </Slider.Track>
      {values.map((_, at) => (
        <Slider.Thumb
          // biome-ignore lint/suspicious/noArrayIndexKey: a thumb is its place among one or two
          key={at}
          className={THUMB}
          data-grab=""
          {...(props.range === true
            ? { "aria-label": labels[at] }
            : { "aria-labelledby": labelledBy })}
        />
      ))}
    </Slider.Root>
  );
};
