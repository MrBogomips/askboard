// The Group layout's chunk (layouts, design decision 7; view-and-widgets spec: Stack and Group): a
// titled, bordered group on the Card structure, `{colors.border}`, `{rounded.md}`, padded
// `{spacing.md}`. The title is in `{typography.label}` and names the group for assistive technology
// (`role="group"`, labelled by the title); the description follows in
// `{colors.foreground-secondary}`. Both are agent text, shown as text (AD-8). Its items draw
// through the port's renderer. It reports itself ready once it has been laid out.

import { itemsOf, rendererOf, textOf } from "../layouts/layout.ts";
import { type ItemProps, register, useReadyAfterLayout } from "../port.ts";

/** The catalog name, which is the Group item's type. */
const GROUP = "group";

type UncheckedGroupItem = {
  readonly type: "group";
  readonly id: string;
  readonly props: unknown;
};

const Group = ({ item, ready, renderItem }: ItemProps<UncheckedGroupItem>) => {
  const items = itemsOf("Group", item.id, item.props);
  const render = rendererOf("Group", item.id, renderItem);
  const title = textOf(item.props, "title");
  if (title === undefined || title === "") {
    throw new Error(`the Group "${item.id}" has no title`);
  }
  const description = textOf(item.props, "description");
  const titleId = `${item.id}:title`;
  useReadyAfterLayout(ready);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend sits on its border; DESIGN draws the title inside the frame.
    <div
      role="group"
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-md rounded-md border border-border p-md"
    >
      <p id={titleId} className="m-0 text-label text-foreground">
        {title}
      </p>
      {description === undefined ? null : (
        <p className="m-0 text-body text-foreground-secondary">{description}</p>
      )}
      {items.map((child) => render(child))}
    </div>
  );
};

register(GROUP, Group);
