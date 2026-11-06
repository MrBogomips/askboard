// Whether the link between two drawn tasks is on the critical path (design decision 9): both tasks
// are critical and the link is tight, the successor starting on the working day after the
// predecessor finishes. Two critical tasks may be joined by a link with slack, a successor held
// back by another predecessor or by a requested start; that link is drawn plain. A milestone
// finishes the working day before it starts, so the same rule holds for it. Plain ECMAScript: the
// calendar is `compute`'s.

import { workingDaysBetween } from "@askboard/compute";

/** What a link needs of a drawn task. */
type LinkEnd = { readonly start: string; readonly finish: string; readonly critical: boolean };

/** Whether the link from `from` to `to` is critical. */
export const isCriticalLink = (from: LinkEnd, to: LinkEnd): boolean =>
  from.critical && to.critical && workingDaysBetween(from.finish, to.start) === 1;
