// The excerpt (excerpts, design decision 6; DESIGN.md, Excerpt; view spec, "Excerpts show as
// source text"): a bordered card, its caption on the sunken fill (the title, then the source line:
// path, anchor and line range), then its body as source text, each line numbered as in its file,
// capped in height and scrolling inside. Markdown soft-wraps under a hanging indent; anything else
// keeps its lines and scrolls sideways. An unresolved excerpt shows "Unresolved" and its pointer in
// place of the body. Every string goes in as text. "Open in reading panel" joins the caption with
// the reading panel (task 6.6), shown only in a hosted view (task 6.4).

import type { ItemProps } from "../port.ts";
import { useReadyAfterLayout } from "../port.ts";
import {
  BODY,
  CAPTION,
  EXCERPT,
  LINE,
  LINES_CODE,
  LINES_WRAP,
  NUMBER,
  SOURCE,
  TEXT_CODE,
  TEXT_WRAP,
  TITLE,
} from "./classes.ts";
import { Marked, UnresolvedRow } from "./marked.tsx";
import { type Caption, captionOf, excerptOf, linesOf } from "./props.ts";

const CaptionRow = ({ caption }: { readonly caption: Caption }) => (
  <figcaption data-context-part="caption" className={CAPTION}>
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

export const Excerpt = ({ item, ready }: ItemProps<{ readonly props: unknown }>) => {
  useReadyAfterLayout(ready);
  const excerpt = excerptOf(item.props);
  const caption = captionOf(excerpt);
  return (
    <figure data-context="excerpt" className={EXCERPT}>
      {caption.title === undefined ? null : <CaptionRow caption={caption} />}
      {excerpt.kind === "unresolved" ? (
        <UnresolvedRow pointer={excerpt.pointer} />
      ) : (
        <Body text={excerpt.text} start={excerpt.start} wraps={excerpt.wraps} />
      )}
    </figure>
  );
};
