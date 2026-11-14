import { describe, expect, test } from "bun:test";
import {
  ANNOTATION_MAX_CHARS,
  ANNOTATION_REPLACEMENT_MAX_CHARS,
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  type DocumentReviewAnnotation,
  placeAnnotations,
  QUOTE_EXACT_MAX_CHARS,
  widgetResultFits,
} from "@askboard/contract";
import { DOCUMENT_REVIEW_TYPES, withWidgetTypes } from "@askboard/contract/fixtures";
import { el, fragment } from "../../test/fake-dom.ts";
import {
  anchorPassage,
  cardHolds,
  cardMatches,
  cardOf,
  check,
  createPlaces,
  nextId,
  placesOf,
  removeAnnotation,
  resultOf,
  withCard,
} from "./model.ts";
import { readingOfProps } from "./reading.ts";

// The model (document-review, design decisions 4, 8 and 9): the annotations as the user makes
// them, the refusals of a passage as codes the strings word, the places memoized so that typing
// in a card places nothing again, and the check that detached annotations block the answer.
const TEXT =
  "The agent drafts the plan and remembers every unsent answer. Second sentence follows here.";

const where = (passage: string, from = 0): [number, number] => {
  const start = TEXT.indexOf(passage, from);
  if (start < 0) throw new Error(`no "${passage}"`);
  return [start, start + passage.length];
};

const anchor = (
  passage: string,
  annotations: readonly DocumentReviewAnnotation[] = [],
  text = TEXT,
) => {
  const [start, end] = where(passage);
  return anchorPassage(text, annotations, placeAnnotations(text, annotations), start, end);
};

const quoteOf = (passage: string) => {
  const made = anchor(passage);
  if (!made.ok) throw new Error(`refused: ${made.refusal.code}`);
  return made.quote;
};

const comment = (id: string, passage: string, text: string): DocumentReviewAnnotation => ({
  id,
  target: { selector: quoteOf(passage) },
  body: { text },
});

describe("a comment's card", () => {
  const quote = quoteOf("remembers");
  const input = (text: string, id = "u-1") => ({ id, quote, kind: "comment" as const, text });

  test("is held from its first non-blank character and removed when emptied", () => {
    expect(withCard([], input(""))).toEqual([]);
    expect(withCard([], input("  \n "))).toEqual([]);
    const held = withCard([], input("  S"));
    expect(held).toEqual([{ id: "u-1", target: { selector: quote }, body: { text: "  S" } }]);
    expect(withCard(held, input("Say how long."))[0]?.body).toEqual({ text: "Say how long." });
    expect(withCard(held, input(""))).toEqual([]);
  });

  test("changes its annotation in place and appends a new one, in the user's order", () => {
    const first = withCard([], input("a", "u-1"));
    const both = withCard(first, { ...input("b", "u-2"), quote: quoteOf("plan") });
    expect(both.map((each) => each.id)).toEqual(["u-1", "u-2"]);
    expect(withCard(both, input("changed", "u-1")).map((each) => each.body.text)).toEqual([
      "changed",
      "b",
    ]);
  });

  test("cuts a text at the annotation's bound, in code points", () => {
    const long = `${"x".repeat(ANNOTATION_MAX_CHARS - 1)}😀😀`;
    const held = withCard([], input(long));
    expect([...(held[0]?.body.text ?? "")].length).toBe(ANNOTATION_MAX_CHARS);
  });
});

