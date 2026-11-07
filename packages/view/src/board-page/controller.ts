// The board page's controller (design decision 8; design decision 5's close codes; AD-10, AD-21):
// one socket at a time, with the token first; the board document and the state, checked, into the
// model, and the view loaded once both are in; the receipts; reconnecting with backoff after an
// ordinary close, never on its own after 4403, 4409 or 4410; the banners, and the view locked while
// the board moved or once it is discarded. Since the ask lifecycle (ask-lifecycle, design decision
// 6): the view's answers and acts go as act commands, each with an action ID drawn here, held in
// the outbox until `board-host` acknowledges or refuses them and sent again with the same ID on a
// new socket; the view's draft record is mirrored to `board-host`, and the one it restores is
// handed to the view when the page has none of its own; a closed ask locks the board with its
// banner; "Copy my unsent work" and the leave-page prompt read the mirrored record. Protocol 1.1's
// host messages are handled in cases appended after E1's (design decision 8). Everything it
// touches comes in `BoardPageDeps`, so it runs without a browser; `start.ts` gives it the real
// socket, view, timers, clipboard and page. Push delivery adds who asked and where and the agent
// status, passed on to the view, and the view's activity, for the board's working signal (design
// decisions 10 and 12). The view's messages and `board-host`'s each have one entry in a table, so a
// change adding one adds its entry. The Snapshot (snapshot design decision 8) adds the view's
// request and the Closed banner's, each sent once and tracked in `snapshot-requests.ts`.

import {
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  DRAFT_RECORD_MAX_CHARS,
  DRAFT_RECORD_MAX_DEPTH,
  type DraftRecord,
  type LifecycleBoardDocument,
  type LifecycleStateMessage,
  type Locale,
  type PresentationSetting,
  type RefusedMessage,
  type SnapshotReply,
} from "@askboard/contract";
import type { BootData } from "../boot-data.ts";
import { htmlLang, languageOf, localeOf, t } from "../strings/index.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import type {
  ActReply,
  AnswerReply,
  DraftRestore,
  PanelClosed,
  SnapshotFeedback,
  SnapshotRequestReply,
  ViewItemError,
  ViewMessage,
  ViewOpenLink,
  ViewOpenReference,
  ViewPresentation,
  ViewReady,
  ViewSetting,
  ViewUpdate,
} from "../view-protocol.ts";
import { nestsWithin } from "../view-protocol.ts";
import {
  type Banner,
  type BoardStatus,
  bannerOf,
  connectionOf,
  INITIAL_STATUS,
  lockOf,
  nextStatus,
  type StatusEvent,
} from "./board-status.ts";
import { createDraftMirror, type DraftMirror } from "./draft-mirror.ts";
import type { BoardHostMessage } from "./host-messages.ts";
import { openLinkRefusal } from "./markdown-links.ts";
import {
  type ActsOrRefusal,
  actsFor,
  answerActFor,
  basisOf,
  bootDataOf,
  EMPTY_MODEL,
  stateProblem,
  withHostMessage,
  withViewMessage,
} from "./model.ts";
import {
  acknowledged,
  EMPTY_OUTBOX,
  flush,
  hasUnsent,
  hold,
  newActionId,
  pendingOf,
  refusedCommand,
  settleDone,
  withoutAll,
} from "./outbox.ts";
import type { ReadingPanel } from "./reading-panel.ts";
import { pathOf } from "./reading-panel-state.ts";
import { reconnectDelay } from "./reconnect.ts";
import { sourcePointerOf, webUrlOf } from "./references.ts";
import { type PanelData, panelData } from "./settings-panel-data.ts";
import {
  createSnapshotRequests,
  type SnapshotRequests,
  type SnapshotSource,
} from "./snapshot-requests.ts";
import type { BoardConnection, BoardSocketHandlers } from "./socket.ts";
import { tabTitle } from "./tab-title.ts";
import { hasUnsentWork, unsentWorkText } from "./unsent-work.ts";
import { hostMessageSchemas } from "./validators.ts";
import type { ViewReply } from "./view-host.ts";

/** What the controller uses of the hosted view. */
export type ViewHandle = { update(update: ViewUpdate): void };

/** What the board page does with each of the view's messages, by type. */
type ViewHandlers = {
  readonly [T in ViewMessage["type"]]: (
    message: Extract<ViewMessage, { readonly type: T }>,
  ) => ViewReply;
};

