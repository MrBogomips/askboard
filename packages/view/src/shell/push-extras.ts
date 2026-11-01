// Push delivery in the view (design decisions 10 and 12): the context header's store, from the
// `askboard-data` block and then from each update of the board page, as a subscriber of its own;
// and, in a hosted view, the user's keys and pointer reported to the board page as the activity
// message, since input inside the sandboxed view does not reach it, for the board's working signal.

import type { BootData } from "../boot-data.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createActivityReporter } from "./activity.ts";
import type { ViewChannel } from "./channel.ts";
import { type HeaderData, headerDataOf } from "./header-data.ts";
import { createStore, type Store } from "./store.ts";

/** Starts push delivery's part of the view, and gives the header's store. */
export const startPushExtras = (
  data: BootData,
  channel: ViewChannel,
  hosted: boolean,
  report: (message: ViewMessage) => void,
): Store<HeaderData> => {
  const header = createStore<HeaderData>(headerDataOf({}, data));
  channel.onUpdate((update) => header.set(headerDataOf(header.get(), update)));
  if (hosted) {
    const act = createActivityReporter(
      () => report({ type: "activity" }),
      () => performance.now(),
    );
    for (const type of ["keydown", "pointerdown"]) {
      document.addEventListener(type, act, { capture: true, passive: true });
    }
  }
  return header;
};
