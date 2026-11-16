// The context header's second row, the ask row (answering-flow-visual, design decision 1;
// EXPERIENCE.md, Context header; DESIGN.md, Context header): the ask's title and ID, the ask pill,
// the agent pill, the postponed warning while one is due, then the tools "Snapshot", "Keys",
// "Theme" and "Settings", the last three as icons named by their labels. The title gives up width
// first and ends in an ellipsis, its full text on hover and focus. The row has one height and nothing
// in it wraps. The title and the ID are agent text and render as text, the ID isolated from the
// row's order (AD-8).

import { useStrings } from "../catalog/port.ts";
import { IconSettings } from "../icons/index.ts";
import { AgentPill } from "./agent-pill.tsx";
import { BoardKeysButton, type BoardKeysProps } from "./board-keys-panel.tsx";
import type { AskPill as Pill } from "./board-view.ts";
import type { HeaderData } from "./header-data.ts";
import { AskPill, QuestionMarker } from "./markers.tsx";
import type { PresentationControls } from "./presentation-controls.ts";
import { SnapshotButton } from "./snapshot-button.tsx";
import type { SnapshotControl, SnapshotOffer } from "./snapshot-control.ts";
import type { StatusMessages } from "./status-messages.ts";
import type { Store } from "./store.ts";
import { BUTTON_ICON } from "./styles.ts";
import { ThemeControl } from "./theme-control.tsx";
import { Clipped } from "./who-and-where.tsx";

export type AskRowProps = {
  readonly title: string;
  readonly askId: string;
  readonly pill: Pill;
  readonly header: Store<HeaderData>;
  readonly status: Pick<StatusMessages, "announce">;
  readonly controls: PresentationControls;
  /** The ask is closed or discarded: no agent pill, which would be stale (review F-18). */
  readonly ended: boolean;
  /** The postponed warning, while a postponed question is open. */
  readonly warning: string | undefined;
  /** The Keys button and its panel: none on an ended board (board-keys, decision 5). */
  readonly keys: BoardKeysProps | undefined;
  /** "Snapshot": absent in an opened Snapshot, which would only repeat itself. */
  readonly snapshot:
    | { readonly control: SnapshotControl; readonly offer: SnapshotOffer }
    | undefined;
};

export const AskRow = ({
  title,
  askId,
  pill,
  header,
  status,
  controls,
  ended,
  warning,
  keys,
  snapshot,
}: AskRowProps) => {
  const text = useStrings();
  return (
    <div
      data-askboard-ask-row=""
      className="flex h-header-row min-w-0 items-center gap-md px-lg whitespace-nowrap"
    >
      <h1 className="m-0 flex min-w-0 flex-1 text-body-lg font-semibold text-foreground">
        <Clipped className="min-w-0 flex-1">{title}</Clipped>
      </h1>
      <span
        data-askboard-ask-id=""
        className="max-w-40 shrink truncate font-mono text-code text-muted-foreground"
      >
        <bdi>{askId}</bdi>
      </span>
      <AskPill pill={pill} />
      {ended ? null : <AgentPill header={header} status={status} />}
      {warning === undefined ? null : (
        <span data-askboard-warning="" className="flex shrink-0 items-center gap-1.5">
          <QuestionMarker mark="postponed" />
          <span className="text-body text-foreground">{warning}</span>
        </span>
      )}
      {snapshot === undefined ? null : (
        <SnapshotButton control={snapshot.control} offer={snapshot.offer} />
      )}
      {keys === undefined ? null : <BoardKeysButton {...keys} />}
      <ThemeControl controls={controls} />
      {controls.hosted ? (
        <button
          type="button"
          data-askboard-settings=""
          aria-label={text("toggles.settings")}
          title={text("toggles.settings")}
          className={BUTTON_ICON}
          onClick={controls.openSettings}
        >
          <IconSettings className="size-4" />
        </button>
      ) : null}
    </div>
  );
};
