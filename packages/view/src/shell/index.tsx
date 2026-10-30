// The view shell's entry, bundled into the shell chunk (design decisions 7 and 8). It provides the
// `CatalogRenderer` port to the component chunks, which run after it, and boots once the srcdoc
// has parsed, when every chunk has run: it reads the `askboard-data` block, connects ext-apps'
// `App` to the board page when it has a parent (a Snapshot has none, AD-9), and renders the board
// through AskBoard's own renderer, with the draft record and the ready tracker.

import type { BoardDocument } from "@askboard/contract";
import { App } from "@modelcontextprotocol/ext-apps";
import { createRoot } from "react-dom/client";
import { BOOT_DATA_ID, parseBootData } from "../boot-data.ts";
import * as port from "../catalog/port.ts";
import { FrameTransport } from "../frame-transport.ts";
import { provide } from "../shared-modules.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { Board } from "./board.tsx";
import { NO_CHANNEL, openChannel, type ViewChannel } from "./channel.ts";
import { createDraftStore } from "./draft-store.ts";
import { createReadyTracker, type QuestionItems } from "./ready-tracker.ts";
import { createStore } from "./store.ts";

/** The name component chunks import the port by; the view build maps it to this chunk's copy. */
const CATALOG_PORT = "@askboard/view/catalog";

provide(CATALOG_PORT, port);

const VIEW_INFO = { name: "askboard-view", version: "0.0.0" };

// The view fills its frame, which the board page sizes: no size notifications.
const connectToBoardPage = (): ViewChannel => {
  const app = new App(VIEW_INFO, {}, { autoResize: false });
  return openChannel(app, () => app.connect(new FrameTransport(window.parent, window)));
};

// E1's question is its own one item; a question with a widget adds the widget's items (AD-9).
const questionItems = (document: BoardDocument): QuestionItems[] =>
  document.items.map((question) => ({ questionId: question.id, itemIds: [question.id] }));

const boot = (): void => {
  const data = parseBootData(document.getElementById(BOOT_DATA_ID)?.textContent);
  const root = document.getElementById("root");
  if (root === null) throw new Error("the view has no #root element");
  const channel = window.parent === window ? NO_CHANNEL : connectToBoardPage();
  const state = createStore(data.state);
  channel.onUpdate((update) => state.set(update.state));
  const report = (message: ViewMessage): void => {
    channel.send(message).catch((error: unknown) => {
      console.error(`askboard: the board page did not take the view's ${message.type}:`, error);
    });
  };
  const tracker = createReadyTracker(questionItems(data.document), {
    onVisible: (questionId) => report({ type: "ready", itemId: questionId }),
    onFailed: (_questionId, itemId, error) => report({ type: "item-error", itemId, error }),
  });
  const context = { draft: createDraftStore(), tracker, channel };
  createRoot(root).render(<Board document={data.document} state={state} context={context} />);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
