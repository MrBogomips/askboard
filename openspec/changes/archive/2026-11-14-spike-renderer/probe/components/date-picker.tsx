import { Popover } from "radix-ui";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { Field, inputClass, text } from "./_field.tsx";

// An ISO date (YYYY-MM-DD), read and written as a calendar date with no time zone.
const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromIso = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

// The Date Picker: a field that opens react-day-picker in a Radix Popover (EXPERIENCE.md,
// Atoms). The month shown is fixed by the item, so two renders give the same DOM.
const DatePicker = ({ item, draft, ui, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const id = `${item.id}-date`;
  const selected = fromIso(draft);
  const month = fromIso(item.props?.month) ?? selected ?? new Date(2026, 10, 1);
  return (
    <Field id={id} label={text(item.props?.label)}>
      <Popover.Root open={ui === true} onOpenChange={(open) => emit({ type: "ui.set", id: item.id, value: open })}>
        <Popover.Trigger id={id} className={`${inputClass} text-left`}>
          {selected ? toIso(selected) : text(item.props?.placeholder, "Pick a date")}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={4} className="rounded-md border border-border bg-popover p-2 shadow-md">
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={month}
              onSelect={(date) => {
                emit({ type: "draft.set", id: item.id, value: date ? toIso(date) : null });
                emit({ type: "ui.set", id: item.id, value: false });
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Field>
  );
};

register("DatePicker", DatePicker);
