// The excerpt (excerpts, design decision 6; DESIGN.md, Excerpt; view spec, "Excerpts show as
// source text"): a bordered card, its caption on the sunken fill (the title, then the source line:
// path, anchor and line range), then its body as source text, each line numbered as in its file,
// capped in height and scrolling inside. Markdown soft-wraps under a hanging indent; anything else
// keeps its lines and scrolls sideways. An unresolved excerpt shows "Unresolved" and its pointer in
// place of the body. Every string goes in as text. "Open in reading panel" sits in the caption of
// an excerpt from a file, in a hosted view only (task 6.4): it sends `open-reference` naming the
// item (task 6.6).

import type { ItemProps } from "../port.ts";
import { useHosted, useOpenReference, useReadyAfterLayout } from "../port.ts";
import {
  BODY,
  CAPTION,
  CAPTION_TEXT,
  EXCERPT,
  LINE,
  LINES_CODE,
  LINES_WRAP,
  NUMBER,
  OPEN_LINK,
  SOURCE,
  TEXT_CODE,
  TEXT_WRAP,
  TITLE,
} from "./classes.ts";
import { Marked, UnresolvedRow } from "./marked.tsx";
import { type Caption, captionOf, excerptOf, linesOf } from "./props.ts";

const CaptionRow = ({
  caption,
  onOpen,
}: {
  readonly caption: Caption;
  /** Opens the source in the reading panel; absent where there is none to open. */
  readonly onOpen?: () => void;
}) => (
  <figcaption data-context-part="caption" className={CAPTION}>
    <div className={CAPTION_TEXT}>
      {caption.title === undefined ? null : (
        <bdi data-context-part="title" className={TITLE}>
          <Marked text={caption.title} />
        </bdi>
      )}
      {caption.source === undefined ? null : (
        <span data-context-part="source" className={SOURCE}>
          <bdi>
            <Marked text={caption.source} />
          </bdi>
          {` · ${caption.range ?? ""}`}
        </span>
      )}
    </div>
    {onOpen === undefined ? null : (
      <button type="button" data-context-part="open" className={OPEN_LINK} onClick={onOpen}>
        Open in reading panel
      </button>
    )}
  </figcaption>
);

const Body = ({
  text,
  start,
  wraps,
}: {
  readonly text: string;
  readonly start: number;
  readonly wraps: boolean;
}) => (
  // A scrolling region the keyboard can reach and scroll.
  // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take the focus.
  <div data-context-part="body" tabIndex={0} className={BODY}>
    <ol start={start} className={wraps ? LINES_WRAP : LINES_CODE}>
      {linesOf(text, start).map((line) => (
        <li key={line.number} data-context-part="line" className={LINE}>
          <span data-context-part="number" aria-hidden="true" className={NUMBER}>
            {line.number}
          </span>
          <span data-context-part="text" className={wraps ? TEXT_WRAP : TEXT_CODE}>
            <Marked text={line.text} />
          </span>
        </li>
      ))}
    </ol>
  </div>
);

export const Excerpt = ({
  item,
  ready,
}: ItemProps<{ readonly id: string; readonly props: unknown }>) => {
  const hosted = useHosted();
  const openReference = useOpenReference();
  useReadyAfterLayout(ready);
  const excerpt = excerptOf(item.props);
  const caption = captionOf(excerpt);
  return (
    <figure data-context="excerpt" className={EXCERPT}>
      {caption.title === undefined ? null : (
        <CaptionRow
          caption={caption}
          {...(hosted && excerpt.kind !== "written"
            ? { onOpen: () => openReference(item.id) }
            : {})}
        />
      )}
      {excerpt.kind === "unresolved" ? (
        <UnresolvedRow pointer={excerpt.pointer} />
      ) : (
        <Body text={excerpt.text} start={excerpt.start} wraps={excerpt.wraps} />
      )}
    </figure>
  );
};
