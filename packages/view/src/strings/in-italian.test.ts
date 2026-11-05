import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, ThreadEntry } from "@askboard/contract";
import {
  lifecycleBoardDocument,
  lifecycleDraftRecord,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { bannerOf } from "../board-page/board-status.ts";
import { tabTitle } from "../board-page/tab-title.ts";
import { unsentWorkText } from "../board-page/unsent-work.ts";
import { changesLabel } from "../shell/agent-change.ts";
import type { QuestionWork } from "../shell/board-draft.ts";
import { askPillOf, markLabel, postponedWarningOf } from "../shell/board-view.ts";
import { cardState } from "../shell/question-state.ts";
import { updatesLabel } from "../shell/submit.ts";
import { agentAuthor, explainPending, messagesLabel } from "../shell/thread-text.ts";
import { t } from "./index.ts";

// The view's and the board page's own texts come from the catalogue in the ask's language
// (settings-languages design decision 9; spec view-and-widgets, "Every string in both
// languages"): each function that makes one takes the language, en-US when not given.

const when = "2026-10-31T09:41:27Z";
const stateOf = (ask: string, questions: unknown[]) =>
  ({ ask, questions }) as unknown as LifecycleBoardState;
const declined = (itemId: string) => ({
  itemId,
  rev: 1,
  state: "declined",
  answer: { declined: true, when, receipt: "sent" },
});
const postponed = (itemId: string) => ({ itemId, rev: 1, state: "postponed" });

describe("the board page in Italian", () => {
  test("its banners and their actions", () => {
    expect(bannerOf({ kind: "moved" }, false, "it-IT")).toMatchObject({
      text: "Questa board si è spostata in un'altra scheda.",
      action: "Continua qui",
    });
    expect(bannerOf({ kind: "retrying" }, false, "it-IT")?.text).toBe(
      "Connessione persa, nuovo tentativo in corso",
    );
    expect(bannerOf({ kind: "closed" }, true, "it-IT")).toMatchObject({
      text: "Questa richiesta è stata chiusa. La board è in sola lettura.",
      detail: "Il lavoro non inviato non è stato inviato",
      action: "Copia il mio lavoro non inviato",
    });
  });

  test("its tab title and the copied unsent work", () => {
    expect(tabTitle("Piano", "it-IT")).toBe("Piano · AskBoard");
    const text = unsentWorkText(lifecycleBoardDocument, lifecycleDraftRecord, "it-IT");
    expect(text).toContain("Opzioni: EU\nIn attesa dell'invio: answer\n");
    expect(text).toContain("Altro…: Mollie\nNota su Adyen: ");
    expect(text).toContain("Nota per l'agente: Mollie");
    expect(text).toContain("Chiarimento: Does the EU");
  });
});

describe("the view's texts in Italian", () => {
  test("the ask pill", () => {
    const partly = stateOf("partly-answered", [declined("region"), postponed("payment")]);
    expect(askPillOf(partly, undefined, "it-IT").label).toBe("Risposte parziali 1/2");
    expect(askPillOf(stateOf("waiting", []), undefined, "it-IT").label).toBe("In attesa");
    const both = stateOf("answered", [declined("a"), postponed("b"), postponed("c")]);
    expect(askPillOf(both, undefined, "it-IT").label).toBe("con risposta, 2 rinviate, 1 rifiutata");
    expect(askPillOf(stateOf("answered", [postponed("a")]), undefined, "it-IT").label).toBe(
      "con risposta, 1 rinviata",
    );
    expect(askPillOf(stateOf("answered", []), undefined, "it-IT").label).toBe("Con risposta");
    expect(askPillOf(both, "closed", "it-IT").label).toBe("Chiusa");
    expect(askPillOf(both, "discarded", "it-IT").label).toBe("Scartata");
  });

  test("the markers and the postponed warning", () => {
    expect(markLabel("unanswered", "it-IT")).toBe("Senza risposta");
    expect(markLabel("postponed")).toBe("Postponed");
    const open = stateOf(
      "waiting",
      ["region", "payment", "analytics", "rollout", "erp-export"].map((itemId) =>
        itemId === "payment" ? postponed(itemId) : { itemId, rev: 1, state: "open" },
      ),
    );
    expect(
      postponedWarningOf(lifecycleBoardDocument, open, new Map<string, QuestionWork>(), "it-IT"),
    ).toBe("Hai 1 domanda rinviata: chiudendo perdi questa richiesta");
  });

  test("counts: changes, updates and messages", () => {
    expect(changesLabel(1, "it-IT")).toBe("La tua 1 modifica a questa domanda");
    expect(changesLabel(17, "it-IT")).toBe("Le tue 17 modifiche a questa domanda");
    expect(updatesLabel(1, "it-IT")).toBe("1 aggiornamento richiede una scelta");
    expect(updatesLabel(2, "it-IT")).toBe("2 aggiornamenti richiedono una scelta");
    expect(messagesLabel(0, "it-IT")).toBe("ancora nessun messaggio");
    expect(messagesLabel(1, "it-IT")).toBe("1 messaggio");
    expect(messagesLabel(2, "it-IT")).toBe("2 messaggi");
    expect(agentAuthor("it-IT")).toBe("Agente");
    expect(agentAuthor()).toBe("Agent");
  });

  test("Explain waits for its reply in the ask's language", () => {
    const explain: ThreadEntry = {
      cursor: 1,
      who: "you",
      when,
      text: t("it-IT", "question.explainText"),
      replies: [],
    } as unknown as ThreadEntry;
    expect(explainPending([explain], [], "it-IT")).toBe(true);
    expect(explainPending([explain], [])).toBe(false);
  });

  test("the delivery receipt", () => {
    const [question] = plainChoiceBoardDocument.items;
    const status = {
      itemId: question?.id ?? "",
      rev: 1,
      state: "answered",
      answer: { choice: ["SQLite"], when, receipt: "delivered" },
    } as const;
    const card = cardState({
      status,
      draft: {},
      load: "visible",
      ready: false,
      language: "it-IT",
    });
    expect(card.receipt).toBe("consegnata all'agente");
  });
});