describe("a suggestion's card", () => {
  const quote = quoteOf("drafts");
  const input = (replacement: string, text = "", id = "u-1") => ({
    id,
    quote,
    kind: "suggestion" as const,
    text,
    replacement,
  });

  test("is held while the replacement differs from the passage or the note holds text", () => {
    expect(withCard([], input("drafts"))).toEqual([]);
    expect(withCard([], input("drafts", "  "))).toEqual([]);
    expect(withCard([], input("unsent answers"))[0]?.body).toEqual({
      replacement: "unsent answers",
    });
  });

  test("a note beside an unchanged replacement is held as a comment, reopened as one", () => {
    const held = withCard([], input("drafts", "keep"));
    expect(held[0]?.body).toEqual({ text: "keep" });
    const reopened = cardOf(held[0] as DocumentReviewAnnotation);
    expect(reopened).toMatchObject({ kind: "comment", text: "keep" });
    const edited = withCard(held, input("unsent answers", "keep"));
    expect(edited).toHaveLength(1);
    expect(edited[0]).toMatchObject({
      id: "u-1",
      body: { replacement: "unsent answers", text: "keep" },
    });
  });

  test("an empty replacement is a deletion and is held", () => {
    expect(withCard([], input(""))[0]?.body).toEqual({ replacement: "" });
  });

  test("is removed when the replacement goes back to the passage with no note", () => {
    const held = withCard([], input("x"));
    expect(withCard(held, input("drafts"))).toEqual([]);
  });

  test("cuts a replacement at its bound", () => {
    const held = withCard([], input("y".repeat(ANNOTATION_REPLACEMENT_MAX_CHARS + 5)));
    expect([...(held[0]?.body.replacement ?? "")].length).toBe(ANNOTATION_REPLACEMENT_MAX_CHARS);
  });

  test("is reopened from its annotation as a card with its text and replacement", () => {
    const held = withCard([], input("unsent answers", "why"));
    expect(cardOf(held[0] as DocumentReviewAnnotation)).toEqual({
      id: "u-1",
      quote,
      kind: "suggestion",
      text: "why",
      replacement: "unsent answers",
    });
    const note = withCard([], { id: "u-1", quote, kind: "comment", text: "c" });
    expect(cardOf(note[0] as DocumentReviewAnnotation)).toMatchObject({
      kind: "comment",
      text: "c",
    });
  });
});

describe("the next ID", () => {
  const withIds = (...ids: string[]): DocumentReviewAnnotation[] =>
    ids.map((id) => ({ id, target: { selector: quoteOf("plan") }, body: { text: "t" } }));

  test("is u-1 with none and the lowest free number after", () => {
    expect(nextId([])).toBe("u-1");
    expect(nextId(withIds("u-1", "u-2"))).toBe("u-3");
    expect(nextId(withIds("u-1", "u-3"))).toBe("u-2");
    expect(nextId(withIds("u-2"))).toBe("u-1");
  });

  test("ignores an ID that is not u- and a number", () => {
    expect(nextId(withIds("u-x", "u-", "u-01x", "a-1", "u-1"))).toBe("u-2");
  });
});

describe("refusing a passage", () => {
  test("blank, too long and repeated, as codes", () => {
    expect(anchor("The agent").ok).toBe(true);
    const blank = anchorPassage(TEXT, [], [], 3, 4);
    expect(blank).toEqual({ ok: false, refusal: { code: "blank" } });
    const long = "z".repeat(QUOTE_EXACT_MAX_CHARS + 1);
    expect(anchorPassage(long, [], [], 0, long.length)).toEqual({
      ok: false,
      refusal: { code: "too-long" },
    });
    const periodic = "ab ".repeat(300);
    expect(anchorPassage(periodic, [], [], 450, 452)).toEqual({
      ok: false,
      refusal: { code: "repeated" },
    });
  });

  test("a passage that overlaps an annotation names its pin", () => {
    const annotations = [
      comment("u-2", "plan and remembers", "x"),
      comment("u-1", "The agent", "y"),
    ];
    // The pins read in the document's order: "The agent" is 1 and "plan and remembers" is 2.
    expect(anchor("remembers every", annotations)).toEqual({
      ok: false,
      refusal: { code: "overlaps", pin: 2 },
    });
    expect(anchor("agent drafts", annotations)).toEqual({
      ok: false,
      refusal: { code: "overlaps", pin: 1 },
    });
  });

  test("touching an annotation is no overlap, and a detached one overlaps nothing", () => {
    const annotations = [comment("u-1", "The agent", "y")];
    expect(anchor(" drafts", annotations).ok).toBe(true);
    const gone: DocumentReviewAnnotation = {
      id: "u-9",
      target: { selector: { type: "quote", exact: "nowhere in the text" } },
      body: { text: "z" },
    };
    expect(anchor("plan", [gone]).ok).toBe(true);
  });

  test("a full result refuses another annotation as the limit", () => {
    const quote = quoteOf("plan");
    const full = Array.from({ length: DOCUMENT_REVIEW_ANNOTATIONS_MAX }, (_, index) => ({
      id: `u-${index + 1}`,
      target: { selector: { type: "quote" as const, exact: `gone ${index}` } },
      body: { text: "t" },
    }));
    expect(quote.exact).toBe("plan");
    expect(anchor("Second", full)).toEqual({ ok: false, refusal: { code: "limit" } });
  });

  test("the quote it makes places back at the passage", () => {
    const made = anchor("remembers");
    if (!made.ok) throw new Error("refused");
    expect(made).toMatchObject({ start: where("remembers")[0], end: where("remembers")[1] });
  });
});

