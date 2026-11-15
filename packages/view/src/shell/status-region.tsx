// The status region (answering-flow-fixes, design decision 4; #182): one polite live region, outside
// the cards, that says what the answering flow did. Its text comes from the status store's
// descriptors through the ask's language, as text only (AD-8, NFR-5): an option's label or a
// question's title the message holds is data and never markup. The child is keyed by the count of
// announcements, so a repeated message is announced again.

import { useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
import type { StatusMessages } from "./status-messages.ts";

export const StatusRegion = ({ status }: { readonly status: StatusMessages }) => {
  const { n, messages } = useSyncExternalStore(status.subscribe, status.get);
  const text = useStrings();
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {messages.length === 0 ? null : (
        <span key={n}>
          {messages.map((message) => text(message.key, message.params)).join(" ")}
        </span>
      )}
    </div>
  );
};
