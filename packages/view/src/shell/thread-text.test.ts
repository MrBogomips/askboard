import { describe, expect, test } from "bun:test";
import type { ThreadEntry } from "@askboard/contract";
import type { ViewAct } from "../view-protocol.ts";
import { EXPLAIN } from "./card-acts.ts";
import {
  AGENT_AUTHOR,
  explainPending,
  isSendKey,
  messageCountOf,
  messagesLabel,
  timeOf,
} from "./thread-text.ts";

const entry = (text: string, replies: number): ThreadEntry => ({
  cursor: "k3x9.4",
  who: "Sara Conti",
  when: "2026-10-31T17:42:05Z",
  text,
  replies: Array.from({ length: replies }, (_, at) => ({
    text: `Reply ${at + 1}`,
    when: "2026-10-31T17:43:00Z",
  })),
});

describe("the follow-up thread's texts (EXPERIENCE.md, Voice and Tone: Follow-up; FR-10)", () => {
  test("the message count counts follow-ups and replies: no messages yet, 1 message, 2 messages", () => {
    expect(messageCountOf(undefined)).toBe(0);
    expect(messagesLabel(0)).toBe("no messages yet");
    expect(messageCountOf([entry("Why?", 0)])).toBe(1);
    expect(messagesLabel(1)).toBe("1 message");
    expect(messageCountOf([entry("Why?", 1), entry("And?", 2)])).toBe(5);
    expect(messagesLabel(2)).toBe("2 messages");
  });

  test("a message's time reads as en-US hours and minutes", () => {
    expect(timeOf("2026-10-31T17:42:05Z", "UTC")).toBe("5:42 PM");
    expect(timeOf("2026-10-31T09:05:00Z", "UTC")).toBe("9:05 AM");
    expect(timeOf("2026-10-31T17:42:05Z")).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  });

  test("the agent's replies are headed by the agent", () => {
    expect(AGENT_AUTHOR).toBe("Agent");
  });

  test("Explain waits for its reply: an Explain follow-up without a reply in the thread, or one on its way", () => {
    expect(explainPending(undefined, [])).toBe(false);
    expect(explainPending([entry(EXPLAIN, 0)], [])).toBe(true);
    expect(explainPending([entry(EXPLAIN, 1)], [])).toBe(false);
    expect(explainPending([entry("Why?", 0)], [])).toBe(false);
    const sending: ViewAct[] = [
      { type: "follow-up", itemId: "q", rev: 1, text: EXPLAIN, when: "2026-10-31T17:42:05Z" },
    ];
    expect(explainPending([entry(EXPLAIN, 1)], sending)).toBe(true);
  });

  test("Ctrl+Enter and Cmd+Enter send; Enter alone adds a line", () => {
    expect(isSendKey({ key: "Enter", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isSendKey({ key: "Enter", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isSendKey({ key: "Enter", ctrlKey: false, metaKey: false })).toBe(false);
    expect(isSendKey({ key: "a", ctrlKey: true, metaKey: false })).toBe(false);
  });
});