describe("the result", () => {
  test("is the annotations in the user's order, and none with no annotation", () => {
    expect(resultOf([])).toBeUndefined();
    const held = [comment("u-2", "plan", "b"), comment("u-1", "drafts", "a")];
    expect(resultOf(held)).toEqual({ annotations: held });
  });

  test("a deleted annotation leaves the others in their order", () => {
    const held = [
      comment("u-1", "plan", "a"),
      comment("u-2", "drafts", "b"),
      comment("u-3", "agent", "c"),
    ];
    expect(removeAnnotation(held, "u-2").map((each) => each.id)).toEqual(["u-1", "u-3"]);
    expect(removeAnnotation(held, "u-9")).toBe(held);
    expect(
      resultOf(
        removeAnnotation(removeAnnotation([held[0] as DocumentReviewAnnotation], "u-1"), "u-1"),
      ),
    ).toBeUndefined();
  });
});

describe("the places, memoized by the text and the selectors", () => {
  test("typing in a card places nothing again; a selector or a text change places once", () => {
    let calls = 0;
    const place = (text: string, annotations: readonly unknown[]) => {
      calls += 1;
      return placeAnnotations(text, annotations);
    };
    const places = createPlaces(place);
    const first = comment("u-1", "plan", "a");
    const one = places(TEXT, [first]);
    expect(calls).toBe(1);
    const typed = places(TEXT, [{ ...first, body: { text: "ab" } }]);
    expect(calls).toBe(1);
    expect(typed).toBe(one);
    places(TEXT, [{ ...first, body: { replacement: "x" } }]);
    expect(calls).toBe(1);
    places(TEXT, [comment("u-1", "drafts", "a")]);
    expect(calls).toBe(2);
    places(`${TEXT} More.`, [first]);
    expect(calls).toBe(3);
    places(TEXT, [first]);
    expect(calls).toBe(3);
  });

  test("the shared memo gives the component and the check one answer", () => {
    const held = [comment("u-1", "plan", "a")];
    expect(placesOf(TEXT, held)).toBe(placesOf(TEXT, held));
    expect(placesOf(TEXT, held)[0]).toMatchObject({ status: "placed" });
  });

  test("keeps a bounded number of entries and still answers a forgotten one", () => {
    const places = createPlaces();
    const make = (index: number) => [comment("u-1", "plan", String(index))];
    const first = places(`${TEXT} 0`, make(0));
    for (let index = 1; index <= 40; index += 1) places(`${TEXT} ${index}`, make(index));
    expect(places(`${TEXT} 0`, make(0))).toEqual(first);
  });

  test("a reading object is placed once per list of selectors, 32 items over 4 passes", () => {
    let calls = 0;
    const places = createPlaces((text, annotations) => {
      calls += 1;
      return placeAnnotations(text, annotations);
    });
    const items = Array.from({ length: 32 }, (_, index) => ({
      reading: { text: TEXT },
      held: [comment(`u-${index + 1}`, "plan", "a")],
    }));
    for (let pass = 0; pass < 4; pass += 1) {
      for (const { reading, held } of items) places(reading, held);
    }
    expect(calls).toBe(32);
    const [first] = items as [(typeof items)[number]];
    places(first.reading, [
      { ...(first.held[0] as DocumentReviewAnnotation), body: { text: "b" } },
    ]);
    expect(calls).toBe(32);
    places(first.reading, [comment("u-1", "drafts", "a")]);
    expect(calls).toBe(33);
    for (const { reading, held } of items.slice(1)) places(reading, held);
    expect(calls).toBe(33);
    places({ text: TEXT }, first.held);
    expect(calls).toBe(34);
  });

  test("an unreadable annotation list is detached, never a throw", () => {
    const cyclic: Record<string, unknown> = { id: "u-1" };
    cyclic.target = cyclic;
    expect(() => placesOf(TEXT, [cyclic as never, null as never])).not.toThrow();
  });
});