/** What the board page does with each message `board-host` sends, by type. */
type HostHandlers = {
  readonly [T in BoardHostMessage["type"]]: (
    message: Extract<BoardHostMessage, { readonly type: T }>,
  ) => void;
};

export type BoardPageDeps = {
  /** Opens a socket to `board-host`, which sends `connect` with the token once open. */
  readonly connect: (events: BoardSocketHandlers) => BoardConnection;
  /** Loads the view for the board and hosts it, its messages going to `handle`. */
  readonly openView: (
    data: BootData,
    handle: (message: ViewMessage) => Promise<ViewReply>,
  ) => Promise<ViewHandle>;
  /** Runs `run` after `ms`; returns what cancels it. */
  readonly schedule: (ms: number, run: () => void) => () => void;
  readonly showBanner: (banner: Banner | undefined) => void;
  /** Says the view did not load, or, with undefined, that it did. */
  readonly showLoadError: (error: string | undefined) => void;
  readonly setTitle: (title: string) => void;
  /** Sets the page's `lang` to the board's language (settings-languages design decision 9). */
  readonly setLanguage: (lang: "en" | "it") => void;
  /**
   * Applies the presentation the settings give to the board page itself: its root's theme and
   * density classes, and the system scheme it follows only under `system`.
   */
  readonly applyPresentation?: (presentation: ViewPresentation) => void;
  /**
   * Shows the settings panel with these rows, or closes it with undefined: opened by the view's
   * "Settings", and shown again after each change of the settings while it is open
   * (settings-languages, design decision 10).
   */
  readonly showSettings?: (panel: PanelData | undefined) => void;
  /** Reports what the user does not need to see, such as a message the board page refused. */
  readonly log: (text: string, detail?: unknown) => void;
  /** Puts text on the clipboard, on the user's click (F-17). */
  readonly copyText: (text: string) => Promise<void>;
  /** Draws an action ID; 22 random base64url characters by default (AD-20). */
  readonly newActionId?: () => string;
  /** The view's activity message: an input in the view, for the board's working signal. */
  readonly onActivity?: () => void;
  /** Opens a web page in a new tab with no opener and no referrer, on the user's click (AD-8). */
  readonly openLink?: (url: string) => void;
  /** The reading panel: a side sheet on the page that frames a source (excerpts). */
  readonly readingPanel?: ReadingPanel;
  /** Shows how the Closed banner's Snapshot request ended, beside its action. */
  readonly showSnapshot: (feedback: SnapshotFeedback) => void;
};

export type BoardPage = {
  /** "Continue here" on a moved board: reconnects, which takes the board back. */
  continueHere(): void;
  /** The page is going away: no reconnect from now on. */
  suspend(): void;
  /** The page is back, as from the back-forward cache: reconnects if it was retrying. */
  resume(): void;
  /** The page is hidden or going away: the draft record goes now (AD-20). */
  flushDraft(): void;
  /** "Copy my unsent work": the mirrored draft record, as text, on the clipboard (F-17). */
  copyUnsentWork(): Promise<void>;
  /**
   * The Closed banner's "Snapshot": the board, taken as the user's (FR-26). Says whether the
   * request went, and whether the board held unsent work, or why it did not go.
   */
  takeSnapshot(): SnapshotRequestReply;
  /**
   * Whether the browser's leave-page prompt is armed: while the draft holds unsent work or a
   * command is held, and while postponed questions are open on an open ask (L57, L172, FR-25).
   */
  leavePromptArmed(): boolean;
  /** The settings panel's choice of a presentation key: what a quick toggle does. */
  setPresentation(setting: PresentationSetting): ViewReply;
  /** The settings panel was closed: the view is asked to focus "Settings". */
  closeSettings(): void;
};

const refusal = (detail: string): AnswerReply => ({ outcome: "refused", detail });

const version = BOARD_PROTOCOL_VERSION;

// The first question of a draft record that the board does not hold at or after the revision its
// work names; board-host checks the record whole (`draftRecordProblems`), which the board page
// cannot import, since the contract's validation compiles schemas at run time.
const strangeQuestion = (
  record: DraftRecord,
  document: LifecycleBoardDocument,
): string | undefined => {
  const questions = questionsOf(document as ViewDocument);
  for (const [key, work] of Object.entries(record.questions)) {
    const question = questions.find((each) => each.id === key);
    if (question === undefined) return `/questions/${key}: "${key}" names no question of the ask`;
    if (work.rev > question.rev) {
      return `/questions/${key}/rev: the question is at revision ${question.rev}, not ${work.rev}`;
    }
  }
  return undefined;
};

