// The board's navigators (EXPERIENCE.md, Outline navigator and Question navigator; DESIGN.md, the
// same; FR-2): with sections or tabs, the outline lists the areas and their questions, each with
// its marker and state label, the "New" and unread-reply marks and the agent-change flag, and a
// click or a key jumps to the question, activating its tab; in one question per view, the question
// navigator says "Question n of m" with Previous and Next, which stop at the ends (its markers moved
// to the header's progress strip, answering-flow-visual); the next-open jump is the header's, on every presentation (answering-flow-fixes,
// #184). Every jump moves focus to the question's heading.
// Agent strings (area titles, chips, question texts) render as text (AD-8).

import { Fragment } from "react";
import { useLanguage, useStrings } from "../catalog/port.ts";
import { IconAgentChanged, IconReplies } from "../icons/index.ts";
import type { ViewQuestion } from "../view-document.ts";
import { type Group, type Mark, markLabel } from "./board-view.ts";
import { QuestionMarker } from "./markers.tsx";
import type { RemovedNumber } from "./removed-numbers.ts";
import { BUTTON_SECONDARY, FOCUS_RING, INFO_BADGE, SECTION_LABEL } from "./styles.ts";

/** What a question's navigator entry shows beside its text. */
export type EntryMarks = {
  readonly mark: Mark;
  readonly isNew: boolean;
  readonly unread: number;
  readonly changed: boolean;
};

const Badges = ({ marks }: { readonly marks: EntryMarks }) => {
  const text = useStrings();
  return (
    <>
      {marks.isNew ? <span className={INFO_BADGE}>{text("mark.new")}</span> : null}
      {marks.unread === 0 ? null : (
        <span
          role="img"
          aria-label={text("header.newReplies", { count: marks.unread })}
          title={text("header.newReplies", { count: marks.unread })}
          className={`${INFO_BADGE} inline-flex items-center gap-0.5`}
        >
          <IconReplies className="size-3" />
          {marks.unread}
        </span>
      )}
      {marks.changed ? (
        <span
          role="img"
          aria-label={text("header.agentUpdated")}
          title={text("header.agentUpdated")}
          className={`${INFO_BADGE} inline-flex items-center`}
        >
          <IconAgentChanged className="size-3" />
        </span>
      ) : null}
    </>
  );
};

const ENTRY = `flex w-full flex-col gap-0.5 rounded-md border-l-2 py-1 pr-1 pl-sm text-left enabled:hover:bg-accent ${FOCUS_RING}`;

/** The outline navigator: the areas and their questions, in the rail (`rail.tsx`). */
export const Outline = ({
  groups,
  current,
  marksOf,
  onJump,
  numbers,
  removed = [],
}: {
  readonly groups: readonly Group[];
  readonly current: string | undefined;
  readonly marksOf: (question: ViewQuestion) => EntryMarks;
  readonly onJump: (questionId: string) => void;
  /** The questions' short numbers; none shown where the board gives none (a Snapshot). */
  readonly numbers?: ReadonlyMap<string, number> | undefined;
  /** The questions the agent removed while the page is open, where each stood (design decision 6). */
  readonly removed?: readonly RemovedNumber[];
}) => {
  const text = useStrings();
  const language = useLanguage();
  // Where the agent removed a question: its number, until the page reloads (design decision 6).
  const removedEntry = (entry: RemovedNumber) => (
    <li
      key={`removed-${entry.number}`}
      data-askboard-outline-removed={entry.number}
      className="px-sm py-1 text-badge text-muted-foreground"
    >
      {text("outline.removed", { number: text("question.number", { n: entry.number }) })}
    </li>
  );
  return (
    <nav aria-label={text("outline.label")} className="flex flex-col gap-sm p-sm">
      <p className={SECTION_LABEL}>{text("outline.label")}</p>
      {groups.map((group, at) => (
        <div key={group.id ?? "questions"} className="flex flex-col gap-1">
          {group.title === undefined ? null : (
            <p className="truncate text-body font-semibold text-foreground" title={group.title}>
              {group.title}
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {at === 0
              ? removed.filter((entry) => entry.after === undefined).map(removedEntry)
              : null}
            {group.questions.map((question) => {
              const marks = marksOf(question);
              const label = question.props.header ?? question.props.text;
              const number = numbers?.get(question.id);
              return (
                <Fragment key={question.id}>
                  <li>
                    <button
                      type="button"
                      data-askboard-outline={question.id}
                      aria-current={question.id === current ? "true" : undefined}
                      onClick={() => onJump(question.id)}
                      className={`${ENTRY} ${question.id === current ? "border-primary" : "border-transparent"}`}
                    >
                      <span className="flex w-full items-center gap-1.5">
                        {number === undefined ? null : (
                          <span
                            data-askboard-number=""
                            className="shrink-0 font-mono text-code text-muted-foreground"
                          >
                            {text("question.number", { n: number })}
                          </span>
                        )}
                        <span
                          className="min-w-0 flex-1 truncate text-body text-foreground"
                          title={label}
                        >
                          {label}
                        </span>
                        <Badges marks={marks} />
                      </span>
                      <span
                        data-askboard-state={marks.mark}
                        className="flex items-center gap-1.5 text-badge text-foreground-secondary"
                      >
                        <QuestionMarker mark={marks.mark} />
                        {markLabel(marks.mark, language)}
                      </span>
                    </button>
                  </li>
                  {removed.filter((entry) => entry.after === question.id).map(removedEntry)}
                </Fragment>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};

/** The question navigator of one question per view. */
export const QuestionNavigator = ({
  questions,
  current,
  onGo,
  removed,
}: {
  readonly questions: readonly ViewQuestion[];
  readonly current: number;
  readonly onGo: (questionId: string) => void;
  /** The agent deleted the question in view (F-55). */
  readonly removed: boolean;
}) => {
  const text = useStrings();
  const previous = questions[current - 1];
  const next = questions[current + 1];
  return (
    <nav
      aria-label={text("navigator.label")}
      className="flex flex-wrap items-center gap-md border-b border-border pb-sm"
    >
      <span className="text-control font-semibold text-foreground">
        {text("navigator.position", { current: current + 1, total: questions.length })}
      </span>
      {removed ? (
        <span className="rounded-md border-l-[3px] border-info bg-info-subtle px-sm py-1 text-body text-info-text">
          {text("navigator.removed")}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-sm">
        <button
          type="button"
          className={BUTTON_SECONDARY}
          disabled={previous === undefined}
          onClick={() => previous !== undefined && onGo(previous.id)}
        >
          {text("navigator.previous")}
        </button>
        <button
          type="button"
          className={BUTTON_SECONDARY}
          disabled={next === undefined}
          onClick={() => next !== undefined && onGo(next.id)}
        >
          {text("navigator.next")}
        </button>
      </span>
    </nav>
  );
};
