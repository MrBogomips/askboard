// The completion panel at the top of the board's content (answering-flow-guidance, design decision 6;
// DESIGN.md, Completion panel): "Every question has an answer." with the receipts' counts, or, when
// only postponed questions are left, how many remain and that closing loses the ask, with "Go to the
// first". Its heading takes focus only from an act (`Board`), never when it renders. The text never
// says the tab can be closed or that the agent read anything (NFR-10); the counts come from the
// receipts alone (`completionOf`).

import { useStrings } from "../catalog/port.ts";
import { IconComplete } from "../icons/index.ts";
import type { Completion } from "./completion.ts";
import { BUTTON_SECONDARY, FOCUS_RING } from "./styles.ts";

export const COMPLETION_HEADING = "[data-askboard-completion-heading]";

type Shown = Exclude<Completion, { readonly kind: "none" | "send-all" }>;

const Heading = ({ children }: { readonly children: string }) => (
  <h2
    id="askboard-completion-title"
    tabIndex={-1}
    data-askboard-completion-heading=""
    className={`text-body-lg font-semibold text-foreground ${FOCUS_RING}`}
  >
    {children}
  </h2>
);

export const CompletionPanel = ({
  completion,
  onGoToFirst,
}: {
  readonly completion: Shown;
  readonly onGoToFirst: (questionId: string) => void;
}) => {
  const text = useStrings();
  return (
    <section
      data-askboard-completion={completion.kind}
      aria-labelledby="askboard-completion-title"
      className="flex flex-col gap-sm rounded-lg border border-border bg-muted p-md"
    >
      {completion.kind === "done" ? (
        <>
          <div className="flex items-center gap-sm">
            <IconComplete className="size-5 shrink-0 text-success-text" />
            <Heading>{text("completion.title")}</Heading>
          </div>
          <p className="text-body text-foreground-secondary">
            {text("completion.counts", { s: completion.sent, d: completion.delivered })}
          </p>
        </>
      ) : (
        <>
          <Heading>{text("completion.postponed", { count: completion.count })}</Heading>
          <div>
            <button
              type="button"
              className={BUTTON_SECONDARY}
              onClick={() => onGoToFirst(completion.first)}
            >
              {text("completion.goToFirst")}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
