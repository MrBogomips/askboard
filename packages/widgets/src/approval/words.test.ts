import { describe, expect, test } from "bun:test";
import type { ElementShape } from "@askboard/contract";
import { type Say, say } from "@askboard/view/catalog";
import { summarise } from "./summary.ts";
import { valueWordsOf } from "./words.ts";

// The switched-value words of the summary (view-and-widgets spec: The three widgets' strings,
// "A switched value in Italian"; design decision 8; group 4 review S-2): the component builds
// `ValueWords` from the view's string tables, the glyph for nothing staying a glyph.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

// A widget whose elements hold a switch: a Tree's fields are text or numbers, so the shape of a
// test item stands in for a type whose elements switch.
const SWITCHES: ElementShape = { elements: "rows" };
const shapeOf = (type: string): ElementShape | undefined =>
  type === "switches" ? SWITCHES : undefined;
const sent = { rows: [{ id: "extras", label: "Extras", active: true }] };
const turnedOff = { rows: [{ id: "extras", label: "Extras", active: false }] };

describe("the summary's words", () => {
  test("read on and off in English, and nothing as a glyph", () => {
    expect(valueWordsOf(EN)).toEqual({ on: "on", off: "off", none: "—" });
  });

  test("read attivo and disattivo in Italian, and nothing as the same glyph", () => {
    expect(valueWordsOf(IT)).toEqual({ on: "attivo", off: "disattivo", none: "—" });
  });

  test("an Italian summary of a switch turned off reads attivo before disattivo", () => {
    const { lines } = summarise({
      items: [{ id: "extras-list", type: "switches", sent, shown: turnedOff }],
      shapeOf,
      locale: "it-IT",
      words: valueWordsOf(IT),
    });
    expect(lines).toEqual([
      {
        op: "set",
        itemId: "extras-list",
        elementId: "extras",
        name: "Extras",
        field: "active",
        previous: "attivo",
        next: "disattivo",
      },
    ]);
  });

  test("the same switch in English reads on before off", () => {
    const { lines } = summarise({
      items: [{ id: "extras-list", type: "switches", sent, shown: turnedOff }],
      shapeOf,
      locale: "en-US",
      words: valueWordsOf(EN),
    });
    expect([lines[0]?.previous, lines[0]?.next]).toEqual(["on", "off"]);
  });
});
