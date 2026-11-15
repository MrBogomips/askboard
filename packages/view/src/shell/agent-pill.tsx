// The agent pill (view spec, "The agent pill"; EXPERIENCE, State pill; DESIGN.md, State pill and
// Colors, Markers; AD-4; design decision 12): "Agent: Working" or "Agent: Waiting for your answer",
// as `board-host` last reported it, presence only and never an ask state. It is no live region: a
// change to waiting is announced through the board's status region (answering-flow-fixes, design
// decision 4; #182), a change to working says nothing. It shows nothing until the first report.

import type { AgentStatus } from "@askboard/contract";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
import type { HeaderData } from "./header-data.ts";
import type { StatusMessages } from "./status-messages.ts";
import type { Store } from "./store.ts";

const PILLS = {
  working: {
    label: "agent.working",
    pill: "border-transparent bg-agent-subtle text-agent-text",
    // A filled dot: working (DESIGN.md, Markers).
    marker: "size-2 rounded-full bg-agent",
  },
  waiting: {
    label: "agent.waiting",
    pill: "border-border bg-muted text-foreground-secondary",
    // A hollow ring: waiting is neutral grey, and never colour alone.
    marker: "size-2 rounded-full border border-agent-waiting",
  },
} as const satisfies Record<AgentStatus, unknown>;

export const AgentPill = ({
  header,
  status,
}: {
  readonly header: Store<HeaderData>;
  readonly status: Pick<StatusMessages, "announce">;
}) => {
  const { agent } = useSyncExternalStore(header.subscribe, header.get, header.get);
  const text = useStrings();
  // A change to waiting is announced; the first report, which is no change, is not.
  const before = useRef<AgentStatus | undefined>(undefined);
  useEffect(() => {
    if (before.current !== undefined && before.current !== agent && agent === "waiting") {
      status.announce({ key: "agent.waiting" });
    }
    before.current = agent;
  }, [agent, status]);
  const shown = agent === undefined ? undefined : PILLS[agent];
  return (
    <span data-askboard-agent-pill="" className="inline-flex">
      {shown === undefined ? null : (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-badge ${shown.pill}`}
        >
          <span aria-hidden="true" className={`shrink-0 ${shown.marker}`} />
          {text(shown.label)}
        </span>
      )}
    </span>
  );
};