describe("check: detached annotations", () => {
  const props = { markdown: TEXT };
  const textOf = (given: object) => ({ text: (given as { markdown: string }).markdown });

  test("gives nothing while every annotation is placed, and with no result", () => {
    expect(check({ annotations: [comment("u-1", "plan", "a")] }, props, textOf)).toBeUndefined();
    expect(check(undefined, props, textOf)).toBeUndefined();
  });

  test("counts a missing, an ambiguous and an overlapping place as detached", () => {
    const missing: DocumentReviewAnnotation = {
      id: "u-1",
      target: { selector: { type: "quote", exact: "absent" } },
      body: { text: "a" },
    };
    const ambiguous: DocumentReviewAnnotation = {
      id: "u-2",
      target: { selector: { type: "quote", exact: "e" } },
      body: { text: "b" },
    };
    const first = comment("u-3", "plan", "c");
    const overlapping: DocumentReviewAnnotation = {
      id: "u-4",
      target: { selector: { type: "quote", exact: "plan and" } },
      body: { text: "d" },
    };
    expect(check({ annotations: [missing] }, props, textOf)).toEqual({
      code: "detached",
      count: 1,
    });
    expect(check({ annotations: [missing, ambiguous, first, overlapping] }, props, textOf)).toEqual(
      {
        code: "detached",
        count: 3,
      },
    );
  });

  test("reads the text through the function it is given, so it and the component agree", () => {
    const read: string[] = [];
    check({ annotations: [comment("u-1", "plan", "a")] }, props, (given) => {
      read.push((given as { markdown: string }).markdown);
      return { text: TEXT };
    });
    expect(read).toEqual([TEXT]);
  });

  test("a result or props that are not a review's give nothing, never a throw", () => {
    for (const bad of [null, 3, "x", [], {}, { annotations: 3 }, { annotations: [null] }]) {
      expect(() => check(bad, props, textOf)).not.toThrow();
    }
    expect(check({ annotations: [comment("u-1", "plan", "a")] }, null, textOf)).toBeUndefined();
    expect(check({ annotations: [comment("u-1", "plan", "a")] }, {}, textOf)).toBeUndefined();
  });
});

