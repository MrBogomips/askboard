// What a question card shows of the agent's changes (EXPERIENCE.md, Agent-change notice and
// Reopened question; DESIGN.md, the same; ask-lifecycle, task 6.7; FR-6, AD-10, AD-20): the notice
// at the top of a question the agent changed under the user's unsent work, inline and never taking
// focus, with what is at stake, "Show the agent's change" (a read-only view of the new revision,
// its text fields and options marked against the revision the work was made on) and the two
// choices; and, on a question the agent reopened, "Reopened by the agent" with the previous answer
// read-only and "Start from my previous answer". Agent strings render as text (AD-8).

import type { CurrentAnswer } from "@askboard/contract";
import { useState } from "react";
import { useStrings } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { type FieldChange, type OptionChange, revisionDiff } from "./agent-change.ts";
import { BUTTON_LINK, BUTTON_SECONDARY, CHIP, SECTION_LABEL } from "./styles.ts";

/** `agent-change-notice`: info colours with a 3px left rule. */
const NOTICE =
  "flex flex-col gap-sm rounded-md border-l-[3px] border-info bg-info-subtle p-sm text-body text-foreground";

const NOTICE_TITLE = "font-semibold text-info-text";

const INSERTED = "rounded-sm bg-change-subtle px-0.5 text-change-text no-underline";
const DELETED = "text-muted-foreground line-through";

// A field of the new revision, with what it replaced struck through.
const Field = ({ change }: { readonly change: FieldChange }) => {
  if (!change.changed) return <>{change.now}</>;
  return (
    <>
      {change.before === undefined ? null : <del className={DELETED}>{change.before}</del>}
      {change.before === undefined || change.now === undefined ? null : " "}
      {change.now === undefined ? null : <ins className={INSERTED}>{change.now}</ins>}
    </>
  );
};

const OptionLine = ({ option }: { readonly option: OptionChange }) => {
  const text = useStrings();
  const label =
    option.change === "added" ? (
      <ins className={INSERTED}>{option.label}</ins>
    ) : option.change === "removed" ? (
      <del className={DELETED}>{option.label}</del>
    ) : (
      <span className="text-foreground">{option.label}</span>
    );
  const details = (["description", "annotation", "preview"] as const).filter(
    (name) => option[name].now !== undefined || option[name].changed,
  );
  return (
    <li data-askboard-change={option.change} className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-sm text-body-lg">
        {label}
        {option.recommended ? (
          <span className="text-badge text-recommended">{text("question.recommended")}</span>
        ) : null}
      </span>
      {details.map((name) => (
        <span key={name} className="text-body text-foreground-secondary">
          <Field change={option[name]} />
        </span>
      ))}
    </li>
  );
};

/** The new revision, read-only, marked against the earlier one where the view knows it. */
const AgentChange = ({
  question,
  earlier,
}: {
  readonly question: ViewQuestion;
  readonly earlier: ViewQuestion | undefined;
}) => {
  const diff = revisionDiff(earlier?.props, question.props);
  return (
    <div className="flex flex-col gap-sm rounded-md border border-border bg-card p-sm">
      {diff.header.now === undefined && !diff.header.changed ? null : (
        <span className={CHIP}>
          <Field change={diff.header} />
        </span>
      )}
      <p className="text-question text-foreground">
        <Field change={diff.text} />
      </p>
      {diff.options.length === 0 ? null : (
        <ul className="flex flex-col gap-1.5">
          {diff.options.map((option) => (
            <OptionLine key={`${option.change}:${option.label}`} option={option} />
          ))}
        </ul>
      )}
    </div>
  );
};

export type ChangeNoticeProps = {
  readonly question: ViewQuestion;
  /** The revision the user's work was made on, if the view has seen it. */
  readonly earlier: ViewQuestion | undefined;
  /** What is at stake: "Your 17 changes on this question". */
  readonly stake: string;
  /** A choice is on its way. */
  readonly busy: boolean;
  readonly onReload: () => void;
  readonly onKeep: () => void;
};

/** The agent-change notice. It never takes focus; its controls are in the tab order. */
export const ChangeNotice = ({
  question,
  earlier,
  stake,
  busy,
  onReload,
  onKeep,
}: ChangeNoticeProps) => {
  const [showing, setShowing] = useState(false);
  const id = `${question.id}:agent-change`;
  const text = useStrings();
  return (
    <div data-askboard-notice="agent-change" className={NOTICE}>
      <p className={NOTICE_TITLE}>{text("change.title")}</p>
      <p>{stake}</p>
      <div className="flex flex-wrap items-center gap-sm">
        <button
          type="button"
          className={BUTTON_LINK}
          aria-expanded={showing}
          aria-controls={id}
          onClick={() => setShowing(!showing)}
        >
          {text("change.show")}
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={busy} onClick={onReload}>
          {text("change.reload")}
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={busy} onClick={onKeep}>
          {text("change.keep")}
        </button>
      </div>
      {showing ? (
        <div id={id}>
          <AgentChange question={question} earlier={earlier} />
        </div>
      ) : null}
    </div>
  );
};

// An answer's content, read-only: the chosen options, the "Other…" text, the notes on options and
// the open prompt's note, as text with no input borders (DESIGN.md, Reopened question).
const AnswerText = ({ answer }: { readonly answer: CurrentAnswer }) => {
  const text = useStrings();
  return (
    <ul className="flex flex-col gap-0.5 font-mono text-body text-foreground">
      {(answer.choice ?? []).map((label) => (
        <li key={`choice:${label}`}>{label}</li>
      ))}
      {answer.other === undefined ? null : (
        <li>{text("reopened.other", { text: answer.other })}</li>
      )}
      {Object.entries(answer.optionNotes ?? {}).map(([label, note]) => (
        <li key={`note:${label}`}>{`${label}: ${note}`}</li>
      ))}
      {answer.note === undefined ? null : <li className="whitespace-pre-wrap">{answer.note}</li>}
    </ul>
  );
};

/** "Reopened by the agent", with the previous answer read-only and the way to start from it. */
export const ReopenedNotice = ({
  previous,
  disabled,
  onStart,
}: {
  readonly previous: CurrentAnswer;
  readonly disabled: boolean;
  readonly onStart: () => void;
}) => {
  const text = useStrings();
  return (
    <div data-askboard-notice="reopened" className={NOTICE}>
      <p className={NOTICE_TITLE}>{text("reopened.title")}</p>
      <div className="flex flex-wrap items-start gap-md">
        <div className="flex min-w-48 flex-1 flex-col gap-1 rounded-md bg-muted p-sm">
          <p className={SECTION_LABEL}>{text("reopened.previous")}</p>
          <AnswerText answer={previous} />
        </div>
        <button type="button" className={BUTTON_SECONDARY} disabled={disabled} onClick={onStart}>
          {text("reopened.start")}
        </button>
      </div>
    </div>
  );
};
