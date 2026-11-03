// The context header's data in the view (design decision 12): who asked and where and the agent
// status, from the `askboard-data` block, then from each update of the board page that carries
// them. An update that carries neither, or changes nothing, keeps the same value, so the header's
// parts do not render again.

import type { AgentStatus } from "@askboard/contract";
import type { HeaderOrigin, ViewUpdate } from "../view-protocol.ts";

export type HeaderData = {
  readonly origin?: HeaderOrigin;
  readonly agent?: AgentStatus;
};

const sameOrigin = (a: HeaderOrigin | undefined, b: HeaderOrigin | undefined): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** The header's data after the boot block or an update, the previous value when nothing changed. */
export const headerDataOf = (
  previous: HeaderData,
  update: Pick<ViewUpdate, "origin" | "agent">,
): HeaderData => {
  const origin = update.origin ?? previous.origin;
  const agent = update.agent ?? previous.agent;
  if (sameOrigin(origin, previous.origin) && agent === previous.agent) return previous;
  return {
    ...(origin === undefined ? {} : { origin }),
    ...(agent === undefined ? {} : { agent }),
  };
};
