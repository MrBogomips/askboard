// The questions Submit's confirmation lists (approval-scale-ranking, design decision 6): each by
// the label the outline shows, its header chip else its text, on one line cut with an ellipsis and
// with the label whole as the `title`, as an agent-written label is everywhere (EXPERIENCE.md,
// Agent-written labels; F-64). The list has a height of its own and scrolls, so that the dialog's
// buttons stay within reach whatever the agent wrote (NFR-12).

import type { ViewQuestion } from "../view-document.ts";

export const ReplacedQuestions = ({
  questions,
}: {
  readonly questions: readonly ViewQuestion[];
}) => (
  <ul className="max-h-48 list-disc overflow-y-auto pl-lg text-body text-foreground">
    {questions.map((question) => {
      const label = question.props.header ?? question.props.text;
      return (
        <li key={question.id}>
          <span className="block truncate" title={label}>
            {label}
          </span>
        </li>
      );
    })}
  </ul>
);
