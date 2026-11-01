// The board page's presence message (design decision 10; board-host spec, Working boards): each
// live board says whether the user is working on it, a flag and nothing else. It is a standalone
// schema of push delivery's (design decision 1), so it is checked with the contract's
// `validatePresence` before E1's page messages; one that fails is refused as E1 refuses a message
// on a live board, and the socket stays open.

import type { LifecycleHostMessage } from "@askboard/contract";
import { validatePresence } from "@askboard/contract/validate";
import { problemsDetail, refusedMessage } from "./messages.ts";

/** The working flag a presence message carries, or the refusal it gets. */
export const presenceOf = (
  value: unknown,
): { readonly working: boolean } | LifecycleHostMessage => {
  const checked = validatePresence(value);
  if (checked.ok) return { working: checked.value.working };
  const reason = checked.reason === "version" ? "version" : "message";
  return refusedMessage(reason, problemsDetail(checked.problems));
};
