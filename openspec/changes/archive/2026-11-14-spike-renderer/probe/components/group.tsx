import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

// A titled, bordered group with fieldset semantics (EXPERIENCE.md, Layouts).
const Group = ({ item, ready, children }: ItemProps) => {
  useReadyAfterLayout(ready);
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
      <legend className="px-1 text-label uppercase text-muted-foreground">
        {text(item.props?.title)}
      </legend>
      {children}
    </fieldset>
  );
};

register("Group", Group);
