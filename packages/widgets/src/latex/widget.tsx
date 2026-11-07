// The LaTeX's block (view-and-widgets spec: LaTeX source and preview, LaTeX source limit, LaTeX
// parse errors, LaTeX previews one at a time; design decision 7): the source field in the code type,
// the field error under it, the live preview and the counter. The expression is the value's, else
// the agent's; nothing here holds it: the field reports each edit, cut to the contract's limit, and
// the preview is drawn from what the field shows. Each draw goes through the chunk's queue, one per
// task, marked as an edit when the user's typing asked for it, and is dropped when the item goes
// away (AD-8, AD-9). The preview's nodes are KaTeX's, put in by `renderInto`; React makes none.

import { agentTextRuns, cutLatexExpression } from "@askboard/contract";
import { useReadyAfterLayout, useStrings } from "@askboard/view/catalog";
import { useEffect, useId, useRef, useState } from "react";
import {
  BLOCK,
  CHANGE_DOT,
  COUNTER,
  FIELD_ERROR,
  PREVIEW,
  SOURCE,
  SOURCE_EDITED,
} from "./classes.ts";
import { fieldErrorOf } from "./model.ts";
import { renderQueue } from "./queue.ts";
import { type Rendered, renderInto } from "./render.ts";

// KaTeX's message quotes the agent's source: its controls, bidirectional ones included, are shown
// as visible escapes (the contract's rule for agent text), as text.
const asText = (message: string): string =>
  agentTextRuns(message)
    .map(({ text }) => text)
    .join("");

export const LatexWidget = ({
  expression,
  edited,
  disabled,
  ready,
  onText,
  onFail,
}: {
  /** The expression the field shows: the value's, else the agent's. */
  readonly expression: string;
  /** The expression differs from the agent's. */
  readonly edited: boolean;
  /** The question is answered, being sent or locked: the field is read-only. */
  readonly disabled: boolean;
  /** Reports the item ready (AD-9). */
  readonly ready: () => void;
  /** The text the user typed, already cut to the limit. */
  readonly onText: (text: string) => void;
  /** A draw threw: the item fails. */
  readonly onFail: (error: unknown) => void;
}) => {
  const text = useStrings();
  const key = useId();
  const preview = useRef<HTMLDivElement>(null);
  // Set by the input handler, read by the next draw: whether the user's typing asked for it.
  const typed = useRef(false);
  const failure = useRef(onFail);
  failure.current = onFail;
  const [rendered, setRendered] = useState<Rendered>({});
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const element = preview.current;
    if (element === null) return;
    const edit = typed.current;
    typed.current = false;
    renderQueue.ask(
      key,
      () => {
        setRendered(renderInto(element, expression));
        // The item is ready once its first draw has run, however it ended, and the fonts have
        // loaded: the fonts are inline, but a glyph's use loads its file.
        const done = () => setSettled(true);
        requestAnimationFrame(() => document.fonts.ready.then(done, done));
      },
      { edit, onError: (error) => failure.current(error) },
    );
  }, [expression, key]);
  // An unmounted item's pending draw is dropped.
  useEffect(() => () => renderQueue.drop(key), [key]);
  useReadyAfterLayout(ready, settled);

  const problem = fieldErrorOf(rendered);
  const words =
    problem === undefined
      ? undefined
      : text(
          problem.key,
          problem.key === "latex.parseError"
            ? { message: asText(String(problem.values.message)) }
            : problem.values,
        );
  const errorId = `${key}-error`;
  return (
    <div className={BLOCK} data-latex="">
      <textarea
        className={edited ? `${SOURCE} ${SOURCE_EDITED}` : SOURCE}
        aria-label={text("latex.source")}
        aria-invalid={words === undefined ? undefined : true}
        aria-describedby={words === undefined ? undefined : errorId}
        rows={3}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        value={expression}
        readOnly={disabled}
        data-latex-source=""
        data-change={edited ? "edited" : undefined}
        onChange={(event) => {
          const next = cutLatexExpression(event.currentTarget.value);
          if (next !== expression) typed.current = true;
          onText(next);
        }}
      />
      {words === undefined ? null : (
        <p id={errorId} className={FIELD_ERROR} data-latex-error="">
          {words}
        </p>
      )}
      {/* The preview scrolls sideways, so it takes the keyboard to be scrolled by it. */}
      {/* biome-ignore lint/a11y/useSemanticElements: a group of KaTeX's nodes, not a form group. */}
      <div
        ref={preview}
        role="group"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable.
        tabIndex={0}
        aria-label={text("latex.preview")}
        className={PREVIEW}
        data-latex-preview=""
      />
      <p className={COUNTER} data-latex-counter="">
        {edited ? <span className={CHANGE_DOT} /> : null}
        {edited ? text("latex.counterEdited") : text("widget.noChanges")}
      </p>
    </div>
  );
};
