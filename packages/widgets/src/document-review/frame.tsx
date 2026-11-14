// The Document review's frame (view-and-widgets spec: A Document review's document, Commenting on a
// passage, A Document review read-only and in Snapshots, A Document review at the keyboard; DESIGN.md:
// Document review): the title, the document, the toolbar row with the counter and the message about
// a refused passage, and the detached list, as the Ranking's frame is the Ranking's. It is
// presentational: the widget gives it the document's element, the texts and what the tools do. In
// the document order the document comes before the toolbar, so that the Tab order is the document,
// then the toolbar; `order-*` classes show the toolbar above it. A read-only frame has no toolbar,
// counter or message.

import type { Say } from "@askboard/view/catalog";
import { type ReactNode, useRef, useState } from "react";
import { toolbarStop } from "../shared/toolbar-focus.ts";
import { COUNTER, FRAME, MESSAGE, TITLE, TOOL, TOOLBAR_ROW, TOOLS } from "./classes.ts";
import { holdStop, keepSelection, pressTool, recordTool, toolbarKeys } from "./frame-handlers.ts";

export type Tool = "comment" | "suggestion";

export type ReviewFrameProps = {
  readonly say: Say;
  /** The agent's title, shown as text, or none. */
  readonly title: string | undefined;
  /** The ID of the title's element, which labels the document. */
  readonly titleId?: string;
  readonly editable: boolean;
  /** "No comments yet", "Your changes: 1 comment". */
  readonly counter: string;
  /** Why the last passage was refused, or an empty text. */
  readonly message: string;
  readonly onTool: (tool: Tool) => void;
  /** The document's element. */
  readonly document: ReactNode;
  /** The detached list, or nothing. */
  readonly list?: ReactNode;
  /** What the widget draws into the document by portals, which render nothing here. */
  readonly children?: ReactNode;
};

const TOOL_LIST: readonly {
  readonly tool: Tool;
  readonly label: "documentReview.comment" | "documentReview.suggest";
}[] = [
  { tool: "comment", label: "documentReview.comment" },
  { tool: "suggestion", label: "documentReview.suggest" },
];

const ALL_ENABLED = [true, true];

// The tools: `button-secondary`s, one Tab stop with the horizontal arrow keys, Home and End. A press
// keeps the selection in the document: the mousedown default, which would move it, is prevented.
const Tools = ({ say, onTool }: { readonly say: Say; readonly onTool: (tool: Tool) => void }) => {
  const [at, setAt] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const stop = toolbarStop(ALL_ENABLED, at);
  return (
    <div
      role="toolbar"
      aria-label={say("documentReview.tools")}
      className={TOOLS}
      onKeyDown={toolbarKeys(ALL_ENABLED, at, buttons)}
    >
      {TOOL_LIST.map(({ tool, label }, place) => (
        <button
          key={tool}
          ref={recordTool(buttons, place)}
          type="button"
          tabIndex={place === stop ? 0 : -1}
          className={TOOL}
          data-review-tool={tool}
          onFocus={holdStop(setAt, place)}
          onMouseDown={keepSelection}
          onClick={pressTool(tool, onTool)}
        >
          {say(label)}
        </button>
      ))}
    </div>
  );
};

export const ReviewFrame = ({
  say,
  title,
  titleId,
  editable,
  counter,
  message,
  onTool,
  document,
  list,
  children,
}: ReviewFrameProps) => (
  <div className={FRAME} data-document-review="">
    {title === undefined ? null : (
      <p id={titleId} className={TITLE}>
        {title}
      </p>
    )}
    {document}
    {editable ? (
      <div className={TOOLBAR_ROW}>
        <Tools say={say} onTool={onTool} />
        <p className={MESSAGE} role="status" aria-live="polite">
          {message}
        </p>
        <p className={COUNTER} data-review-counter="">
          {counter}
        </p>
      </div>
    ) : null}
    {list}
    {children}
  </div>
);
