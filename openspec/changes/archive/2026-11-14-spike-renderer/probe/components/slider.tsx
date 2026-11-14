import { Slider as RadixSlider } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { Field, text } from "./_field.tsx";

const num = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// A number on a range, on Radix Slider (EXPERIENCE.md, Atoms). An unset Slider has no value in
// the draft record and renders no thumb; whether a click on its track sets one is a UX spike
// item (task 4.8).
const Slider = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const min = num(item.props?.min, 0);
  const max = num(item.props?.max, 100);
  const value = typeof draft === "number" ? [draft] : [];
  const label = text(item.props?.label);
  return (
    <Field id={`${item.id}-slider`} label={label}>
      <RadixSlider.Root
        id={`${item.id}-slider`}
        min={min}
        max={max}
        step={num(item.props?.step, 1)}
        value={value}
        onValueChange={(next) => emit({ type: "draft.set", id: item.id, value: next[0] ?? null })}
        className="relative flex h-5 w-64 touch-none select-none items-center"
        aria-label={label}
      >
        <RadixSlider.Track className="relative h-1 grow rounded-full bg-muted">
          <RadixSlider.Range className="absolute h-full rounded-full bg-primary" />
        </RadixSlider.Track>
        {value.map((_, index) => (
          <RadixSlider.Thumb
            // biome-ignore lint/suspicious/noArrayIndexKey: one thumb per value
            key={index}
            className="block size-4 rounded-full border border-primary bg-card"
            aria-label={label}
          />
        ))}
      </RadixSlider.Root>
      <span className="text-label text-muted-foreground">
        {value.length ? String(value[0]) : "not set"}
      </span>
    </Field>
  );
};

register("Slider", Slider);
