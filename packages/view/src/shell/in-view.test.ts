import { describe, expect, test } from "bun:test";
import { questionInView } from "./in-view.ts";

// The question in view (answering-flow-fixes, design decision 3; #181): the band between the bars
// is [60, 720], so the reading line is a third of the way down, at 280.
const BAND = { top: 60, bottom: 720 };
const card = (id: string, top: number, bottom: number) => ({ id, top, bottom });
const at = (cards: ReturnType<typeof card>[], more: { focused?: string; atEnd?: boolean } = {}) =>
  questionInView({ cards, band: BAND, focused: more.focused, atEnd: more.atEnd ?? false });

describe("the focused card", () => {
  const cards = [card("a", 0, 250), card("b", 250, 500), card("c", 500, 900)];

  test("wins while it overlaps the band, whatever crosses the reading line", () => {
    expect(at(cards, { focused: "c" })).toBe("c");
    expect(at(cards, { focused: "a" })).toBe("a");
  });

  test("loses once it has left the band, above or below", () => {
    expect(at([card("a", -400, -10), card("b", -10, 500)], { focused: "a" })).toBe("b");
    expect(at([card("a", 0, 400), card("b", 730, 900)], { focused: "b" })).toBe("a");
  });

  test("a card that only touches the band's edge does not overlap it", () => {
    expect(at([card("a", -100, 60), card("b", 60, 500)], { focused: "a" })).toBe("b");
  });

  test("an id that is no card changes nothing", () => {
    expect(at(cards, { focused: "gone" })).toBe("b");
  });
});

describe("the reading line", () => {
  test("the card crossing it is in view", () => {
    expect(at([card("a", -200, 270), card("b", 270, 600), card("c", 600, 900)])).toBe("b");
    expect(at([card("a", -200, 280), card("b", 280, 600)])).toBe("b");
  });

  test("in a gap between cards, the last card above the line", () => {
    expect(at([card("a", -300, 100), card("b", 200, 250), card("c", 320, 700)])).toBe("b");
  });

  test("with every card below the line, the first of them", () => {
    expect(at([card("a", 400, 600), card("b", 650, 900)])).toBe("a");
  });

  test("with every card above the band, the last of them", () => {
    expect(at([card("a", -900, -600), card("b", -500, -100)])).toBe("b");
  });
});

describe("the end of the page", () => {
  test("the last card that overlaps the band, though the line crosses an earlier one", () => {
    const cards = [card("a", 100, 400), card("b", 410, 560), card("c", 570, 700)];
    expect(at(cards)).toBe("a");
    expect(at(cards, { atEnd: true })).toBe("c");
  });

  test("a focused card that overlaps still wins at the end", () => {
    const cards = [card("a", 100, 400), card("b", 410, 560), card("c", 570, 700)];
    expect(at(cards, { atEnd: true, focused: "a" })).toBe("a");
  });

  test("with no card overlapping the band it falls to the line", () => {
    expect(at([card("a", -500, -100), card("b", 730, 900)], { atEnd: true })).toBe("a");
  });
});

describe("no cards, and empty ones", () => {
  test("none gives none", () => {
    expect(at([])).toBeUndefined();
    expect(at([], { focused: "a", atEnd: true })).toBeUndefined();
  });

  test("an empty box, as a hidden tab's card has, is ignored", () => {
    expect(at([card("a", 0, 0), card("b", 100, 400)], { focused: "a" })).toBe("b");
    expect(at([card("a", 0, 0)])).toBeUndefined();
    expect(at([card("a", 100, 400), card("z", 700, 700)], { atEnd: true })).toBe("a");
  });
});
