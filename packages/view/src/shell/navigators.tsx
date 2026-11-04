// The board's navigators (EXPERIENCE.md, Outline navigator and Question navigator; DESIGN.md, the
// same; FR-2): with sections or tabs, the outline lists the areas and their questions, each with
// its marker and state label, the "New" and unread-reply marks and the agent-change flag, and a
// click or a key jumps to the question, activating its tab; in one question per view, the question
// navigator says "Question n of m", holds one marker per question, Previous and Next, which stop
// at the ends, and "Next open →", which wraps. Every jump moves focus to the question's heading.
// Agent strings (area titles, chips, question texts) render as text (AD-8).

import { useLanguage, useStrings } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { type Group, type Mark, markLabel } from "./board-view.ts";
import { QuestionMarker } from "./markers.tsx";
import { BUTTON_SECONDARY, FOCUS_RING, INFO_BADGE, SECTION_LABEL, SEPARATOR } from "./styles.ts";

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
        <span className={INFO_BADGE} title={text("outline.newReplies", { count: marks.unread })}>
          {`↩ ${marks.unread}`}
        </span>
      )}
      {marks.changed ? (
        <span className={INFO_BADGE} title={text("header.agentUpdated")}>
          ↻
        </span>
      ) : null}
    </>
  );
};

const ENTRY = `flex w-full flex-col gap-0.5 rounded-md border-l-2 py-1 pr-1 pl-2 text-left enabled:hover:bg-accent ${FOCUS_RING}`;

/** The outline navigator: a sticky rail of areas and their questions. */
export const Outline = ({
  groups,
  current,
  marksOf,
  onJump,
}: {
  readonly groups: readonly Group[];
  readonly current: string | undefined;
  readonly marksOf: (question: ViewQuestion) => EntryMarks;
  readonly onJump: (questionId: string) => void;
}) => {
  const text = useStrings();
  const language = useLanguage();
  return (
    <nav
      aria-label={text("outline.label")}
      className="sticky top-16 flex max-h-[calc(100vh-4rem)] w-[212px] shrink-0 flex-col gap-2 self-start overflow-y-auto border-r border-border p-2"
    >
      <p className={SECTION_LABEL}>{text("outline.label")}</p>
      {groups.map((group) => (
        <div key={group.id ?? "questions"} className="flex flex-col gap-1">
          {group.title === undefined ? null : (
            <p className="truncate text-body font-semibold text-foreground" title={group.title}>
              {group.title}
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {group.questions.map((question) => {
              const marks = marksOf(question);
              const label = question.props.header ?? question.props.text;
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    data-askboard-outline={question.id}
                    aria-current={question.id === current ? "true" : undefined}
                    onClick={() => onJump(question.id)}
                    className={`${ENTRY} ${question.id === current ? "border-primary" : "border-transparent"}`}
                  >
                    <span className="flex w-full items-center gap-1.5">
                      <span
                        className="min-w-0 flex-1 truncate text-body text-foreground"
                        title={label}
                      >
                        {label}
                      </span>
                      <Badges marks={marks} />
                    </span>
                    <span className="flex items-center gap-1.5 text-badge text-foreground-secondary">
                      <QuestionMarker mark={marks.mark} />
                      {markLabel(marks.mark, language)}
                    </span>
                  </button>
                </li>
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
  marksOf,
  onGo,
  onNextOpen,
  removed,
}: {
  readonly questions: readonly ViewQuestion[];
  readonly current: number;
  readonly marksOf: (question: ViewQuestion) => EntryMarks;
  readonly onGo: (questionId: string) => void;
  readonly onNextOpen: (() => void) | undefined;
  /** The agent deleted the question in view (F-55). */
  readonly removed: boolean;
}) => {
  const text = useStrings();
  const language = useLanguage();
  const previous = questions[current - 1];
  const next = questions[current + 1];
  return (
    <nav
      aria-label={text("navigator.label")}
      className="flex flex-wrap items-center gap-3 border-b border-border pb-2"
    >
      <span className="text-control font-semibold text-foreground">
        {text("navigator.position", { current: current + 1, total: questions.length })}
      </span>
      <span className="flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
        {questions.map((question, index) => {
          const marks = marksOf(question);
          const label = question.props.header ?? question.props.text;
          return (
            <button
              key={question.id}
              type="button"
              aria-label={text("navigator.entry", {
                number: index + 1,
                label,
                mark: markLabel(marks.mark, language),
              })}
              aria-current={index === current ? "true" : undefined}
              onClick={() => onGo(question.id)}
              className={`flex h-6 items-center gap-1 rounded-md px-1.5 ${index === current ? "border-b-2 border-primary bg-card" : ""} ${FOCUS_RING}`}
            >
              <QuestionMarker mark={marks.mark} />
              {marks.isNew ? <span className={INFO_BADGE}>{text("mark.new")}</span> : null}
              {marks.unread === 0 ? null : (
                <span className={INFO_BADGE}>{`↩ ${marks.unread}`}</span>
              )}
            </button>
          );
        })}
      </span>
      {removed ? (
        <span className="rounded-md border-l-[3px] border-info bg-info-subtle px-2 py-1 text-body text-info-text">
          {text("navigator.removed")}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
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
        <span aria-hidden="true" className={SEPARATOR} />
        <button
          type="button"
          className={BUTTON_SECONDARY}
          disabled={onNextOpen === undefined}
          onClick={onNextOpen}
        >
          {text("navigator.nextOpen")}
        </button>
      </span>
    </nav>
  );
};
