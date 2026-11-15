import { describe, expect, test } from "bun:test";
import { BOARD_KEYS, type KeyEntry, type ThreadEntry } from "@askboard/contract";
import type { KeyEventFields } from "../catalog/keys/press.ts";
import type { ViewAct } from "../view-protocol.ts";
import { EXPLAIN } from "./card-acts.ts";
import {
  AGENT_AUTHOR,
  explainPending,
  messageCountOf,
  messagesLabel,
  sendKeyOf,
  timeOf,
  viewerOffset,
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

  test("a message's time reads as hours and minutes in the ask's locale (settings-languages, task 7.3)", () => {
    expect(timeOf("2026-10-31T17:42:05Z", "en-US", 0)).toBe("5:42 PM");
    expect(timeOf("2026-10-31T09:05:00Z", "en-US", 0)).toBe("9:05 AM");
    expect(timeOf("2026-10-31T17:42:05Z", "it-IT", 0)).toBe("17:42");
    expect(timeOf("2026-10-31T17:42:05Z", "it-IT", 60)).toBe("18:42");
    expect(timeOf("2026-10-31T17:42:05Z", "en-US", -600)).toBe("7:42 AM");
    expect(timeOf("2026-10-31T17:42:05Z")).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  });

  test("the viewer's offset is the time zone's at that instant, minutes east of UTC", () => {
    const when = "2026-10-31T17:42:05Z";
    expect(viewerOffset(when)).toBe(0 - new Date(when).getTimezoneOffset());
    expect(timeOf(when, "it-IT")).toBe(timeOf(when, "it-IT", viewerOffset(when)));
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

  describe("the composer's send key", () => {
    const table = BOARD_KEYS as readonly KeyEntry[];
    const key = (over: Partial<KeyEventFields> = {}): KeyEventFields => ({
      key: "Enter",
      keyCode: 13,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: "TEXTAREA" },
      ...over,
    });

    test("Ctrl+Enter and Cmd+Enter send", () => {
      expect(sendKeyOf(table, key({ ctrlKey: true }))).toBe(true);
      expect(sendKeyOf(table, key({ metaKey: true }))).toBe(true);
    });

    test("Enter, Shift+Enter, Ctrl+Shift+Enter, Ctrl+Cmd+Enter and a composing Enter do not", () => {
      expect(sendKeyOf(table, key())).toBe(false);
      expect(sendKeyOf(table, key({ shiftKey: true }))).toBe(false);
      expect(sendKeyOf(table, key({ ctrlKey: true, shiftKey: true }))).toBe(false);
      expect(sendKeyOf(table, key({ ctrlKey: true, metaKey: true }))).toBe(false);
      expect(sendKeyOf(table, key({ ctrlKey: true, isComposing: true }))).toBe(false);
      expect(sendKeyOf(table, key({ ctrlKey: true, key: "a" }))).toBe(false);
    });

    test("under Mod+Alt+Enter only that combination sends", () => {
      const own = [
        {
          ...BOARD_KEYS.find((entry) => entry.action === "board.sendFollowUp"),
          keys: [{ key: "Enter", hold: "mod+alt" }],
        },
      ] as unknown as readonly KeyEntry[];
      expect(sendKeyOf(own, key({ ctrlKey: true, altKey: true }))).toBe(true);
      expect(sendKeyOf(own, key({ metaKey: true, altKey: true }))).toBe(true);
      expect(sendKeyOf(own, key({ ctrlKey: true }))).toBe(false);
    });
  });
});
