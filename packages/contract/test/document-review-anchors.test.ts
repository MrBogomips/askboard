// Placing and quoting (document-review, task 1.4; contract spec: A quote's place in a text, Quoting a
// passage; design decision 4): the one rule that places a quote, the quote a passage gets, and the
// two agreeing by construction. Positions are UTF-16 indices of the text, as the DOM gives them.

import { describe, expect, test } from "bun:test";
import {
  placeAnnotations,
  placeQuote,
  QUOTE_CONTEXT_CHARS,
  QUOTE_CONTEXT_MAX_CHARS,
  QUOTE_EXACT_MAX_CHARS,
  quotePassage,
} from "../src/index.ts";

const points = (text: string): number => [...text].length;
const where = (text: string, passage: string, from = 0): [number, number] => {
  const start = text.indexOf(passage, from);
  if (start < 0) throw new Error(`no "${passage}" in the text`);
  return [start, start + passage.length];
};
const quoteOf = (text: string, passage: string, from = 0) => {
  const [start, end] = where(text, passage, from);
  return quotePassage(text, start, end);
};
const accepted = (text: string, passage: string, from = 0) => {
  const made = quoteOf(text, passage, from);
  if (!made.ok) throw new Error(`refused: ${made.reason}`);
  return made.quote;
};

describe("the constants", () => {
  test("hold the contract's figures", () => {
    expect(QUOTE_CONTEXT_CHARS).toBe(32);
    expect(QUOTE_CONTEXT_MAX_CHARS).toBe(200);
    expect(QUOTE_EXACT_MAX_CHARS).toBe(2000);
  });
});