// Why the board page refuses a draft record from the view, if it does: what the board protocol's
// schema, its limit, and the board document refuse (AD-20).
const draftRefusal = (
  record: DraftRecord,
  document: LifecycleBoardDocument | undefined,
): string | undefined => {
  if (!nestsWithin(record, DRAFT_RECORD_MAX_DEPTH)) {
    return `the draft record is nested deeper than ${DRAFT_RECORD_MAX_DEPTH} levels`;
  }
  const check = hostMessageSchemas.draft;
  if (!check({ version, type: "draft", record })) {
    const [first] = check.errors ?? [];
    return `the draft record is not one the board protocol takes: ${first?.instancePath || "/"} ${first?.message ?? "is invalid"}`;
  }
  if (JSON.stringify(record).length > DRAFT_RECORD_MAX_CHARS) {
    return `the draft record is longer than ${DRAFT_RECORD_MAX_CHARS} characters`;
  }
  if (document === undefined) return "there is no board yet";
  return strangeQuestion(record, document);
};

class BoardPageController implements BoardPage {
  readonly #deps: BoardPageDeps;
  readonly #draw: () => string;
  readonly #mirror: DraftMirror;
  #model = EMPTY_MODEL;
  #outbox = EMPTY_OUTBOX;
  #status: BoardStatus = INITIAL_STATUS;
  // Work the board ended with unsent: the closed and discarded banners say so.
  #unsent = false;
  #socket: BoardConnection | undefined;
  // Whether the current socket's state has come, which makes the board live.
  #stateSeen = false;
  #attempt = 0;
  #cancelRetry: (() => void) | undefined;
  #suspended = false;
  #view: ViewHandle | undefined;
  // The document the view booted with: a later one goes to it in the updates.
  #booted: ViewDocument | undefined;
  #loading = false;
  // A failed load is tried again on the next socket, not on every message.
  #mayLoad = true;
  // The draft record board-host restored, while the page has none of its own.
  #restore: DraftRestore | undefined;
  #restores = 0;
  // The settings panel: whether it is open, and how many times it has closed (the view focuses
  // "Settings" on each).
  #settingsOpen = false;
  #settingsClosed = 0;
  // The reading panel's latest closing by the user, which the view acts on once.
  #closed: PanelClosed | undefined;
  #closings = 0;
  readonly #snapshots: SnapshotRequests;
  // How the view's latest Snapshot request ended, in each update from then on.
  #snapshot: SnapshotFeedback | undefined;

