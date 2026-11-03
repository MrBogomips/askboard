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
import { applyTheme, DARK_QUERY, followSystemTheme, systemTheme, type Theme } from "../theme.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createRevisions, type KeptChoices } from "./agent-change.ts";
import { createAnswerActs, type Flight } from "./answer-acts.ts";
import { createAttention } from "./attention.ts";
import {
  Board,
  type BoardExtras,
  type BoardView,
  type HeadingRequest,
  requestHeading,
} from "./board.tsx";
import { createBoardContent } from "./board-content.ts";
import {
  type BoardDraft,
  connectDrafts,
  createBoardDraft,
  draftRecordOf,
  itemIdsOf,
  type QuestionWork,
  restoreDraft,
} from "./board-draft.ts";
import { nextAfterRemoval, presentationOf } from "./board-view.ts";
import { dropWork } from "./card-acts.ts";
import { NO_CHANNEL, openChannel, type ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore, type DraftStore } from "./draft-store.ts";
import { focusOpener } from "./focus-opener.ts";
import { measureInset } from "./measure-inset.ts";
import { startPushExtras } from "./push-extras.ts";
import { createReadyTracker, questionItemsOf } from "./ready-tracker.ts";
import { createStore, type Store } from "./store.ts";
import { shimStyleElements } from "./style-shim.ts";
import type { ThreadRequest } from "./thread.tsx";

/** The name component chunks import the port by; the view build maps it to this chunk's copy. */
const CATALOG_PORT = "@askboard/view/catalog";

provide(CATALOG_PORT, port);

const VIEW_INFO = { name: "askboard-view", version: "0.0.0" };

// The view fills its frame, which the board page sizes: no size notifications. ext-apps' `App`
// comes from its host-only chunk, which only a board loads; the shell imports its type alone.
const connectToBoardPage = (): ViewChannel => {
  const { App } = shared("@modelcontextprotocol/ext-apps") as Pick<typeof ExtApps, "App">;
  const app = new App(VIEW_INFO, {}, { autoResize: false });
  return openChannel(app, () => app.connect(new FrameTransport(window.parent, window)));
};

// The work an act carried, which goes from the draft once the board page settles it as done: an
// answer, a decline or a note takes with it the undo it was held over.
const CARRIED: Readonly<Partial<Record<string, readonly (keyof QuestionWork)[]>>> = {
  answer: ["other", "optionNotes", "note", "held", "undo"],
  decline: ["other", "optionNotes", "note", "held", "undo"],
  postpone: ["held"],
  reopen: ["held"],
  note: ["note", "held", "undo"],
};

const clearCarried = (
  flight: Flight,
  document: ViewDocument,
  draft: DraftStore,
  board: BoardDraft,
  kept: Store<KeptChoices>,
): void => {
  for (const act of flight.acts) {
    const question = questionsOf(document).find((each) => each.id === act.itemId);
    if (question === undefined) continue;
    if (act.type === "edit-choice") {
      // "Keep mine" settles the notice for the revision it was about (task 6.7).
      if (act.edit === "ignore") {
        kept.set(new Map(kept.get()).set(act.itemId, { rev: act.rev, keptRev: act.keptRev }));
      }
      continue;
    }
    if (act.type === "follow-up") {
      // The composer's text went; Explain's follow-up leaves it.
      if (board.work(question.id)?.composer === act.text) board.clear(question.id, ["composer"]);
      continue;
    }
    const fields = CARRIED[act.type];
    if (fields === undefined) continue;
    if (act.type === "answer" || act.type === "decline") {
      for (const itemId of itemIdsOf(question)) draft.set(itemId, undefined);
    }
    board.clear(question.id, fields);
  }
};

// The question whose card holds the focus, if any.
const focusedQuestion = (): string | undefined =>
  document.activeElement
    ?.closest("[data-askboard-question]")
    ?.getAttribute("data-askboard-question") ?? undefined;

type Removal = {
  readonly draft: DraftStore;
  readonly board: BoardDraft;
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
  const setTheme = (theme: Theme) => applyTheme(document.documentElement, theme);
  const scheme = window.matchMedia(DARK_QUERY);
  if (hosted) setTheme(systemTheme(scheme));
  else followSystemTheme(scheme, setTheme);
  const channel = hosted ? connectToBoardPage() : NO_CHANNEL;
  channel.onTheme(setTheme);
  const view = createStore<BoardView>({ document: data.document, state: data.state });
  const draft = createDraftStore();
  const single = presentationOf(data.document) === "single";
  const board = createBoardDraft(single ? "immediate" : (data.document.delivery ?? "immediate"));
  connectDrafts(() => view.get().document, draft, board);
  const acts = createAnswerActs();
  const attention = createAttention(data.document, data.state);
  const revisions = createRevisions();
  revisions.record(data.document);
  const kept = createStore<KeptChoices>(new Map());
  const threads = createStore<ThreadRequest | undefined>(undefined);
  const focus = createStore<HeadingRequest | undefined>(undefined);
  const removed = createStore(false);
  const report = (message: ViewMessage): void => {
    channel.send(message).catch((error: unknown) => {
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
    const before = view.get().document;
    const document = update.document ?? before;
    if (update.document !== undefined) {
      revisions.record(document);
      onRemoval(before, document, { draft, board, focus, removed });
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
      restoreDraft(update.restore.record, document, update.state, draft, board);
    }
    for (const flight of acts.reconcile(update.pending ?? [], update.settled ?? [])) {
      clearCarried(flight, document, draft, board, kept);
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
        record: draftRecordOf(view.get().document, draft.record(), board.get()),
      });
    });
  };
  draft.subscribe(mirror);
  board.subscribe(mirror);
  const context = {
    draft,
    tracker,
    channel,
    acts,
    board,
    attention,
    revisions,
    kept,
    threads,
    focus,
    removed,
    // The board components read follows the latest document, which an agent update replaces, and
    // the answers of the latest board state (molecules, design decision 11).
    boardContent: createBoardContent(() => view.get()),
    derived: createDerivedStore(),
  };
  // What a component asks of the board page: a reference opened by its item, never by its target.
  const host: port.ViewHost = {
    hosted,
    openReference: (itemId) => report({ type: "open-reference", itemId, inset: measureInset() }),
  };
  const extras: BoardExtras = { header: startPushExtras(data, channel, hosted, report) };
  createRoot(root).render(
    <port.HostContext.Provider value={host}>
      <Board view={view} context={context} extras={extras} />
    </port.HostContext.Provider>,
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
