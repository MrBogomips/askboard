// The English strings, as the view and the board page show them (EXPERIENCE.md, Voice and Tone).

import type { StringTable } from "./keys.ts";

export const EN_US = {
  "tab.title": "{title} · AskBoard",
  "banner.connectionLost": "Connection lost, retrying",
  "banner.moved": "This board moved to another tab.",
  "banner.continueHere": "Continue here",
  "banner.discarded": "This ask was discarded. The board is read-only.",
  "banner.unsentNotSent": "Your unsent work was not sent",
  "board.loadError": "The board could not be loaded: {reason}",
  "header.ask": "Ask",
  "state.waiting": "Waiting",
  "state.answered": "Answered",
  "state.discarded": "Discarded",
  "question.answer": "Answer",
  "question.options": "Options",
  "question.optionsPickOne": "Options · pick one",
  "receipt.notSentYet": "not sent yet",
  "receipt.sent": "sent",
  "receipt.delivered": "delivered to the agent",
  "item.error": "This item could not be shown.",
  "item.loading": "Loading",
} as const satisfies StringTable;
