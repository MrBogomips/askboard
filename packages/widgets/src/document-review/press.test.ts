import { describe, expect, test } from "bun:test";
import { DOCUMENT_REVIEW_ANNOTATIONS_MAX, placeAnnotations } from "@askboard/contract";
import { passageOf, startCard } from "./press.ts";

// What "Comment" and "Suggest edit" do (view-and-widgets spec: Commenting on a passage, Suggesting an
// edit, Passages the board does not anchor, A Document review at the keyboard): the passage is the
// selection, else the current block, and the card starts empty or with the passage as its replacement.
const TEXT = "The board remembers drafts.\nA second block here.";
const BLOCKS = [
  { start: 0, end: 27 },
  { start: 28, end: 48 },
];

describe("passageOf", () => {
  test("is the selection when there is one, and not from a block", () => {
    expect(passageOf({ ok: true, start: 10, end: 19 }, BLOCKS, 1)).toEqual({
      ok: true,
      start: 10,
      end: 19,
      fromBlock: false,
    });
  });

  test("is the current block's trimmed text when nothing is selected, from a block", () => {
    expect(passageOf({ ok: false, reason: "none" }, BLOCKS, 1)).toEqual({
      ok: true,
      start: 28,
      end: 48,
      fromBlock: true,
    });
    expect(passageOf(undefined, BLOCKS, 0)).toEqual({
      ok: true,
      start: 0,
      end: 27,
      fromBlock: true,
    });
  });

  test("refuses several ranges and a selection outside the document, whatever the block", () => {
    expect(passageOf({ ok: false, reason: "several-ranges" }, BLOCKS, 0)).toEqual({
      ok: false,
      refusal: { code: "several-ranges" },
    });
    expect(passageOf({ ok: false, reason: "outside" }, BLOCKS, 0)).toEqual({
      ok: false,
      refusal: { code: "outside" },
    });
  });

  test("refuses with nothing selected in a document with no block, or at a block that is not there", () => {
    expect(passageOf(undefined, [], 0)).toEqual({ ok: false, refusal: { code: "outside" } });
    expect(passageOf(undefined, BLOCKS, 7)).toEqual({ ok: false, refusal: { code: "outside" } });
  });
});

describe("startCard", () => {
  const start = (
    kind: "comment" | "suggestion",
    from: number,
    to: number,
    annotations = [] as never[],
    fromBlock = false,
  ) =>
    startCard(kind, TEXT, annotations, placeAnnotations(TEXT, annotations), {
      start: from,
      end: to,
      fromBlock,
    });

  test("a comment starts empty, on the passage's quote, with the next ID", () => {
    const started = start("comment", 10, 19);
    if (!started.ok) throw new Error("refused");
    expect(started.card).toEqual({
      id: "u-1",
      kind: "comment",
      text: "",
      quote: expect.objectContaining({ type: "quote", exact: "remembers" }),
    });
  });

  test("a suggestion starts with the passage's text as its replacement and an empty note", () => {
    const started = start("suggestion", 20, 26);
    if (!started.ok) throw new Error("refused");
    expect(started.card).toMatchObject({ kind: "suggestion", text: "", replacement: "drafts" });
  });

  test("refuses a blank passage with its code and from the block when it came from one", () => {
    const blank = start("comment", 3, 4, [], true);
    expect(blank).toEqual({ ok: false, refusal: { code: "blank" }, fromBlock: true });
  });

  test("refuses a passage the document repeats, and one that overlaps an annotation, naming its pin", () => {
    const repeated = startCard("comment", "x".repeat(1000), [], [], {
      start: 300,
      end: 301,
      fromBlock: false,
    });
    expect(repeated).toMatchObject({ ok: false, refusal: { code: "repeated" } });
    const held = [
      {
        id: "u-1",
        target: { selector: { type: "quote" as const, exact: "board remembers" } },
        body: { text: "x" },
      },
    ];
    const overlapping = startCard("suggestion", TEXT, held, placeAnnotations(TEXT, held), {
      start: 14,
      end: 22,
      fromBlock: false,
    });
    expect(overlapping).toEqual({
      ok: false,
      refusal: { code: "overlaps", pin: 1 },
      fromBlock: false,
    });
  });

  test("refuses any passage once the result holds 100 annotations, and starts nothing", () => {
    const full = Array.from({ length: DOCUMENT_REVIEW_ANNOTATIONS_MAX }, (_, at) => ({
      id: `u-${at + 1}`,
      target: { selector: { type: "quote" as const, exact: `x${at}` } },
      body: { text: "t" },
    }));
    const refused = startCard("comment", TEXT, full, [], { start: 10, end: 19, fromBlock: false });
    expect(refused).toEqual({ ok: false, refusal: { code: "limit" }, fromBlock: false });
  });

  test("the next ID skips the IDs held", () => {
    const held = [
      {
        id: "u-1",
        target: { selector: { type: "quote" as const, exact: "second" } },
        body: { text: "x" },
      },
    ];
    const started = startCard("comment", TEXT, held, placeAnnotations(TEXT, held), {
      start: 10,
      end: 19,
      fromBlock: false,
    });
    if (!started.ok) throw new Error("refused");
    expect(started.card.id).toBe("u-2");
  });
});