describe("check shares one reading and one placement per props object", () => {
  test("32 items checked over 4 passes render and place each once; the component's path joins", () => {
    const rendered: string[] = [];
    const render = (source: string) => {
      rendered.push(source);
      return fragment(el("p", {}, source)) as unknown as DocumentFragment;
    };
    const win = {} as never;
    let placed = 0;
    const places = createPlaces((text, annotations) => {
      placed += 1;
      return placeAnnotations(text, annotations);
    });
    const readingFor = (props: object) => readingOfProps(props, win, render);
    const items = Array.from({ length: 32 }, (_, index) => ({
      props: { markdown: `${TEXT} ${index}` },
      result: { annotations: [comment("u-1", "plan", `n${index}`)] },
    }));
    for (let pass = 0; pass < 4; pass += 1) {
      for (const { props, result } of items) {
        expect(check(result, props, readingFor, places)).toBeUndefined();
      }
    }
    expect(rendered).toHaveLength(32);
    expect(placed).toBe(32);
    // The component's path: the same props object and the held annotations.
    const [first] = items as [(typeof items)[number]];
    places(readingFor(first.props), first.result.annotations);
    expect(rendered).toHaveLength(32);
    expect(placed).toBe(32);
    // A body change places nothing again.
    const typed = [{ ...first.result.annotations[0], body: { text: "more" } }];
    expect(check({ annotations: typed }, first.props, readingFor, places)).toBeUndefined();
    expect(placed).toBe(32);
    // An update that replaces the document renders and places once more.
    const replaced = { markdown: first.props.markdown };
    check(first.result, replaced, readingFor, places);
    check(first.result, replaced, readingFor, places);
    expect(rendered).toHaveLength(33);
    expect(placed).toBe(33);
  });
});

describe("a prototype name is text like any other", () => {
  test("__proto__ as a comment's text and as a passage", () => {
    const text = "before __proto__ after";
    const [start, end] = [text.indexOf("__proto__"), text.indexOf("__proto__") + 9];
    const made = anchorPassage(text, [], [], start, end);
    if (!made.ok) throw new Error("refused");
    expect(made.quote.exact).toBe("__proto__");
    const held = withCard([], { id: "u-1", quote: made.quote, kind: "comment", text: "__proto__" });
    expect(held[0]?.body.text).toBe("__proto__");
    expect(Object.getPrototypeOf(held[0]?.body)).toBe(Object.prototype);
    expect(
      check({ annotations: held }, { markdown: text }, (given) => ({
        text: (given as { markdown: string }).markdown,
      })),
    ).toBeUndefined();
    expect(placesOf(text, held)[0]).toMatchObject({ status: "placed", start, end });
    expect(resultOf(held)).toEqual({ annotations: held });
  });
});

describe("every result the model builds fits the contract", () => {
  // A seeded generator (mulberry32), so that a failure repeats.
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const random = seeded(20261108);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const WORDS = ["alpha", "beta", "gamma", "plan", "__proto__", "drafts", "a", "of", "x", "y"];
  const TEXTS = [
    "",
    " ",
    "\u0085",
    "　",
    "note",
    "__proto__",
    "x".repeat(2100),
    "\u{1F600}".repeat(2001),
  ];
  const documentOf = (): string =>
    Array.from({ length: 6 + Math.floor(random() * 30) }, () => pick(WORDS)).join(" ");
  const types = withWidgetTypes(...DOCUMENT_REVIEW_TYPES);

  test("3,000 results pass widgetResultFits for their props", () => {
    let results = 0;
    let failures = 0;
    let attempts = 0;
    while (results < 3000 && attempts < 200000) {
      attempts += 1;
      const text = documentOf();
      let held: readonly DocumentReviewAnnotation[] = [];
      for (let step = 0; step < 1 + Math.floor(random() * 4); step += 1) {
        const start = Math.floor(random() * text.length);
        const end = Math.min(text.length, start + 1 + Math.floor(random() * 12));
        const made = anchorPassage(text, held, placeAnnotations(text, held), start, end);
        if (!made.ok) continue;
        const base = { id: nextId(held), quote: made.quote, text: pick(TEXTS) };
        const replacement = pick([
          made.quote.exact,
          "",
          "changed",
          "r".repeat(ANNOTATION_REPLACEMENT_MAX_CHARS + 50),
          pick(TEXTS),
        ]);
        held = withCard(
          held,
          random() < 0.5
            ? { ...base, kind: "comment" }
            : { ...base, kind: "suggestion", replacement },
        );
        const result = resultOf(held);
        if (result === undefined) continue;
        results += 1;
        if (
          !widgetResultFits({ type: "document-review", id: "d" }, result, { markdown: text }, types)
        ) {
          failures += 1;
        }
      }
    }
    expect(results).toBeGreaterThanOrEqual(3000);
    expect(failures).toBe(0);
  });
});

