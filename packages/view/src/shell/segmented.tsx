// A segmented control (DESIGN.md, Quick toggles; settings-languages, design decision 10): a WAI-ARIA
// radio group whose segments take one tab stop, the selected one, and move with the arrow keys,
// Home and End, which select as they move. A read-only control is disabled, with a description that
// says why, which a screen reader reads with the group.

import { type KeyboardEvent, useId, useRef } from "react";
import { SEGMENT, SEGMENTS } from "./segment-classes.ts";
import { segmentAfterKey } from "./segment-keys.ts";

export type Segment<T extends string> = { readonly value: T; readonly label: string };

export const Segmented = <T extends string>({
  label,
  segments,
  value,
  onChange,
  description,
}: {
  readonly label: string;
  readonly segments: readonly Segment<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Set when the control is read-only: why, as the file and key that fix it. */
  readonly description?: string | undefined;
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const describedBy = useId();
  const readOnly = description !== undefined;
  const onKeyDown = (event: KeyboardEvent, at: number) => {
    const next = segmentAfterKey(event.key, at, segments.length);
    const target = next === undefined ? undefined : segments[next];
    if (target === undefined || next === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(target.value);
  };
  return (
    <span
      role="radiogroup"
      aria-label={label}
      aria-describedby={readOnly ? describedBy : undefined}
      title={description}
      className={SEGMENTS}
    >
      {segments.map((segment, at) => (
        // biome-ignore lint/a11y/useSemanticElements: the WAI-ARIA radio group of buttons; a native radio cannot take the segment's look.
        <button
          key={segment.value}
          ref={(element) => {
            refs.current[at] = element;
          }}
          type="button"
          role="radio"
          aria-checked={segment.value === value}
          tabIndex={segment.value === value ? 0 : -1}
          disabled={readOnly}
          className={SEGMENT}
          onClick={() => onChange(segment.value)}
          onKeyDown={(event) => onKeyDown(event, at)}
        >
          {segment.label}
        </button>
      ))}
      {readOnly ? (
        <span id={describedBy} className="sr-only">
          {description}
        </span>
      ) : null}
    </span>
  );
};
