// The view shell's entry, bundled into the shell chunk (design decisions 7 and 8). It provides the
// `CatalogRenderer` port to the component chunks, which run after it, and boots once the srcdoc
// has parsed, when every chunk has run: it reads the `askboard-data` block, connects ext-apps'
// `App` to the board page when it has a parent (a Snapshot has none, AD-9), taking it from the
// shared-module registry only then, so no ext-apps code is needed without a host (snapshot design
// decision 5), and renders the board
// through AskBoard's own renderer, with the draft record and the ready tracker. The theme starts
// as the system's and then follows the board page's; with no parent it follows the system
// (EXPERIENCE.md, Dark theme). Since the ask lifecycle (ask-lifecycle, design decision 6): the
// lifecycle draft beside the draft record, both mirrored to the board page after each change and
// restored from what it hands back; the latest board document from its updates, each revision
// remembered; a question the agent deleted leaves with its draft, and the question in view and the
// focus move on from it; the commands the user sent, whose work is cleared once the board page
// settles them as done, and whose "Keep mine" is then remembered; and what the user has not seen
// yet. The style-element shim is installed first, so the mode-switch confirmation's scroll lock
// runs under the view's policy (S-6). Push delivery's part, the context header's data and the
// user's activity for the board's working signal, starts beside them (`push-extras.ts`).

import type * as ExtApps from "@modelcontextprotocol/ext-apps";
import { createRoot } from "react-dom/client";
import { BOOT_DATA_ID, parseBootData } from "../boot-data.ts";
import * as port from "../catalog/port.ts";
import { FrameTransport } from "../frame-transport.ts";
import { provide, shared } from "../shared-modules.ts";
import {
  applyDensity,
  applyTheme,
  DARK_QUERY,
  followSystemTheme,
  resolveTheme,
  systemTheme,
  type Theme,
} from "../theme.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import { readDraftReply, type ViewMessage } from "../view-protocol.ts";
import { createRevisions, type KeptChoices, type ShownOf, shownOfBoard } from "./agent-change.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createAttention } from "./attention.ts";
import {
  Board,
  type BoardExtras,
  type BoardView,
  type HeadingRequest,
  requestHeading,
} from "./board.tsx";
import { createAnsweredResults, createBoardContent } from "./board-content.ts";
import {
  type BoardDraft,
  connectDrafts,
  createBoardDraft,
  draftRecordOf,
  restoreDraft,
} from "./board-draft.ts";
import { BoardLanguage } from "./board-language.tsx";
import { nextAfterRemoval, presentationOf } from "./board-view.ts";
import { dropWork } from "./card-acts.ts";
import { clearCarried } from "./carried.ts";
import { dropStaleCellEntries } from "./cell-entries.ts";
import { NO_CHANNEL, openChannel, type ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore, type DraftStore } from "./draft-store.ts";
import { dropStaleEntries } from "./entries.ts";
import { focusOpener } from "./focus-opener.ts";
import { measureInset } from "./measure-inset.ts";
import { snapshotTitleOf } from "./opened-snapshot.ts";
import { startPresentation } from "./presentation-extras.ts";
import { startPushExtras } from "./push-extras.ts";
import { createReadyTracker, questionItemsOf } from "./ready-tracker.ts";
import type { ReasonRequest } from "./reason.ts";
import { createSizeNotices, settle } from "./size-notices.ts";
import { createSnapshotControl } from "./snapshot-control.ts";
import { createStore, type Store } from "./store.ts";
import { shimStyleElements } from "./style-shim.ts";
import type { ThemeChoice } from "./theme-control.tsx";
import type { ThreadRequest } from "./thread.tsx";
import { createChunkInstaller } from "./view-chunks.ts";
import { workRefsOf } from "./work-refs.ts";

/** The name component chunks import the port by; the view build maps it to this chunk's copy. */
const CATALOG_PORT = "@askboard/view/catalog";

provide(CATALOG_PORT, port);

const VIEW_INFO = { name: "askboard-view", version: "0.0.0" };

// The view fills its frame, which the board page sizes: no size notifications. ext-apps' `App`
// comes from its host-only chunk, which only a board loads; the shell imports its type alone.
const connectToBoardPage = (): ViewChannel => {
  const { App } = shared("@modelcontextprotocol/ext-apps") as Pick<typeof ExtApps, "App">;
  const app = new App(VIEW_INFO, {}, { autoResize: false });
  const policy =
    document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ??
    "";
  const install = createChunkInstaller(document, policy);
  return openChannel(
    app,
    () => app.connect(new FrameTransport(window.parent, window)),
    (update) => install(update.chunks ?? []),
  );
};

