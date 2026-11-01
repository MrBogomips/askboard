// The Italian strings, from the UX draft of settings-languages (blocks 1 and 2), each provisional
// until a native review. The load error, the item error and "Caricamento" are not in the draft yet.

import type { StringTable } from "./keys.ts";

export const IT_IT = {
  "tab.title": "{title} · AskBoard",
  "banner.connectionLost": "Connessione persa, nuovo tentativo in corso",
  "banner.moved": "Questa board si è spostata in un'altra scheda.",
  "banner.continueHere": "Continua qui",
  "banner.discarded": "Questa richiesta è stata scartata. La board è in sola lettura.",
  "banner.unsentNotSent": "Il lavoro non inviato non è stato inviato",
  "board.loadError": "Impossibile caricare la board: {reason}",
  "header.ask": "Richiesta",
  "state.waiting": "In attesa",
  "state.answered": "Con risposta",
  "state.discarded": "Scartata",
  "question.answer": "Rispondi",
  "question.options": "Opzioni",
  "question.optionsPickOne": "Opzioni · scegline una",
  "receipt.notSentYet": "non ancora inviata",
  "receipt.sent": "inviata",
  "receipt.delivered": "consegnata all'agente",
  "item.error": "Impossibile mostrare questo elemento.",
  "item.loading": "Caricamento",
} as const satisfies StringTable;