describe("a quote's place in a text", () => {
  const TEXT = "The board remembers drafts. Old drafts stay.";

  test("found once: the place is the occurrence's exact", () => {
    const place = placeQuote(TEXT, { type: "quote", exact: "drafts", prefix: "remembers " });
    const first = TEXT.indexOf("drafts");
    expect(place).toEqual({ ok: true, start: first, end: first + 6 });
  });

  test("the context is part of the occurrence: prefix, exact and suffix are joined", () => {
    const place = placeQuote(TEXT, { type: "quote", exact: "drafts", suffix: " stay." });
    const second = TEXT.lastIndexOf("drafts");
    expect(place).toEqual({ ok: true, start: second, end: second + 6 });
  });

  test("missing: the quote occurs nowhere", () => {
    expect(placeQuote("The board remembers.", { type: "quote", exact: "drafts" })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(placeQuote(TEXT, { type: "quote", exact: "drafts", prefix: "forgets " })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  test("ambiguous: the quote occurs more than once", () => {
    expect(placeQuote(TEXT, { type: "quote", exact: "drafts" })).toEqual({
      ok: false,
      reason: "ambiguous",
    });
  });

  test("overlapping occurrences count: aa in aaa is ambiguous", () => {
    expect(placeQuote("aaa", { type: "quote", exact: "aa" })).toEqual({
      ok: false,
      reason: "ambiguous",
    });
    expect(placeQuote("aab", { type: "quote", exact: "aa" })).toEqual({
      ok: true,
      start: 0,
      end: 2,
    });
  });

  test("a quote at the text's start and at its end is placed", () => {
    expect(placeQuote(TEXT, { type: "quote", exact: "The", suffix: " board" })).toEqual({
      ok: true,
      start: 0,
      end: 3,
    });
    expect(placeQuote(TEXT, { type: "quote", exact: "stay.", prefix: "Old drafts " })).toEqual({
      ok: true,
      start: TEXT.length - 5,
      end: TEXT.length,
    });
  });

  test("an unreadable quote is missing, never a throw", () => {
    for (const bad of [null, undefined, {}, { exact: "" }, { exact: 3 }, { type: "quote" }]) {
      expect(() => placeQuote(TEXT, bad as never)).not.toThrow();
      expect(placeQuote(TEXT, bad as never)).toEqual({ ok: false, reason: "missing" });
    }
  });

  test("line breaks and emoji are matched as they stand", () => {
    const text = "one\ntwo 😀 three\n\nfour";
    const place = placeQuote(text, { type: "quote", exact: "two 😀", prefix: "one\n" });
    expect(place).toEqual({ ok: true, start: 4, end: 4 + "two 😀".length });
  });
});

describe("two places that overlap", () => {
  const TEXT = "The board remembers drafts. Old drafts stay.";
  const note = (id: string, exact: string, extra: Record<string, unknown> = {}) => ({
    id,
    target: { selector: { type: "quote" as const, exact, ...extra } },
  });

  test("the first keeps its place and the second is detached as overlapping", () => {
    const placed = placeAnnotations(TEXT, [
      note("u-1", "remembers drafts"),
      note("u-2", "drafts", { prefix: "remembers " }),
    ]);
    const start = TEXT.indexOf("remembers drafts");
    expect(placed).toEqual([
      { id: "u-1", status: "placed", start, end: start + 16 },
      { id: "u-2", status: "detached", reason: "overlaps" },
    ]);
  });

  test("the later in the result is detached, whichever starts first in the text", () => {
    const placed = placeAnnotations(TEXT, [
      note("u-1", "drafts", { prefix: "remembers " }),
      note("u-2", "remembers drafts"),
    ]);
    expect(placed.map(({ status }) => status)).toEqual(["placed", "detached"]);
    expect(placed[1]).toEqual({ id: "u-2", status: "detached", reason: "overlaps" });
  });

  test("passages that touch do not overlap", () => {
    const placed = placeAnnotations("ab cd", [note("u-1", "ab "), note("u-2", "cd")]);
    expect(placed.map(({ status }) => status)).toEqual(["placed", "placed"]);
  });

  test("a detached annotation holds no place, so a later one overlapping only it is placed", () => {
    const text = "aaaa bbbb cccc";
    const placed = placeAnnotations(text, [
      note("u-1", "aaaa bbbb"),
      note("u-2", "bbbb cccc"),
      note("u-3", "cccc"),
    ]);
    expect(placed.map(({ status }) => status)).toEqual(["placed", "detached", "placed"]);
  });

  test("a missing and an ambiguous quote are detached with their reasons, in order", () => {
    const placed = placeAnnotations(TEXT, [
      note("u-1", "forgets"),
      note("u-2", "drafts"),
      note("u-3", "board"),
    ]);
    expect(placed).toEqual([
      { id: "u-1", status: "detached", reason: "missing" },
      { id: "u-2", status: "detached", reason: "ambiguous" },
      { id: "u-3", status: "placed", start: 4, end: 9 },
    ]);
  });

  test("an empty list gives none, and an unreadable annotation is detached as missing", () => {
    expect(placeAnnotations(TEXT, [])).toEqual([]);
    const placed = placeAnnotations(TEXT, [null, { id: "u-1" }, { id: "u-2", target: 3 }] as never);
    expect(placed.map((one) => ("reason" in one ? one.reason : "placed"))).toEqual([
      "missing",
      "missing",
      "missing",
    ]);
  });

  test("an ID every object inherits is an ID like any other", () => {
    const placed = placeAnnotations(TEXT, [
      note("__proto__", "board"),
      note("constructor", "stay"),
    ]);
    expect(placed.map(({ id }) => id)).toEqual(["__proto__", "constructor"]);
    expect(placed.every(({ status }) => status === "placed")).toBe(true);
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});

describe("quoting a passage", () => {
  test("a unique word gets its context of up to 32 characters each side", () => {
    const text = `${"a".repeat(50)} unique ${"b".repeat(50)}`;
    const quote = accepted(text, "unique");
    expect(quote.exact).toBe("unique");
    expect(points(quote.prefix ?? "")).toBe(32);
    expect(points(quote.suffix ?? "")).toBe(32);
    expect(quote.prefix).toBe(text.slice(text.indexOf("unique") - 32, text.indexOf("unique")));
    expect(placeQuote(text, quote)).toEqual({
      ok: true,
      start: text.indexOf("unique"),
      end: text.indexOf("unique") + 6,
    });
  });

  test("a quote at the text's start has no prefix and one at its end no suffix", () => {
    const text = "Start of the document, which is long enough for context, and its end";
    const first = accepted(text, "Start");
    expect(first.prefix).toBeUndefined();
    expect(first.suffix).toBe(text.slice(5, 37));
    expect(text.length).toBeGreaterThan(40);
    const last = accepted(text, "end");
    expect(last.suffix).toBeUndefined();
    expect(last.prefix).toBe(text.slice(text.length - 3 - 32, text.length - 3));
    expect(placeQuote(text, first)).toEqual({ ok: true, start: 0, end: 5 });
    expect(placeQuote(text, last)).toEqual({ ok: true, start: text.length - 3, end: text.length });
  });

  test("the whole text quoted has no context", () => {
    expect(accepted("whole", "whole")).toEqual({ type: "quote", exact: "whole" });
  });

  // `count` characters that both occurrences share before the passage, and a shared tail after.
  const twice = (common: number) => {
    const shared = "c".repeat(common);
    const tail = " tail ".repeat(60);
    return `A${shared}X${tail}B${shared}X${tail}`;
  };

  test.each([
    [10, 32],
    [31, 32],
    [40, 64],
    [63, 64],
    [100, 128],
    [127, 128],
    [150, 200],
    [199, 200],
  ])(
    "two equal passages with %i shared characters before widen the context to %i",
    (common, widened) => {
      const text = twice(common);
      const second = text.lastIndexOf("X");
      const made = quotePassage(text, second, second + 1);
      expect(made.ok).toBe(true);
      if (!made.ok) return;
      expect(points(made.quote.prefix ?? "")).toBe(widened);
      expect(placeQuote(text, made.quote)).toEqual({ ok: true, start: second, end: second + 1 });
    },
  );

  test("a passage that cannot be told apart with 200 characters of context is refused as repeated", () => {
    const text = twice(200);
    const second = text.lastIndexOf("X");
    expect(quotePassage(text, second, second + 1)).toEqual({ ok: false, reason: "repeated" });
    const first = text.indexOf("X");
    expect(quotePassage(text, first, first + 1)).toEqual({ ok: false, reason: "repeated" });
  });

  test("a sentence repeated with the same 200 characters around it is refused as repeated", () => {
    const around = "x".repeat(200);
    const sentence = "Same sentence twice.";
    const text = `${around}${sentence}${around}${around}${sentence}${around}`;
    const made = quoteOf(text, sentence);
    expect(made).toEqual({ ok: false, reason: "repeated" });
  });

  test("the second of two equal sentences' last word is quoted with a longer context that places it", () => {
    const sentence = "We keep every draft until the user answers it, word";
    const text = `Intro one. ${sentence}. Middle part of the text. ${sentence}.`;
    const second = text.lastIndexOf("word");
    const made = quotePassage(text, second, second + 4);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(placeQuote(text, made.quote)).toEqual({ ok: true, start: second, end: second + 4 });
    const first = text.indexOf("word");
    expect(second).not.toBe(first);
  });

  test("blank passages are refused as blank", () => {
    const text = "one two　\n\tthree";
    expect(quotePassage(text, 3, 4)).toEqual({ ok: false, reason: "blank" });
    expect(quotePassage(text, 7, 10)).toEqual({ ok: false, reason: "blank" });
    expect(quotePassage(text, 2, 2)).toEqual({ ok: false, reason: "blank" });
    expect(quotePassage(text, 5, 3)).toEqual({ ok: false, reason: "blank" });
  });

  test("2,000 characters pass and 2,001 are refused as too long", () => {
    const prose = (n: number) =>
      Array.from({ length: n }, (_, at) =>
        String.fromCharCode(97 + ((at * 7 + (at >> 3)) % 26)),
      ).join("");
    const text = `${prose(2001)} end`;
    const at = quotePassage(text, 0, 2000);
    expect(at.ok).toBe(true);
    if (at.ok) expect(points(at.quote.exact)).toBe(2000);
    expect(quotePassage(text, 0, 2001)).toEqual({ ok: false, reason: "too-long" });
    // Counted in code points: 2,000 emoji are 4,000 units and pass.
    const emoji = "😀".repeat(2000);
    expect(quotePassage(emoji, 0, emoji.length).ok).toBe(true);
    const over = "😀".repeat(2001);
    expect(quotePassage(over, 0, over.length)).toEqual({ ok: false, reason: "too-long" });
  });

  test("offsets outside the text are cut to it, and a non-integer is refused as blank", () => {
    expect(quotePassage("abc", -5, 99).ok).toBe(true);
    expect(quotePassage("abc", Number.NaN, 2)).toEqual({ ok: false, reason: "blank" });
    expect(quotePassage("abc", 0, Number.POSITIVE_INFINITY).ok).toBe(true);
  });

  test("the context never splits a surrogate pair: whole emoji are kept or left out", () => {
    const text = `${"😀".repeat(40)}word${"😀".repeat(40)}`;
    const made = accepted(text, "word");
    expect(made.prefix).toBe("😀".repeat(32));
    expect(made.suffix).toBe("😀".repeat(32));
    for (const part of [made.prefix ?? "", made.suffix ?? ""]) {
      expect(part.codePointAt(0)).toBe(0x1f600);
      expect(part.at(-1)?.charCodeAt(0)).toBeGreaterThanOrEqual(0xdc00);
    }
  });

  test("a passage starting or ending next to an emoji keeps the whole emoji in its context", () => {
    const text = "a😀bc😀d";
    const b = accepted(text, "bc");
    expect(b.prefix).toBe("a😀");
    expect(b.suffix).toBe("😀d");
    expect(placeQuote(text, b)).toEqual({ ok: true, start: 3, end: 5 });
  });

  test("a boundary inside a pair is moved out to hold the whole character", () => {
    const text = "x😀y";
    // Units: x=0, 😀=1..2, y=3. A start of 2 and an end of 2 each split the pair.
    const widened = quotePassage(text, 2, 4);
    expect(widened.ok).toBe(true);
    if (widened.ok) expect(widened.quote.exact).toBe("😀y");
    const cut = quotePassage(text, 0, 2);
    expect(cut.ok).toBe(true);
    if (cut.ok) expect(cut.quote.exact).toBe("x😀");
  });

  test("a prototype name is a passage like any other", () => {
    const text = "see __proto__ and constructor here";
    for (const passage of ["__proto__", "constructor"]) {
      const quote = accepted(text, passage);
      expect(placeQuote(text, quote)).toEqual({
        ok: true,
        start: text.indexOf(passage),
        end: text.indexOf(passage) + passage.length,
      });
    }
  });
});

// A small deterministic generator (mulberry32), so a failing text can be rebuilt from its seed.
const random = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const WORDS = ["board", "draft", "answer", "the", "agent", "asks", "user", "reads", "a", "plan"];
const EMOJI = ["😀", "👍", "🧪", "é", "ü", "日本"];

const generated = (seed: number): string => {
  const next = random(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
  const kind = seed % 3;
  const sentence = () =>
    Array.from({ length: 3 + Math.floor(next() * 8) }, () =>
      next() < 0.12 ? pick(EMOJI) : pick(WORDS),
    ).join(" ");
  const sentences = Array.from({ length: 4 + Math.floor(next() * 40) }, sentence);
  if (kind === 1) {
    // repeated sentences: the same few, again and again
    const few = sentences.slice(0, 3);
    return Array.from({ length: 30 }, (_, at) => few[at % 3]).join(". ");
  }
  if (kind === 2) return `${sentences.join(".\n")}\n\n${sentences.slice(0, 5).join(". ")}`;
  return sentences.join(". ");
};

describe("quoting and placing agree by construction", () => {
  test("every passage quotePassage accepts, over 500 generated texts, places back at its offsets", () => {
    let accepts = 0;
    let refusals = 0;
    for (let seed = 1; seed <= 500; seed += 1) {
      const text = generated(seed);
      const next = random(seed * 7919);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const start = Math.floor(next() * text.length);
        const end = Math.min(text.length, start + 1 + Math.floor(next() * 90));
        const made = quotePassage(text, start, end);
        if (!made.ok) {
          refusals += 1;
          continue;
        }
        accepts += 1;
        const place = placeQuote(text, made.quote);
        expect(place.ok, `seed ${seed} at ${start}-${end}`).toBe(true);
        if (!place.ok) continue;
        // The place is the passage, moved only to hold whole characters.
        expect(text.slice(place.start, place.end)).toBe(made.quote.exact);
        expect(place.start).toBeLessThanOrEqual(start);
        expect(place.end).toBeGreaterThanOrEqual(Math.min(end, text.length));
        expect(place.start).toBeGreaterThanOrEqual(Math.max(0, start - 1));
        expect(place.end).toBeLessThanOrEqual(end + 1);
      }
    }
    expect(accepts).toBeGreaterThan(1000);
    expect(refusals).toBeGreaterThan(100);
  });

  test("the quotes of a set of disjoint passages place without detaching any", () => {
    const text = generated(3);
    const made = [];
    let from = 0;
    for (let id = 1; id <= 8; id += 1) {
      const start = text.indexOf(" ", from + 3) + 1;
      if (start <= 0) break;
      const end = Math.min(text.length, start + 5);
      const quote = quotePassage(text, start, end);
      if (quote.ok) made.push({ id: `u-${id}`, target: { selector: quote.quote } });
      from = end + 40;
    }
    expect(made.length).toBeGreaterThan(2);
    const placed = placeAnnotations(text, made);
    expect(placed.every(({ status }) => status === "placed")).toBe(true);
  });
});

describe("time", () => {
  // Prose that does not repeat itself: words picked by a seeded generator, a number now and then.
  const PROSE = (() => {
    const next = random(42);
    const words: string[] = [];
    for (let at = 0; words.join(" ").length < 10_000; at += 1) {
      const word = WORDS[Math.floor(next() * WORDS.length)] as string;
      words.push(next() < 0.2 ? `${word}${Math.floor(next() * 1000)}` : word);
    }
    return words.join(" ").slice(0, 10_000);
  })();
  const REPEATED = "a".repeat(10_000);
  // 100 quotes made over the text and placed back; and the worst a placing can meet, 100 quotes
  // that are missing from a text they nearly match everywhere, at the quote's longest. The figures
  // go to the task's note (askboard: bound by outcome, not a tight clock).
  const made = (text: string) => {
    const started = performance.now();
    const quotes = [];
    for (let at = 0; at < 100; at += 1) {
      const start = Math.floor((at * (text.length - 40)) / 100);
      const quote = quotePassage(text, start, start + 12);
      if (quote.ok) quotes.push(quote.quote);
    }
    for (const quote of quotes) placeQuote(text, quote);
    return { ms: performance.now() - started, quotes: quotes.length };
  };
  const nearMisses = (text: string) => {
    const started = performance.now();
    const middle = {
      type: "quote" as const,
      exact: `${text.slice(0, 1000)}!${text.slice(0, 800)}`,
      prefix: text.slice(0, 200),
    };
    for (let at = 0; at < 100; at += 1) placeQuote(text, middle);
    return performance.now() - started;
  };

  test("100 quotes over 10,000 characters of prose, and of one repeated character, are quick", () => {
    const prose = made(PROSE);
    const repeated = made(REPEATED);
    const proseMiss = nearMisses(PROSE);
    const repeatedMiss = nearMisses(REPEATED);
    console.log(
      `document-review anchors: 100 quotes made and placed: prose ${prose.ms.toFixed(1)} ms (${prose.quotes} accepted), repeated character ${repeated.ms.toFixed(1)} ms (${repeated.quotes} accepted); 100 near-miss quotes of 2,000 characters: prose ${proseMiss.toFixed(1)} ms, repeated character ${repeatedMiss.toFixed(1)} ms`,
    );
    expect(prose.quotes).toBeGreaterThan(50);
    // A bound a loaded runner never reaches and a blow-up past the measured cost exceeds by far.
    for (const ms of [prose.ms, repeated.ms, proseMiss, repeatedMiss]) {
      expect(ms).toBeLessThan(5000);
    }
  });

  test("a repeated-character document refuses every quote as repeated, quickly", () => {
    const refused = Array.from({ length: 100 }, (_, at) =>
      quotePassage(REPEATED, at * 90, at * 90 + 5),
    );
    expect(refused.every((one) => !one.ok && one.reason === "repeated")).toBe(true);
  });
});
