// Row 1 of the context header (view spec, "Who asked, and where", "The expected answerer in the
// header", "Agent text and paths in the header"; EXPERIENCE, Board anatomy and Agent-written labels;
// DESIGN.md, Context header; design decision 12): who asked on the left, then "For: <name>" when
// shown; the labelled fields Project, Directory, Branch and Worktree on the right, "—" for a field
// AskBoard does not know. Agent strings and paths render as text only, each isolated for
// bidirectional text and capped with an ellipsis; a cut one is focusable and shows its full text
// on hover and on keyboard focus. Controls in a path show as visible escapes, by the rule the
// notices use (the contract's `agentTextRuns`). The row keeps its height before the board page has
// sent who asked.

import { agentTextRuns } from "@askboard/contract";
import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { HeaderOrigin } from "../view-protocol.ts";
import type { HeaderData } from "./header-data.ts";
import type { Store } from "./store.ts";

/** What a field AskBoard does not know shows. */
const UNKNOWN = "—";

const FIELDS = [
  ["Project", "project"],
  ["Directory", "directory"],
  ["Branch", "branch"],
  ["Worktree", "worktree"],
] as const satisfies readonly (readonly [string, keyof HeaderOrigin])[];

// Who asked, each agent string isolated: "Main agent", "Subagent code-reviewer #2 · Retry review",
// "Teammate scout-2 · Retry review" (a teammate has no ordinal).
const WhoAsked = ({ who: { label, ordinal, name } }: { readonly who: HeaderOrigin["who"] }) => (
  <>
    <bdi>{label}</bdi>
    {ordinal === undefined ? null : ` #${ordinal}`}
    {name === undefined ? null : (
      <>
        {" · "}
        <bdi>{name}</bdi>
      </>
    )}
  </>
);

// A path, its controls shown as escapes apart from the text around them (DESIGN.md, Agent-written
// labels).
const Path = ({ value }: { readonly value: string }) => (
  <bdi>
    {agentTextRuns(value).map((run, index) =>
      run.escape ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one value never reorder.
        <span key={index} className="text-muted-foreground">
          {run.text}
        </span>
      ) : (
        run.text
      ),
    )}
  </bdi>
);

/**
 * Text capped with an ellipsis. When it is cut, it takes the keyboard focus and shows its full
 * text in a tooltip on hover and on focus; when it fits, it is plain text.
 */
const Clipped = ({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  const id = useId();
  // Measured after each render, as the text may change, and on each resize of the element.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element !== null) setCut(element.scrollWidth > element.clientWidth);
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setCut(element.scrollWidth > element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <span className="group relative inline-flex min-w-0">
      <span
        ref={ref}
        tabIndex={cut ? 0 : undefined}
        aria-describedby={cut ? id : undefined}
        className={`truncate rounded-sm focus-visible:outline-2 focus-visible:outline-ring ${className}`}
      >
        {children}
      </span>
      {cut ? (
        <span
          role="tooltip"
          id={id}
          className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-max max-w-[min(36rem,80vw)] rounded-md border border-border bg-popover px-2 py-1 font-sans text-body text-popover-foreground break-all whitespace-normal shadow-md group-focus-within:block group-hover:block"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
};

const Field = ({ label, value }: { readonly label: string; readonly value?: string }) => (
  <div className="flex min-w-0 items-baseline gap-1.5">
    <dt className="shrink-0 text-label text-muted-foreground uppercase">{label}</dt>
    <dd className="m-0 flex min-w-0 font-mono text-code text-foreground">
      {value === undefined ? (
        UNKNOWN
      ) : (
        <Clipped className="max-w-64">
          <Path value={value} />
        </Clipped>
      )}
    </dd>
  </div>
);

export const WhoAndWhere = ({ header }: { readonly header: Store<HeaderData> }) => {
  const { origin } = useSyncExternalStore(header.subscribe, header.get);
  return (
    <div data-askboard-header="who-and-where" className="flex h-8 min-w-0 items-center gap-4 px-4">
      {origin === undefined ? null : (
        <>
          <span className="flex min-w-0 items-baseline gap-3 text-body text-foreground">
            <Clipped className="max-w-80 font-semibold">
              <WhoAsked who={origin.who} />
            </Clipped>
            {/* A space between the parts, which flex layout ignores, keeps the row's text readable. */}
            {origin.forUser === undefined ? null : (
              <span className="flex min-w-0 items-baseline gap-1">
                {" "}
                <span className="shrink-0 text-muted-foreground">For:</span>{" "}
                <Clipped className="max-w-48">
                  <bdi>{origin.forUser}</bdi>
                </Clipped>
              </span>
            )}
          </span>
          <dl className="m-0 ml-auto flex min-w-0 items-baseline gap-4">
            {FIELDS.map(([label, key]) => (
              <Field key={key} label={label} value={origin[key]} />
            ))}
          </dl>
        </>
      )}
    </div>
  );
};
