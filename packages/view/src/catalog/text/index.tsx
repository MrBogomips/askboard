// The Text atom's chunk (atoms, design decisions 4, 5, 8 and 10; view-and-widgets spec: Display
// atoms, Markdown rendered as data, Markdown links in the view): a passage the user reads, which
// gives no answer. Plain text shows as text with its line breaks; Markdown goes through the
// renderer of `markdown.ts` into a container the component fills once per source, and a source
// that renderer refuses (over its bounds, or no sanitizer) shows as plain text. The chunk also
// renders an option's Markdown preview, which Choice hands it as a synthetic Text naming the
// question. A Text holds no state of its own and reports itself ready once its content has been
// laid out (AD-9).

import { type TextItem, textPropsProblems } from "@askboard/contract";
import { useLayoutEffect, useMemo, useRef } from "react";
import { type ItemProps, register, useHosted, useOpenLink, useReadyAfterLayout } from "../port.ts";
import { MARKDOWN, PLAIN } from "./classes.ts";
import { markExternal, mountMarkdown } from "./links.ts";
import { renderMarkdown } from "./markdown.ts";

/** The catalog name, which is the Text item's type. */
const TEXT = "text";

/** A Text item as the view hands it over, its props not checked yet. */
type UncheckedTextItem = {
  readonly type: "text";
  readonly id: string;
  readonly props: unknown;
};

// The props as an agent's Text, or an error naming the item and each problem, which the item's
// error boundary shows as a failed item (AD-10).
const checked = (item: UncheckedTextItem): TextItem["props"] => {
  const problems = textPropsProblems(item.props);
  if (problems.length > 0) {
    const said = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the Text "${item.id}" refuses its props: ${said}`);
  }
  return item.props as TextItem["props"];
};

type BodyProps = { readonly itemId: string; readonly source: string; readonly done: () => void };

// Markdown as nodes appended into a container, or its source as plain text when none came. Hosted,
// a click on a link asks the board page to open it and an auxclick does nothing; in a Snapshot
// the anchors open themselves in a new tab with no opener.
const MarkdownBody = ({ itemId, source, done }: BodyProps) => {
  const container = useRef<HTMLDivElement>(null);
  const hosted = useHosted();
  const openLink = useOpenLink();
  const fragment = useMemo(
    () => (typeof window === "undefined" ? undefined : renderMarkdown(source, window)),
    [source],
  );
  useLayoutEffect(() => {
    const target = container.current;
    if (target === null || fragment === undefined) return undefined;
    const shown = fragment.cloneNode(true) as DocumentFragment;
    if (!hosted) markExternal(shown);
    return mountMarkdown({ target, shown, hosted, itemId, openLink });
  }, [fragment, hosted, itemId, openLink]);
  useReadyAfterLayout(done);
  if (fragment === undefined) {
    return (
      <p data-text-format="plain" className={PLAIN}>
        {source}
      </p>
    );
  }
  return <div ref={container} data-text-format="markdown" className={MARKDOWN} />;
};

const Text = ({ item, ready }: ItemProps<UncheckedTextItem>) => {
  const { text, format } = checked(item);
  if (format === "markdown") {
    return <MarkdownBody itemId={item.id} source={text} done={ready} />;
  }
  return <PlainText text={text} done={ready} />;
};

const PlainText = ({ text, done }: { readonly text: string; readonly done: () => void }) => {
  useReadyAfterLayout(done);
  return (
    <p data-text-format="plain" className={PLAIN}>
      {text}
    </p>
  );
};

// A Text reports no result and no name for the agent-change notice: it gives no answer and edits
// nothing, so it registers no facts (design decision 4).
register(TEXT, Text);
