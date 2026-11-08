// The DateField atom's chunk (atoms, design decisions 3, 4, 7 and 9; view-and-widgets spec: Number,
// amount and date entry in the fields, The DateField's calendar, An entry blocks Answer): a text input
// read with the contract's parser in the ask's locale, never the browser's date input, with the echo of
// the day read beside it, and a button after it that opens react-day-picker in Radix's non-modal
// Popover. The calendar's captions, weekday names and labels are written from AskBoard's tables and the
// view's strings (`calendar.ts`), so nothing reaches the runtime's `Intl` or `toLocale*`, weeks start on
// Sunday in en-US and on Monday in it-IT, and days outside the item's range are disabled. A day picked
// is the day the calendar shows, whatever the viewer's time zone. A date within the range is the item's
// result and clears the entry; an empty text clears both; anything else is kept as the entry, with its
// reason as the field error, which disables "Answer" until it is corrected (AD-10). Answered or locked it
// shows the long date, read-only, with no button.

import {
  type DateFieldProps,
  dateEcho,
  dateFieldFieldCheck,
  dateFieldPropsProblems,
  dateFieldResultProblems,
  dateFieldResultShape,
  formatLongDate,
} from "@askboard/contract";
import { Popover } from "radix-ui";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { EntryField } from "../fields/entry-field.tsx";
import { Field } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import { putting } from "../fields/text.ts";
import {
  type ItemProps,
  register,
  useLanguage,
  useLocale,
  useReadyAfterLayout,
  useStrings,
} from "../port.ts";
import {
  calendarFormatters,
  calendarLabels,
  dayOf,
  disabledOf,
  monthRangeOf,
  pickedDay,
  weekStartOf,
} from "./calendar.ts";
import { CALENDAR_BUTTON, DAY_PICKER_CLASSES, POPOVER } from "./classes.ts";
import { dateTextHandler, readDate, shownDate } from "./read.ts";

/** The catalog name, which is the DateField item's type. */
const DATE_FIELD = "date-field";

type UncheckedDateFieldItem = {
  readonly type: "date-field";
  readonly id: string;
  readonly props: unknown;
};

// The calendar's button: a month grid, drawn in the text colour.
const CalendarIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 7h12M5 1.5v3M11 1.5v3" />
  </svg>
);

const DateField = ({
  item,
  result,
  entry,
  onResultChange,
  onEntryChange,
  disabled,
  ready,
}: ItemProps<UncheckedDateFieldItem>) => {
  const props = checkedProps<DateFieldProps>(
    "DateField",
    item.id,
    item.props,
    dateFieldPropsProblems,
  );
  useReadyAfterLayout(ready);
  const locale = useLocale();
  const language = useLanguage();
  const text = useStrings();
  const [typed, remember] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const held = typeof result === "string" && dateFieldResultShape(result) ? result : undefined;
  // Answered or locked: the long date in the ask's locale, read-only, with no echo, error or button.
  if (disabled) {
    return (
      <Field itemId={item.id} label={props.label} description={props.description}>
        <EntryField
          itemId={item.id}
          text={held === undefined ? "" : formatLongDate(held, locale)}
          onText={remember}
          readOnly
          affix={undefined}
          echo={undefined}
          error={undefined}
          hasDescription={props.description !== undefined}
          inputMode="numeric"
        />
      </Field>
    );
  }
  const reading = entry === undefined ? undefined : readDate(entry, props, locale, language);
  const refused = reading?.kind === "entry" ? reading : undefined;
  const echo =
    refused === undefined
      ? held === undefined
        ? undefined
        : dateEcho(held, locale)
      : refused.echo;
  const onText = dateTextHandler({
    props,
    locale,
    language,
    put: { result: onResultChange, entry: onEntryChange },
    remember,
  });
  const onPick = pickedDay({
    result: onResultChange,
    remember,
    close: putting(setOpen, false),
  });
  const { start, end } = monthRangeOf(props);
  const calendar = (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger type="button" className={CALENDAR_BUTTON} aria-label={text("date.choose")}>
        <CalendarIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          aria-label={text("date.choose")}
          className={POPOVER}
        >
          <DayPicker
            mode="single"
            required
            autoFocus
            noonSafe
            selected={held === undefined ? undefined : dayOf(held)}
            onSelect={onPick}
            defaultMonth={held === undefined ? undefined : dayOf(held)}
            startMonth={start}
            endMonth={end}
            disabled={disabledOf(props)}
            weekStartsOn={weekStartOf(locale)}
            formatters={calendarFormatters(locale)}
            labels={calendarLabels(locale, language)}
            classNames={DAY_PICKER_CLASSES}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
  return (
    <Field
      itemId={item.id}
      label={props.label}
      description={props.description}
      required={props.required === true}
    >
      <EntryField
        itemId={item.id}
        text={shownDate({ entry, result, typed, locale })}
        onText={onText}
        readOnly={false}
        affix={undefined}
        echo={echo}
        error={refused?.error}
        hasDescription={props.description !== undefined}
        required={props.required === true}
        after={calendar}
        inputMode="numeric"
      />
    </Field>
  );
};

// The facts the shell needs of the DateField: its name in the agent-change notice, and whether a
// result fits its props, by the contract's shape and props checks, the two `widgetResultFits` runs.
register(DATE_FIELD, DateField, {
  name: "change.widgetDateField",
  fits: (result, props) =>
    dateFieldResultShape(result) && dateFieldResultProblems(result, props).length === 0,
  check: dateFieldFieldCheck,
});
