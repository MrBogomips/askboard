// The board's markers (DESIGN.md, Colors: Markers; Components: State pill and Question marker): the
// ask pill with its marker, and each question's marker, whose shape carries its state so that no
// state relies on colour alone. Markers are decoration (`aria-hidden`); their state is always in
// text beside them.

import { useStrings } from "../catalog/port.ts";
import {
  IconAskAnswered,
  IconAskClosed,
  IconAskDiscarded,
  IconAskPartial,
  IconAskWaiting,
  IconDeclined,
  IconDelivered,
  IconDraft,
  IconNotSentYet,
  IconPostponed,
  IconReady,
  IconSent,
  IconToDo,
} from "../icons/index.ts";
import { type AskPillIcon, askPillIconOf, type Mark, type AskPill as Pill } from "./board-view.ts";

const PILLS: Readonly<Record<Pill["kind"], string>> = {
  waiting: "border-border bg-muted text-foreground-secondary",
  partial: "border-border-strong bg-card text-foreground",
  answered: "border-transparent bg-success-subtle text-success-text",
  closed: "border-border-strong bg-muted text-foreground",
  discarded: "border-transparent bg-destructive-subtle text-destructive-text",
};

const PILL_ICONS: Readonly<Record<AskPillIcon, typeof IconAskWaiting>> = {
  circle: IconAskWaiting,
  "circle-dashed": IconAskPartial,
  check: IconAskAnswered,
  lock: IconAskClosed,
  "circle-x": IconAskDiscarded,
};

/**
 * The ask state pill (State pill; #213): an icon and the words, named "Ask: {state}" (`header.askPill`),
 * which is also its tooltip. The icon is the pill's own, never a receipt's.
 */
export const AskPill = ({ pill }: { readonly pill: Pill }) => {
  const text = useStrings();
  const Icon = PILL_ICONS[askPillIconOf(pill.kind)];
  const name = text("header.askPill", { state: pill.label });
  return (
    <span
      data-askboard-ask-pill={pill.kind}
      role="img"
      aria-label={name}
      title={name}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-badge ${PILLS[pill.kind]}`}
    >
      <Icon className="size-3" />
      {pill.label}
    </span>
  );
};

// The icon and the colour of each state of the ladder (DESIGN.md, Markers; design decision 11).
const MARKS = {
  todo: { Icon: IconToDo, tone: "text-ask-waiting" },
  draft: { Icon: IconDraft, tone: "text-ask-partial" },
  ready: { Icon: IconReady, tone: "text-ask-answered" },
  "not-sent-yet": { Icon: IconNotSentYet, tone: "text-foreground-secondary" },
  sent: { Icon: IconSent, tone: "text-ask-partial" },
  delivered: { Icon: IconDelivered, tone: "text-ask-answered" },
  postponed: { Icon: IconPostponed, tone: "text-muted-foreground" },
  declined: { Icon: IconDeclined, tone: "text-foreground-secondary" },
} as const satisfies Record<Mark, { Icon: unknown; tone: string }>;

/**
 * A question's marker: the icon of its state of the ladder, so that none relies on colour alone
 * (DESIGN.md, Markers): a ring for To do, a pencil for Draft, a parcel for Ready, an hourglass for
 * Not sent yet, a paper plane for Sent, two ticks for Delivered, a clock for Postponed, a barred
 * circle for Declined. Decoration (`aria-hidden`): the state is always in text beside it.
 */
export const QuestionMarker = ({
  mark,
  inControl = false,
}: {
  readonly mark: Mark;
  /** Drawn inside a button, beside its own label: not the state line's marker, so no hook. */
  readonly inControl?: boolean;
}) => {
  const { Icon, tone } = MARKS[mark];
  // The test hook names the marker beside a state's label (`data-askboard-marker`, decision 5).
  const hook = inControl ? {} : { "data-askboard-marker": mark };
  return <Icon {...hook} className={`size-3.5 shrink-0 ${tone}`} />;
};