describe("the 101st annotation", () => {
  const words = Array.from({ length: 101 }, (_, index) => `word${String(index).padStart(3, "0")}`);
  const text = words.join(" ");
  const quoteAt = (index: number) => {
    const start = text.indexOf(words[index] as string);
    const made = anchorPassage(text, [], [], start, start + (words[index] as string).length);
    if (!made.ok) throw new Error("refused");
    return made.quote;
  };
  const full = words.slice(0, DOCUMENT_REVIEW_ANNOTATIONS_MAX).map(
    (_, index): DocumentReviewAnnotation => ({
      id: `u-${index + 1}`,
      target: { selector: quoteAt(index) },
      body: { text: "n" },
    }),
  );

  test("a passage is refused as limit and the list is unchanged", () => {
    expect(full).toHaveLength(100);
    const start = text.indexOf(words[100] as string);
    const made = anchorPassage(text, full, placeAnnotations(text, full), start, start + 7);
    expect(made).toEqual({ ok: false, refusal: { code: "limit" } });
  });

  test("a new card over 100 annotations returns the same list; an existing card still changes", () => {
    const fresh = { id: "u-101", quote: quoteAt(100), kind: "comment" as const, text: "one more" };
    expect(withCard(full, fresh)).toBe(full);
    const changed = withCard(full, {
      id: "u-7",
      quote: quoteAt(6),
      kind: "comment" as const,
      text: "edited",
    });
    expect(changed).toHaveLength(100);
    expect(changed[6]?.body.text).toBe("edited");
    expect(withCard(full.slice(0, 99), fresh)).toHaveLength(100);
  });
});

describe("whether a card holds an annotation", () => {
  const quote = quoteOf("remembers");

  test("a comment holds one from its first non-blank character, and an empty or blank one none", () => {
    expect(cardHolds({ id: "u-1", quote, kind: "comment", text: "" })).toBe(false);
    expect(cardHolds({ id: "u-1", quote, kind: "comment", text: " \n" })).toBe(false);
    expect(cardHolds({ id: "u-1", quote, kind: "comment", text: "x" })).toBe(true);
  });

  test("a suggestion holds one while its replacement differs from the passage, else only with a note", () => {
    const base = { id: "u-1", quote, kind: "suggestion" as const };
    expect(cardHolds({ ...base, text: "", replacement: quote.exact })).toBe(false);
    expect(cardHolds({ ...base, text: "", replacement: "" })).toBe(true);
    expect(cardHolds({ ...base, text: "why", replacement: quote.exact })).toBe(true);
  });
});

describe("whether a card still stands for what the item holds", () => {
  const quote = quoteOf("remembers");
  const card = { id: "u-1", quote, kind: "comment" as const, text: "Say how long." };

  test("a card holding what is held matches, and an empty card matches an item that holds none", () => {
    const held = withCard([], card);
    expect(cardMatches(card, held)).toBe(true);
    expect(cardMatches({ ...card, text: "" }, [])).toBe(true);
  });

  test("a card holding text the item lacks, or an item holding what the card lacks, or other text, does not", () => {
    expect(cardMatches(card, [])).toBe(false);
    expect(cardMatches({ ...card, text: "" }, withCard([], card))).toBe(false);
    expect(cardMatches({ ...card, text: "other" }, withCard([], card))).toBe(false);
  });

  test("another annotation's ID is no match for the card's", () => {
    expect(cardMatches(card, withCard([], { ...card, id: "u-2" }))).toBe(false);
    expect(cardMatches({ ...card, text: "" }, withCard([], { ...card, id: "u-2" }))).toBe(true);
  });
});