  constructor(deps: BoardPageDeps) {
    this.#deps = deps;
    this.#draw = deps.newActionId ?? (() => newActionId());
    this.#mirror = createDraftMirror({
      schedule: deps.schedule,
      send: (record) =>
        this.#status.kind === "live" &&
        this.#socket?.send({ version, type: "draft", record }) === true,
    });
    this.#snapshots = createSnapshotRequests({
      schedule: deps.schedule,
      end: (source, feedback) => this.#snapshotEnded(source, feedback),
    });
    this.#open();
  }

  continueHere(): void {
    if (this.#status.kind !== "moved") return;
    this.#socket?.close();
    this.#socket = undefined;
    this.#snapshots.drop();
    this.#stateSeen = false;
    this.#attempt = 0;
    this.#transition({ type: "continue" });
    this.#open();
  }

  suspend(): void {
    this.#suspended = true;
    this.#cancelRetry?.();
    this.#cancelRetry = undefined;
  }

  resume(): void {
    this.#suspended = false;
    if (this.#status.kind === "retrying" || this.#status.kind === "connecting") this.#open();
  }

  // The language of the board page's own strings: the board document's, so English until the
  // first board arrives (settings-languages design decision 9, B13).
  #language(): Locale {
    return languageOf(this.#model.document);
  }

  flushDraft(): void {
    this.#mirror.flush();
  }

  async copyUnsentWork(): Promise<void> {
    const document = this.#model.document as ViewDocument | undefined;
    if (document === undefined) return;
    try {
      await this.#deps.copyText(unsentWorkText(document, this.#mirror.latest(), this.#language()));
    } catch (error) {
      this.#deps.log("the unsent work could not be copied", error);
    }
  }

  takeSnapshot(): SnapshotRequestReply {
    const reply = this.#takeSnapshot("banner");
    if (reply.outcome === "refused") this.#deps.log(`no Snapshot was requested: ${reply.detail}`);
    return reply;
  }

  leavePromptArmed(): boolean {
    if (this.#status.kind === "moved") return false;
    if (hasUnsentWork(this.#mirror.latest()) || this.#outbox.held.length > 0) return true;
    const ended = this.#status.kind === "closed" || this.#status.kind === "discarded";
    const state = this.#model.state;
    return (
      !ended &&
      state !== undefined &&
      state.ask !== "closed" &&
      state.questions.some((question) => question.state === "postponed")
    );
  }

  // The state, the lock, the connection, the commands held and settled, a later document and a
  // restore: the view settles its acts on them, so a card is never stuck at a receipt (AD-10).
  // What the model passes on goes with them as it is: who asked and where and the agent status,
  // once `board-host` has sent them (design decision 12), and each later field (review M4).
  #updateView(): void {
    const { state, document } = this.#model;
    if (this.#view === undefined || state === undefined) return;
    const lock = lockOf(this.#status);
    const connection = connectionOf(this.#status);
    const pending = pendingOf(this.#outbox);
    const { settled } = this.#outbox;
    this.#view.update({
      type: "state",
      state,
      ...(document === undefined || document === this.#booted
        ? {}
        : { document: document as ViewDocument }),
      ...(lock === undefined ? {} : { lock }),
      ...(connection === undefined ? {} : { connection }),
      ...(pending.length === 0 ? {} : { pending }),
      ...(settled.length === 0 ? {} : { settled }),
      ...(this.#restore === undefined ? {} : { restore: this.#restore }),
      ...(this.#settingsClosed === 0 ? {} : { settingsClosed: this.#settingsClosed }),
      ...(this.#closed === undefined ? {} : { panelClosed: this.#closed }),
      ...(this.#snapshot === undefined ? {} : { snapshot: this.#snapshot }),
      ...this.#model.passedOn,
    });
  }

  #transition(event: StatusEvent): void {
    const before = this.#status;
    this.#status = nextStatus(before, event);
    if (this.#status === before) return;
    // A moved or discarded board shows nothing of its source; a closed one stays readable.
    if (this.#status.kind === "moved" || this.#status.kind === "discarded") {
      this.#deps.readingPanel?.close();
    }
    if (this.#status.kind === "discarded" || this.#status.kind === "closed") {
      this.#unsent = hasUnsentWork(this.#mirror.latest()) || hasUnsent(this.#outbox);
      this.#outbox = withoutAll(this.#outbox);
    }
    this.#deps.showBanner(bannerOf(this.#status, this.#unsent, this.#language()));
    this.#updateView();
  }

  readonly #onViewMessage = async (message: ViewMessage): Promise<ViewReply> => {
    const handle = this.#viewHandlers[message.type] as (message: ViewMessage) => ViewReply;
    return handle(message);
  };

  // What the board page does with each of the view's messages, by type: E1's answer, ready and
  // item error; the ask lifecycle's act command and draft record; push delivery's activity.
  readonly #viewHandlers: ViewHandlers = {
    answer: (message) => this.#command(answerActFor(this.#model, message)),
    ready: (message) => this.#viewReport(message),
    "item-error": (message) => this.#viewReport(message),
    act: (message) => this.#command(actsFor(this.#model, message.acts)),
    draft: (message) => this.#takeDraft(message.record),
    activity: () => {
      this.#deps.onActivity?.();
      return {};
    },
    setting: (message) => this.#setting(message),
    "open-settings": () => {
      this.#deps.readingPanel?.close();
      this.#settingsOpen = true;
      this.#showSettings();
      return {};
    },
    "open-reference": (message) => this.#openReference(message),
    "open-link": (message) => this.#openLink(message),
    snapshot: () => this.#takeSnapshot("view"),
  };

  // A toggle's value: applied to the board at once, then sent to board-host to be written as the
  // user's setting. A key the project sets is refused here and by ask-core (AD-14). The value
  // stays on this board whatever the write does (design decision 6).
  setPresentation(setting: PresentationSetting): ViewReply {
    return this.#setting({ type: "setting", ...setting });
  }

  closeSettings(): void {
    if (!this.#settingsOpen) return;
    this.#settingsOpen = false;
    this.#settingsClosed += 1;
    this.#deps.showSettings?.(undefined);
    this.#updateView();
  }

  // The panel's rows for the settings and presentation in effect, while it is open.
  #showSettings(): void {
    const { settings, passedOn, document } = this.#model;
    const { presentation } = passedOn;
    if (!this.#settingsOpen || settings === undefined || presentation === undefined) return;
    this.#deps.showSettings?.(
      panelData(settings, presentation, languageOf(document), localeOf(document)),
    );
  }

  #setting(message: ViewSetting): ViewReply {
    const presentation = this.#model.passedOn.presentation;
    if (presentation?.locked.includes(message.key)) {
      return refusal(`${message.key} is set by the project file`);
    }
    const ended = this.#ended();
    if (ended !== undefined) return refusal(ended);
    if (presentation !== undefined) {
      const next = { ...presentation, [message.key]: message.value };
      this.#model = { ...this.#model, passedOn: { ...this.#model.passedOn, presentation: next } };
      this.#deps.applyPresentation?.(next);
      this.#updateView();
      this.#showSettings();
    }
    const sent = this.#socket?.send({ version, ...message }) === true;
    return { outcome: sent ? "sent" : "not-sent" };
  }

  // A click on a reference or an excerpt's "Open in reading panel", read from the board document
  // the page holds: a web page opens in a new tab, a file in the reading panel (AD-8).
  #openReference({ itemId, inset }: ViewOpenReference): ViewReply {
    const document = this.#model.document as ViewDocument | undefined;
    const url = webUrlOf(document, itemId);
    if (url !== undefined) {
      this.#deps.openLink?.(url);
      return {};
    }
    const pointer = sourcePointerOf(document, itemId);
    const panel = this.#deps.readingPanel;
    if (pointer === undefined || panel === undefined || this.#status.kind !== "live") return {};
    panel.open(
      { itemId, path: pathOf(pointer), inset },
      {
        openEditor: () => void this.#socket?.send({ version, type: "open-editor", itemId }),
        closed: () => this.#panelClosed(itemId),
      },
    );
    this.#socket?.send({ version, type: "open-source", itemId });
    return {};
  }

  // A click on a link in Markdown: the URL opens in a new tab only when it is a web URL and the item
  // holds Markdown in the board document the page holds; otherwise nothing opens and the reason is
  // logged, with no agent text (atoms, design decision 6; AD-8).
  #openLink({ itemId, url }: ViewOpenLink): ViewReply {
    const document = this.#model.document as ViewDocument | undefined;
    const refusal = openLinkRefusal(document, itemId, url);
    if (refusal !== undefined) {
      this.#deps.log(`open-link refused: ${refusal}`);
      return {};
    }
    this.#deps.openLink?.(url);
    return {};
  }

  // The user closed the panel: the view puts the focus back on the item that opened it.
  #panelClosed(itemId: string): void {
    this.#closings += 1;
    this.#closed = { id: this.#closings, itemId };
    this.#updateView();
  }

  // What the view reports of its items: kept in the model, a failing item also logged.
  #viewReport(message: ViewReady | ViewItemError): ViewReply {
    this.#model = withViewMessage(this.#model, message);
    if (message.type === "item-error") {
      this.#deps.log(`the item "${message.itemId}" failed in the view: ${message.error}`);
    }
    return {};
  }

  // Why no act can go now, if none can: the board ended or moved.
  #ended(): string | undefined {
    switch (this.#status.kind) {
      case "discarded":
        return "the ask was discarded";
      case "moved":
        return "the board moved to another tab";
      case "closed":
        return "the ask is closed";
      default:
        return undefined;
    }
  }

  // One command of the view's acts, under a fresh action ID: sent at once while the board is
  // live, held otherwise, and held either way until board-host settles it.
  #command(acts: ActsOrRefusal): ActReply {
    const ended = this.#ended();
    if (ended !== undefined) return refusal(ended) as ActReply;
    if (!acts.ok) return refusal(acts.detail) as ActReply;
    const command: ActCommand = { version, type: "act", actionId: this.#draw(), acts: acts.value };
    const sent = this.#status.kind === "live" && this.#socket?.send(command) === true;
    this.#outbox = hold(this.#outbox, command, basisOf(this.#model, acts.value), sent);
    // The view hears it held before the reply.
    this.#updateView();
    return { outcome: sent ? "sent" : "queued", actionId: command.actionId };
  }

  // A Snapshot request, sent once on a socket board-host accepted, with whether the board holds
  // unsent work (AD-15); never queued, so nothing goes while the connection is lost.
  #takeSnapshot(source: SnapshotSource): SnapshotRequestReply {
    const ended = this.#status.kind === "closed" ? undefined : this.#ended();
    if (ended !== undefined) return { outcome: "refused", detail: ended };
    const requestId = this.#draw();
    const unsentWork = hasUnsentWork(this.#mirror.latest());
    const flag = unsentWork ? { unsentWork: true as const } : {};
    const sent =
      this.#stateSeen && this.#socket?.send({ version, type: "snapshot", requestId, ...flag });
    if (sent !== true) return { outcome: "refused", detail: "the connection is lost" };
    this.#snapshots.track(requestId, source, unsentWork);
    return { outcome: "sent", requestId, ...flag };
  }

  #onSnapshotReply(message: SnapshotReply): void {
    if (this.#snapshots.reply(message)) return;
    this.#deps.log(
      `board-host answered a Snapshot request the page does not wait for: ${message.requestId}`,
    );
  }

  // The view's request ends in its updates; the banner's beside the banner.
  #snapshotEnded(source: SnapshotSource, feedback: SnapshotFeedback): void {
    if (source === "banner") {
      this.#deps.showSnapshot(feedback);
      return;
    }
    this.#snapshot = feedback;
    this.#updateView();
  }

  // The view's draft record, checked, becomes the page's own: board-host's is no longer restored.
  #takeDraft(record: DraftRecord): ViewReply {
    const refused = draftRefusal(record, this.#model.document);
    if (refused !== undefined) {
      this.#deps.log(`the view's draft record was refused: ${refused}`);
      return refusal(refused);
    }
    this.#mirror.take(record);
    if (this.#restore !== undefined) {
      this.#restore = undefined;
      this.#updateView();
    }
    return {};
  }

  #loadView(): void {
    const data = bootDataOf(this.#model);
    if (data === undefined || this.#view !== undefined || this.#loading || !this.#mayLoad) return;
    this.#loading = true;
    this.#deps.openView(data, this.#onViewMessage).then(
      (opened) => {
        this.#loading = false;
        this.#view = opened;
        this.#booted = data.document;
        this.#deps.showLoadError(undefined);
        this.#updateView();
      },
      (error: unknown) => {
        this.#loading = false;
        this.#mayLoad = false;
        const reason = error instanceof Error ? error.message : String(error);
        this.#deps.showLoadError(t(this.#language(), "board.loadError", { reason }));
        this.#deps.log("the view did not load", error);
      },
    );
  }

  // The first state on a socket: the board is live again, the held commands and the page's own
  // draft record go.
  #resume(): void {
    this.#stateSeen = true;
    this.#attempt = 0;
    this.#transition({ type: "accepted" });
    const state = this.#model.state;
    if (state === undefined || this.#status.kind !== "live") return;
    const send = (command: ActCommand) => this.#socket?.send(command) === true;
    const problemOf = (command: ActCommand) => {
      const checked = actsFor(this.#model, command.acts);
      return checked.ok ? undefined : checked.detail;
    };
    const flushed = flush(this.#outbox, state, send, problemOf);
    this.#outbox = flushed.outbox;
    for (const { actionId, detail } of flushed.dropped) {
      this.#deps.log(`the command ${actionId} was not sent: ${detail}`);
    }
    this.#mirror.resend();
  }

  #onState(message: LifecycleStateMessage): void {
    const problem = stateProblem(this.#model.document, message.state);
    if (problem !== undefined) {
      this.#deps.log(`board-host sent a state the board page cannot act on: ${problem}`);
      return;
    }
    this.#model = withHostMessage(this.#model, message);
    this.#outbox = settleDone(this.#outbox);
    if (!this.#stateSeen) this.#resume();
    if (message.state.ask === "closed") this.#transition({ type: "ask-closed" });
    this.#updateView();
    this.#loadView();
  }

  #onRefused(message: RefusedMessage): void {
    if (message.reason === "token") {
      // Only before `connect` is accepted, as after a restart; 4403 follows (AD-21).
      this.#transition({ type: "discarded" });
      return;
    }
    if (
      (message.reason === "act" || message.reason === "closed") &&
      message.actionId !== undefined
    ) {
      this.#refusedCommand(message);
      return;
    }
    this.#deps.log(`board-host refused a message: ${message.detail}`);
  }

  // A refused command is not held any more; the state that follows shows the board unchanged.
  #refusedCommand(message: RefusedMessage): void {
    const { actionId = "", index, itemId, detail } = message;
    this.#outbox = refusedCommand(this.#outbox, actionId);
    const act =
      index === undefined
        ? ""
        : ` (act ${index + 1}${itemId === undefined ? "" : `, "${itemId}"`})`;
    this.#deps.log(`board-host refused the command ${actionId}${act}: ${detail}`);
    this.#updateView();
  }

  #onHostMessage(message: BoardHostMessage): void {
    const handle = this.#hostHandlers[message.type] as (message: BoardHostMessage) => void;
    handle(message);
  }

  // What the board page does with each message `board-host` sends, by type: E1's; protocol
  // 1.1's (ask-lifecycle, design decision 8); push delivery's who asked and where and agent
  // status, kept and passed on to the view (design decision 12).
  readonly #hostHandlers: HostHandlers = {
    board: (message) => {
      this.#model = withHostMessage(this.#model, message);
      this.#deps.setLanguage(htmlLang(this.#language()));
      this.#deps.setTitle(tabTitle(message.document.title, this.#language()));
    },
    state: (message) => this.#onState(message as LifecycleStateMessage),
    receipt: (message) => this.#keep(message),
    // A takeover takes only the last draft the older tab sends once told (AD-21).
    moved: () => {
      this.#mirror.flushLast();
      this.#transition({ type: "moved" });
    },
    discarded: () => this.#transition({ type: "discarded" }),
    refused: (message) => this.#onRefused(message),
    done: (message) => {
      this.#outbox = acknowledged(this.#outbox, message.actionId);
    },
    draft: (message) => this.#onDraft(message.record),
    closed: () => this.#transition({ type: "ask-closed" }),
    origin: (message) => this.#keep(message),
    agent: (message) => this.#keep(message),
    // Read before the board on each connect and after each write: the page applies the
    // presentation to its own root at once and the view gets it with its next update, or in its
    // boot data (settings-languages, design decision 10).
    settings: (message) => {
      this.#keep(message);
      const { presentation } = this.#model.passedOn;
      if (presentation !== undefined) this.#deps.applyPresentation?.(presentation);
      this.#showSettings();
    },
    "source-state": (message) => this.#deps.readingPanel?.sourceState(message),
    "editor-outcome": (message) => this.#deps.readingPanel?.editorOutcome(message),
    "snapshot-saved": (message) => this.#onSnapshotReply(message),
    "snapshot-failed": (message) => this.#onSnapshotReply(message),
  };

  // A message the model keeps, which the view shows: a receipt, who asked and where, the status.
  #keep(message: BoardHostMessage): void {
    this.#model = withHostMessage(this.#model, message);
    this.#updateView();
  }

  // board-host's draft record restores the board when the page has none of its own: after a
  // reload, or in the tab that took the board over (AD-20, FR-25).
  #onDraft(record: DraftRecord): void {
    if (this.#mirror.latest() !== undefined) return;
    this.#restores += 1;
    this.#restore = { id: this.#restores, record };
    this.#updateView();
  }

  #retry(): void {
    if (this.#suspended || this.#cancelRetry !== undefined) return;
    if (this.#status.kind !== "retrying" && this.#status.kind !== "closed") return;
    const delay = reconnectDelay(this.#attempt);
    this.#attempt += 1;
    this.#cancelRetry = this.#deps.schedule(delay, () => {
      this.#cancelRetry = undefined;
      this.#open();
    });
  }

  #onClose(): void {
    this.#socket = undefined;
    this.#stateSeen = false;
    this.#snapshots.drop();
  }

  // Each socket's events count only while it is the current one.
  #open(): void {
    if (this.#suspended || this.#socket !== undefined) return;
    this.#mayLoad = true;
    const current = this.#deps.connect({
      onMessage: (message) => {
        if (this.#socket === current) this.#onHostMessage(message);
      },
      onInvalid: (problems) => {
        if (this.#socket !== current) return;
        this.#deps.log("board-host sent a message the board protocol refuses", problems);
      },
      onClose: (code) => {
        if (this.#socket !== current) return;
        this.#onClose();
        this.#transition({ type: "closed", code });
        this.#retry();
      },
    });
    this.#socket = current;
  }
}

/** Starts the board page: its first socket opens at once. */
export const runBoardPage = (deps: BoardPageDeps): BoardPage => new BoardPageController(deps);
