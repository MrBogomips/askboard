import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { Field, inputClass, text } from "./_field.tsx";

// A text input with a locale parser, never `type="number"` (EXPERIENCE.md, Atoms). The draft
// holds the text as typed; the parsed number is shown beside it.
const parse = (typed: string, decimal: string): number | null => {
  const normalized = typed.replaceAll(decimal === "," ? "." : ",", "").replace(decimal, ".");
  const value = Number(normalized);
  return normalized.trim() !== "" && Number.isFinite(value) ? value : null;
};

const NumberField = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const id = `${item.id}-input`;
  const typed = text(draft);
  const parsed = parse(typed, text(item.props?.decimal, "."));
  return (
    <Field id={id} label={text(item.props?.label)}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={inputClass}
          value={typed}
          onChange={(e) => emit({ type: "draft.set", id: item.id, value: e.target.value })}
        />
        <span className="text-control text-muted-foreground">
          {typed === "" ? "" : parsed === null ? "not a number" : String(parsed)}
        </span>
      </div>
    </Field>
  );
};

register("NumberField", NumberField);
