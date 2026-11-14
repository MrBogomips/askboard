import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { Field, inputClass, text } from "./_field.tsx";

// Controlled from the draft record: the field keeps no edit state of its own (AD-9).
const TextField = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const id = `${item.id}-input`;
  return (
    <Field id={id} label={text(item.props?.label)}>
      <input
        id={id}
        type="text"
        className={inputClass}
        value={text(draft)}
        onChange={(e) => emit({ type: "draft.set", id: item.id, value: e.target.value })}
      />
    </Field>
  );
};

register("TextField", TextField);
