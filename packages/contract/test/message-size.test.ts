import { describe, expect, test } from "bun:test";
import {
  BOARD_MESSAGE_MAX_BYTES,
  boardMessageBytes,
  CHOICE_LABELS_MAX_CHARS,
  DRAFT_RECORD_MAX_CHARS,
  draftRecordChars,
  MESSAGE_TOO_BIG_CLOSE,
  utf8Length,
} from "../src/index.ts";

// Contract spec, The board's message limit and its measure (oversized-acts, design decision 1):
// one limit and one measure, shared by board-host and the board page.

const encoder = new TextEncoder();
const mixed = Array.from({ length: 20_000 }, (_, i) => ["a", "é", "€", "😀", "\n"][i % 5]).join("");

describe("utf8Length", () => {
  const samples: [string, string][] = [
    ["ASCII", "plain text"],
    ["a two-byte character", "é"],
    ["a three-byte character", "€"],
    ["a four-byte character", "😀"],
    ["the empty string", ""],
    ["a mixed string of 100,000 units or more", mixed.repeat(2)],
  ];
  for (const [what, text] of samples) {
    test(`counts ${what} as a UTF-8 encoder does`, () => {
      expect(utf8Length(text)).toBe(encoder.encode(text).length);
    });
  }

  test("counts a lone high and a lone low surrogate as three bytes, the replacement character", () => {
    expect(utf8Length("\ud83d")).toBe(3);
    expect(utf8Length("\ude00")).toBe(3);
    expect(utf8Length("a\ud83dz")).toBe(encoder.encode("a\ud83dz").length);
    expect(utf8Length("\ude00\ud83d")).toBe(6);
    expect(utf8Length("\ud83d😀")).toBe(7);
    expect(utf8Length("😀")).toBe(4);
  });
});

describe("boardMessageBytes", () => {
  test("is the byte length of the message's JSON text", () => {
    const messages = [
      { type: "answer", note: 'quote " and backslash \\ and \u0001 control \u001f and \n' },
      { type: "draft", record: { q: { note: "😀😀 𝄞 € é" } } },
      { type: "x", lone: "\ud83d", other: "\ude00" },
      { type: "empty" },
    ];
    for (const message of messages) {
      expect(boardMessageBytes(message)).toBe(Buffer.byteLength(JSON.stringify(message)));
    }
  });

  test("counts the text the socket sends: a lone surrogate JSON writes escaped counts as written", () => {
    // JSON.stringify writes a lone surrogate as an escape, six ASCII bytes, so the measure is
    // the length of that text, the same one the socket sends.
    const message = { lone: "\ud83d" };
    expect(boardMessageBytes(message)).toBe(utf8Length(JSON.stringify(message)));
  });
});

describe("the limit", () => {
  test("is the contract's two largest limits at three bytes per unit, plus the envelope", () => {
    expect(BOARD_MESSAGE_MAX_BYTES).toBe(
      Math.max(CHOICE_LABELS_MAX_CHARS, DRAFT_RECORD_MAX_CHARS) * 3 + 4 * 1024,
    );
    expect(BOARD_MESSAGE_MAX_BYTES).toBe(6_004_096);
  });

  test("the close code for a message too big is RFC 6455's 1009", () => {
    expect(MESSAGE_TOO_BIG_CLOSE).toBe(1009);
  });

  test("a draft message whose record is exactly the draft limit of three-byte characters measures within it", () => {
    // The record's JSON text is DRAFT_RECORD_MAX_CHARS units long: `{"n":"` + filler + `"}`.
    const frame = '{"n":""}'.length;
    const record = { n: "€".repeat(DRAFT_RECORD_MAX_CHARS - frame) };
    expect(draftRecordChars(record)).toBe(DRAFT_RECORD_MAX_CHARS);
    const message = { version: "1.7", type: "draft", record };
    expect(boardMessageBytes(message)).toBeLessThanOrEqual(BOARD_MESSAGE_MAX_BYTES);
    // Every unit at most three bytes, so no record within the draft limit can pass the message limit.
    expect(boardMessageBytes(message) - 3 * DRAFT_RECORD_MAX_CHARS).toBeLessThan(4 * 1024);
  });
});

describe("draftRecordChars", () => {
  test("is the length of the record's JSON text", () => {
    for (const record of [{}, { a: [1, 2, 3] }, { q: { note: "😀 é" } }]) {
      expect(draftRecordChars(record)).toBe(JSON.stringify(record).length);
    }
  });
});
