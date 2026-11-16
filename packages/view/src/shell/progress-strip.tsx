// The progress strip (answering-flow-visual, design decision 5; EXPERIENCE.md, Progress strip): in
// the progress row, one segment per question in board order, grouped by area with a gap between the
// groups. A segment is a button with its ladder state's marker on the tone's subtle fill and an
// underline in the tone, outlined when it is the question in view, with the new-question dot. Its
// name is `progress.segment` ("{number} {chip}: {state}", ", New" when new), shown in a tooltip on
// hover and focus; the chip is agent text, rendered as text (AD-8). One Tab stop: the current segment
// holds it, and the arrows, Home and End move focus without moving the board (`segmentAfterKey`);
// Enter and Space activate natively, through the board's `go`. The strip scrolls inside the row; the
// question in view's segment is brought into its box by `scrollLeft`, never `scrollIntoView`.

import { Tooltip } from "radix-ui";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { useLanguage, useStrings } from "../catalog/port.ts";
import { IconNew } from "../icons/index.ts";
import { isolate } from "./bidi.ts";
import { type Mark, markLabel } from "./board-view.ts";
import { QuestionMarker } from "./markers.tsx";
import { type Segment, type SegmentGroup, stripScrollLeft } from "./progress-strip-model.ts";
import { segmentAfterKey } from "./segment-keys.ts";
import { FOCUS_RING } from "./styles.ts";

// The tone of each state: its subtle fill and the underline's colour.
const TONES: Readonly<Record<Mark, string>> = {
  todo: "bg-muted border-border-strong",
  draft: "bg-muted border-primary",
  ready: "bg-primary-subtle border-primary",
  "not-sent-yet": "bg-warning-subtle border-warning",
  sent: "bg-info-subtle border-info",
  delivered: "bg-success-subtle border-success",
  postponed: "bg-muted border-warning",
  declined: "bg-muted border-destructive",
};

const TOOLTIP =
  "z-30 max-w-[min(36rem,80vw)] rounded-md border border-border bg-popover px-sm py-1 text-body text-popover-foreground break-words shadow-md";

export const ProgressStrip = ({
  groups,
  current,
  onGo,
}: {
  readonly groups: readonly SegmentGroup[];
  /** The question in view, which holds the strip's one Tab stop. */
  readonly current: string | undefined;
  readonly onGo: (questionId: string) => void;
}) => {
  const text = useStrings();
  const language = useLanguage();
  const all = groups.flatMap((group) => group.segments);
  const stop = all.some((segment) => segment.questionId === current) ? current : all[0]?.questionId;
  const strip = useRef<HTMLFieldSetElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // The question in view changing brings its segment into the strip's box.
  useEffect(() => {
    const box = strip.current;
    const segment = current === undefined ? undefined : buttons.current.get(current);
    if (box === null || segment === undefined) return;
    const left = stripScrollLeft(
      { scrollLeft: box.scrollLeft, clientWidth: box.clientWidth },
      { offsetLeft: segment.offsetLeft, offsetWidth: segment.offsetWidth },
    );
    if (left !== box.scrollLeft) box.scrollLeft = left;
  }, [current]);
  const nameOf = (segment: Segment): string => {
    const number =
      segment.number === undefined ? "" : `${text("question.number", { n: segment.number })} `;
    const base = text("progress.segment", {
      number: number.trim(),
      chip: isolate(segment.chip),
      state: markLabel(segment.state, language),
    }).trim();
    return segment.isNew ? `${base}, ${text("mark.new")}` : base;
  };
  const onKeyDown = (event: KeyboardEvent, at: number) => {
    const next = segmentAfterKey(event.key, at, all.length);
    const target = next === undefined ? undefined : all[next];
    if (target === undefined) return;
    event.preventDefault();
    buttons.current.get(target.questionId)?.focus();
  };
  let index = -1;
  return (
    <fieldset
      ref={strip}
      aria-label={text("progress.label")}
      data-askboard-progress-strip=""
      className="relative m-0 flex min-w-0 flex-1 items-center gap-md overflow-x-auto border-0 p-0 py-1"
    >
      {groups.map((group) => (
        <span key={group.areaId ?? "questions"} className="flex shrink-0 items-center gap-1">
          {group.segments.map((segment) => {
            index += 1;
            const at = index;
            const name = nameOf(segment);
            return (
              <Tooltip.Root key={segment.questionId}>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    ref={(element) => {
                      if (element === null) buttons.current.delete(segment.questionId);
                      else buttons.current.set(segment.questionId, element);
                    }}
                    data-askboard-strip={segment.questionId}
                    data-askboard-state={segment.state}
                    aria-label={name}
                    aria-current={segment.questionId === current ? "true" : undefined}
                    tabIndex={segment.questionId === stop ? 0 : -1}
                    onClick={() => onGo(segment.questionId)}
                    onKeyDown={(event) => onKeyDown(event, at)}
                    className={`relative flex h-6 w-7 shrink-0 items-center justify-center rounded-md border-b-[3px] ${TONES[segment.state]} ${segment.questionId === current ? "outline outline-2 outline-foreground" : ""} ${FOCUS_RING}`}
                  >
                    <QuestionMarker mark={segment.state} inControl />
                    {segment.isNew ? (
                      <IconNew className="absolute -top-1 -right-1 size-3 text-info" />
                    ) : null}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="bottom" sideOffset={4} className={TOOLTIP}>
                    {name}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </span>
      ))}
    </fieldset>
  );
};