// The question whose card holds the focus, if any.
const focusedQuestion = (): string | undefined =>
  document.activeElement
    ?.closest("[data-askboard-question]")
    ?.getAttribute("data-askboard-question") ?? undefined;

type Removal = {
  readonly draft: DraftStore;
  readonly results: DraftStore;
  readonly entries: DraftStore;
  readonly cellEntries: DraftStore;
  readonly board: BoardDraft;
  // The question as the card shows it: a deleted question's work goes with the items of the
  // revision it was made on (document-review, design decision 15).
  readonly shownOf: ShownOf;
  readonly focus: Store<HeadingRequest | undefined>;
  readonly removed: Store<boolean>;
};

// The agent deleted questions (FR-6; task 6.7): each leaves with its draft; the question in view
// moves on to the next one, saying so, and so does the focus if one of them held it.
const onRemoval = (before: ViewDocument, after: ViewDocument, stores: Removal): void => {
  const earlier = questionsOf(before);
  const now = questionsOf(after).map((question) => question.id);
  const gone = earlier.filter((question) => !now.includes(question.id));
  if (gone.length === 0) return;
  const focused = focusedQuestion();
  for (const question of gone) dropWork(question, stores);
  const ids = earlier.map((question) => question.id);
  const isGone = (id: string | undefined) => gone.some((question) => question.id === id);
  const inView = stores.board.get().inView;
  if (inView !== undefined && isGone(inView)) {
    stores.board.setInView(nextAfterRemoval(ids, now, inView));
    stores.removed.set(true);
  }
  if (focused !== undefined && isGone(focused)) {
    const next = nextAfterRemoval(ids, now, focused);
    if (next !== undefined) requestHeading(stores.focus, next);
  }
};

