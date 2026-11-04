// Agent text as React text (AD-8), each marked control a visible escape (`marks.ts`), and the
// "Unresolved" row an unresolved excerpt or image shows with its pointer (DESIGN.md, Excerpt).

import { MARK, POINTER, UNRESOLVED, UNRESOLVED_ROW } from "./classes.ts";
import { markedRuns } from "./marks.ts";

/** The text as React text, its marked controls as escapes. */
export const Marked = ({ text }: { readonly text: string }) => (
  <>
    {markedRuns(text).map((run, index) =>
      run.mark ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text never reorder.
        <span key={index} data-context-part="mark" className={MARK}>
          {run.text}
        </span>
      ) : (
        run.text
      ),
    )}
  </>
);

/** "Unresolved" with the pointer, isolated for bidirectional text. */
export const UnresolvedRow = ({ pointer }: { readonly pointer: string }) => (
  <p className={UNRESOLVED_ROW}>
    <span data-context-part="unresolved" className={UNRESOLVED}>
      Unresolved
    </span>
    <bdi data-context-part="pointer" className={POINTER}>
      <Marked text={pointer} />
    </bdi>
  </p>
);
