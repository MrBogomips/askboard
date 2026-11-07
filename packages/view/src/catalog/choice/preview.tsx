// An option's preview, open under its row (EXPERIENCE.md, Option preview; atoms, design decision 5):
// plain text, or Markdown when the option marks it so, which the Text atom's component draws. That
// component lives in its own chunk, which the board loads for a Markdown preview (`componentsOf`),
// so the preview reaches it through the port and falls back to plain text when it is not there:
// never to unsanitized markup. The synthetic Text is named after the question, since that is the
// item the board page checks for Markdown when a link in the preview is clicked.

import { type CatalogComponent, componentFor, type ItemProps } from "../port.ts";

const PREVIEW =
  "ml-xl whitespace-pre-wrap rounded-md border border-border bg-muted p-sm text-body text-foreground";

const NOTHING = () => {};

type PreviewProps = {
  /** The preview's element ID, which the "Show preview" button controls. */
  readonly id: string;
  /** The question's ID. */
  readonly itemId: string;
  readonly preview: string;
  readonly format?: "plain" | "markdown";
  /** Where the Text component is found; the port's registry unless a test gives another. */
  readonly find?: (name: string) => CatalogComponent | undefined;
};

export const OptionPreview = ({
  id,
  itemId,
  preview,
  format = "plain",
  find = componentFor,
}: PreviewProps) => {
  const Text = format === "markdown" ? find("text") : undefined;
  if (Text === undefined) {
    return (
      <p id={id} className={PREVIEW}>
        {preview}
      </p>
    );
  }
  const given: ItemProps = {
    item: { type: "text", id: itemId, props: { text: preview, format: "markdown" } },
    questionId: itemId,
    value: undefined,
    onValueChange: NOTHING,
    onValuesChange: NOTHING,
    result: undefined,
    onResultChange: NOTHING,
    disabled: true,
    ready: NOTHING,
    board: { items: [], draft: new Map(), shown: new Map() },
    onDerived: NOTHING,
    entry: undefined,
    onEntryChange: NOTHING,
  };
  return (
    <div id={id} className="ml-xl rounded-md border border-border bg-muted p-sm">
      <Text {...given} />
    </div>
  );
};