const boot = (): void => {
  shimStyleElements();
  const data = parseBootData(document.getElementById(BOOT_DATA_ID)?.textContent);
  const root = document.getElementById("root");
  if (root === null) throw new Error("the view has no #root element");
  const hosted = window.parent !== window;
  // A Snapshot has no parent and its data holds its record: it opens read-only (design decision 9).
  const opened = hosted ? undefined : data.snapshot;
  // The ask's title is agent text: it goes into the tab through the DOM, never through markup.
  if (opened !== undefined) document.title = snapshotTitleOf(data.document.title);
  const setTheme = (theme: Theme) => applyTheme(document.documentElement, theme);
  const scheme = window.matchMedia(DARK_QUERY);
  // The presentation the board page had at boot sets theme and density before the first render.
  const presentation = data.presentation;
  applyDensity(document.documentElement, presentation?.density ?? "compact");
  if (hosted) setTheme(resolveTheme(presentation?.theme ?? "system", scheme.matches));
  // An opened Snapshot's Theme control picks the system's theme or one fixed, and saves nothing.
  const choice = createStore<ThemeChoice>("system");
  const themeOf = (system: Theme): Theme =>
    choice.get() === "system" ? system : (choice.get() as Theme);
  if (!hosted) followSystemTheme(scheme, (system) => setTheme(themeOf(system)));
  choice.subscribe(() => setTheme(themeOf(systemTheme(scheme))));
  const channel = hosted ? connectToBoardPage() : NO_CHANNEL;
  channel.onTheme(setTheme);
  const view = createStore<BoardView>({ document: data.document, state: data.state });
  const draft = createDraftStore();
  // The results the widget items hold, beside the draft record (widget-registry, design decision 9).
  const results = createDraftStore();
  // The text the NumberField, MoneyField and DateField cannot read, beside them (atoms, decision 3).
  const entries = createDraftStore();
  // The text a Table's cells cannot read, by item and cell, beside them (table-widget, decision 8).
  const cellEntries = createDraftStore();
  const single = presentationOf(data.document) === "single";
  const board = createBoardDraft(single ? "immediate" : (data.document.delivery ?? "immediate"));
  const revisions = createRevisions();
  revisions.record(data.document);
  // The question as the card shows it: the draft's readers walk the items of the revision the
  // work was made on too, after "Keep mine" (document-review, design decision 15).
  const shownOf = shownOfBoard(board, revisions);
  connectDrafts(() => view.get().document, draft, board, results, entries, cellEntries, shownOf);
  const acts = createAnswerActs();
  const attention = createAttention(data.document, data.state);
  const kept = createStore<KeptChoices>(new Map());
  const threads = createStore<ThreadRequest | undefined>(undefined);
  const reasons = createStore<ReasonRequest | undefined>(undefined);
  const focus = createStore<HeadingRequest | undefined>(undefined);
  const removed = createStore(false);
  // The lines for a message too large: a command refused or closed, a draft left out; an act
  // line goes when its question's work changes (oversized-acts, design decisions 2 to 4).
  const notices = createSizeNotices((questionId) => {
    const question = questionsOf(view.get().document).find((each) => each.id === questionId);
    return question === undefined ? [] : workRefsOf(question, { draft, results, entries, board });
  });
  for (const store of [draft, results, entries, board]) store.subscribe(notices.sync);
  // The board page's reply to a draft names the questions it left out of the record it mirrors.
  const report = (message: ViewMessage): void => {
    channel
      .send(message)
      .then((reply) => {
        const leftOut = message.type === "draft" ? readDraftReply(reply) : undefined;
        if (leftOut !== undefined) notices.draftReply(leftOut);
      })
      .catch((error: unknown) => {
        console.error(`askboard: the board page did not take the view's ${message.type}:`, error);
      });
  };
  const tracker = createReadyTracker(questionItemsOf(data.document), {
    onVisible: (questionId) => report({ type: "ready", itemId: questionId }),
    onFailed: (_questionId, itemId, error) => report({ type: "item-error", itemId, error }),
  });
  let restored = 0;
  let closedPanel = 0;
  channel.onUpdate((update) => {
    if (update.presentation !== undefined) {
      applyDensity(window.document.documentElement, update.presentation.density);
    }
    const before = view.get().document;
    const document = update.document ?? before;
    if (update.document !== undefined) {
      revisions.record(document);
      onRemoval(before, document, {
        draft,
        results,
        entries,
        cellEntries,
        board,
        shownOf,
        focus,
        removed,
      });
      dropStaleEntries(document, entries);
      dropStaleCellEntries(document, cellEntries);
      tracker.include(questionItemsOf(document));
      attention.documentChanged(document);
    }
    view.set({ document, state: update.state, lock: update.lock, connection: update.connection });
    attention.stateChanged(update.state);
    if (update.panelClosed !== undefined && update.panelClosed.id > closedPanel) {
      closedPanel = update.panelClosed.id;
      focusOpener(update.panelClosed.itemId);
    }
    if (update.restore !== undefined && update.restore.id > restored) {
      restored = update.restore.id;
      restoreDraft(
        update.restore.record,
        document,
        update.state,
        draft,
        board,
        results,
        undefined,
        entries,
        cellEntries,
      );
    }
    // Commands the board page dropped because their socket was closed as too large: said before
    // `reconcile` settles them, which keeps the work in the draft as for any refusal.
    for (const flight of settle(acts, update.pending ?? [], update.settled ?? [], notices)) {
      clearCarried(flight, document, draft, results, entries, cellEntries, board, kept, revisions);
    }
  });
  // The draft mirror: the whole record after each change of either store, once per task (AD-20).
  let mirroring = false;
  const mirror = () => {
    if (!hosted || mirroring) return;
    mirroring = true;
    queueMicrotask(() => {
      mirroring = false;
      report({
        type: "draft",
        record: draftRecordOf(
          view.get().document,
          draft.record(),
          board.get(),
          results.record(),
          entries.record(),
          cellEntries.record(),
          shownOf,
        ),
      });
    });
  };
  draft.subscribe(mirror);
  results.subscribe(mirror);
  entries.subscribe(mirror);
  cellEntries.subscribe(mirror);
  board.subscribe(mirror);
  const context = {
    draft,
    results,
    entries,
    cellEntries,
    tracker,
    channel,
    acts,
    notices,
    board,
    attention,
    revisions,
    kept,
    threads,
    reasons,
    focus,
    removed,
    // The board components read follows the latest document, which an agent update replaces, and
    // the answers of the latest board state (molecules, design decision 11).
    boardContent: createBoardContent(() => view.get()),
    answeredResult: createAnsweredResults(() => view.get()),
    derived: createDerivedStore(),
    opened,
  };
  // What a component asks of the board page: a reference opened by its item, never by its target.
  const host: port.ViewHost = {
    hosted,
    openReference: (itemId) => report({ type: "open-reference", itemId, inset: measureInset() }),
    openLink: (itemId, url) => report({ type: "open-link", itemId, url }),
  };
  const controls = startPresentation(data, channel, {
    hosted,
    report,
  });
  // The presentation's placement is the board's default; a question's own control overrides it.
  const followPlacement = () =>
    board.setDefaultPlacement(controls.presentation.get().contextPlacement);
  followPlacement();
  controls.presentation.subscribe(followPlacement);
  const extras: BoardExtras = {
    header: startPushExtras(data, channel, hosted, report),
    presentation: controls,
    snapshot: createSnapshotControl(channel),
    ...(opened === undefined ? {} : { theme: choice }),
  };
  createRoot(root).render(
    <BoardLanguage view={view}>
      <port.HostContext.Provider value={host}>
        <Board view={view} context={context} extras={extras} />
      </port.HostContext.Provider>
    </BoardLanguage>,
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
