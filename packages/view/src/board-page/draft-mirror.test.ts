import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { lifecycleBoardDocument, lifecycleDraftRecord } from "@askboard/contract/fixtures";
import { createDraftMirror, DRAFT_DEBOUNCE_MS } from "./draft-mirror.ts";
import { hasUnsentWork, unsentWorkText } from "./unsent-work.ts";

type Timer = { readonly ms: number; readonly run: () => void; cancelled: boolean };

const setUp = () => {
  const timers: Timer[] = [];
  const sent: DraftRecord[] = [];
  let live = true;
  const mirror = createDraftMirror({
    schedule: (ms, run) => {
      const timer: Timer = { ms, run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    send: (record) => {
      if (!live) return false;
      sent.push(record);
      return true;
    },
  });
  const fire = () => {
    for (const timer of timers.splice(0)) if (!timer.cancelled) timer.run();
  };
  return { mirror, timers, sent, fire, setLive: (value: boolean) => (live = value) };
};

const record = (note: string): DraftRecord => ({
  delivery: "immediate",
  questions: { payment: { rev: 1, note } },
});

describe("the draft mirror (ask-lifecycle, design decision 6; AD-20)", () => {
  test("the view's latest record goes 300 ms after the last change, once", () => {
    const { mirror, timers, sent, fire } = setUp();
    mirror.take(record("a"));
    mirror.take(record("ab"));
    expect(sent).toEqual([]);
    expect(timers.at(-1)?.ms).toBe(DRAFT_DEBOUNCE_MS);
    fire();
    expect(sent).toEqual([record("ab")]);
    expect(mirror.latest()).toEqual(record("ab"));
    fire();
    expect(sent).toHaveLength(1);
  });

  test("a flush sends at once, and nothing when the record went already", () => {
    const { mirror, sent } = setUp();
    mirror.flush();
    expect(sent).toEqual([]);
    mirror.take(record("a"));
    mirror.flush();
    mirror.flush();
    expect(sent).toEqual([record("a")]);
  });

  test("a record the socket did not take goes on the next flush or new socket", () => {
    const { mirror, sent, fire, setLive } = setUp();
    setLive(false);
    mirror.take(record("a"));
    fire();
    expect(sent).toEqual([]);
    setLive(true);
    mirror.resend();
    expect(sent).toEqual([record("a")]);
  });

  test("told the board moved, it sends its last record even if it went already", () => {
    const { mirror, sent } = setUp();
    mirror.take(record("a"));
    mirror.flush();
    mirror.flushLast();
    expect(sent).toEqual([record("a"), record("a")]);
  });

  test("before any record from the view it holds none", () => {
    const { mirror, sent } = setUp();
    mirror.flushLast();
    mirror.resend();
    expect(mirror.latest()).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("unsent work (EXPERIENCE.md, Board banner: Unsent work; Close and reload)", () => {
  test("a context placement alone is no work and adds no line to the copy (excerpts, task 6.3)", () => {
    const record: DraftRecord = {
      delivery: "immediate",
      questions: { a: { rev: 1, context: "inline" } },
    };
    expect(hasUnsentWork(record)).toBe(false);
    expect(
      hasUnsentWork({ ...record, questions: { a: { rev: 1, context: "inline", note: "n" } } }),
    ).toBe(true);
  });

  test("values, Other text, option notes, a note, a follow-up being written or a held act are work", () => {
    expect(hasUnsentWork(undefined)).toBe(false);
    expect(hasUnsentWork({ delivery: "immediate", questions: {} })).toBe(false);
    expect(hasUnsentWork({ delivery: "submitted", questions: { a: { rev: 1 } } })).toBe(false);
    expect(hasUnsentWork({ delivery: "immediate", questions: { a: { rev: 1, note: "" } } })).toBe(
      false,
    );
    for (const work of [
      { values: { a: ["x"] } },
      { other: "x" },
      { optionNotes: { x: "y" } },
      { note: "x" },
      { composer: "x" },
      { held: { act: "postpone", order: 0 } },
    ] as const) {
      expect(hasUnsentWork({ delivery: "immediate", questions: { a: { rev: 1, ...work } } })).toBe(
        true,
      );
    }
  });

  test("the copy is plain text: the title, then each question's work under its text", () => {
    const text = unsentWorkText(lifecycleBoardDocument, lifecycleDraftRecord);
    expect(text).toBe(
      [
        "Checkout redesign plan",
        "",
        "Which regions does the first release of the new checkout cover?",
        "Options: EU",
        "Held for Submit: answer",
        "",
        "Which payment provider should the new checkout use?",
        "Other…: Mollie",
        "Note on Adyen: Ask the shop team about their contract.",
        "Note for the agent: Mollie is cheaper for iDEAL payments.",
        "Follow-up: Does the EU",
        "Held for Submit: answer",
        "",
      ].join("\n"),
    );
  });

  test("no work, no copy beyond the title; a question no longer on the board is left out", () => {
    expect(unsentWorkText(lifecycleBoardDocument, undefined)).toBe("Checkout redesign plan\n");
    const gone: DraftRecord = { delivery: "immediate", questions: { gone: { rev: 1, note: "x" } } };
    expect(unsentWorkText(lifecycleBoardDocument, gone)).toBe("Checkout redesign plan\n");
  });
});
