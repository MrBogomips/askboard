// "By what the user has to do" and the complete ask (skill-engagement, design decisions 6 and 7;
// skills spec: item types by what the user has to do, a complete ask in the catalogue).

import { describe, expect, test } from "bun:test";
import { WIDGET_TYPES } from "@askboard/contract";
import { READY_MOLECULES } from "@askboard/molecules";
import { COMPLETE_ASK_EXAMPLE, PAYOFF, renderPayoff } from "./payoff.ts";
import { contextTypes } from "./references.ts";

const known = new Set<string>([
  ...contextTypes(),
  ...WIDGET_TYPES.map(({ type }) => type),
  ...READY_MOLECULES.map(({ molecule }) => molecule),
]);

describe("PAYOFF", () => {
  test("names only context types, registered types or ready molecules", () => {
    for (const entry of PAYOFF)
      for (const type of entry.types) expect(known.has(type), type).toBe(true);
  });

  test("renders the section under its heading, as examples", () => {
    const text = renderPayoff(WIDGET_TYPES, READY_MOLECULES);
    expect(text.startsWith("## By what the user has to do")).toBe(true);
    expect(text).toContain("Examples, not a list");
  });

  test("names ranking alone for triage when kanban is not registered", () => {
    const widgets = WIDGET_TYPES.filter(({ type }) => type !== "kanban");
    const line = renderPayoff(widgets, READY_MOLECULES)
      .split("\n")
      .find((l) => l.startsWith("- Prioritise or triage"));
    expect(line).toContain("`ranking`");
    expect(line).not.toContain("kanban");
  });

  test("writes an entry's fallback when no type is known, and no line without one", () => {
    const withFallback = [{ goal: "Do a thing", types: ["nope"], fallback: "a plain `excerpt`" }];
    expect(renderPayoff(WIDGET_TYPES, READY_MOLECULES, withFallback)).toContain(
      "- Do a thing: a plain `excerpt`",
    );
    const without = [{ goal: "Do a thing", types: ["nope"] }];
    expect(renderPayoff(WIDGET_TYPES, READY_MOLECULES, without)).not.toContain("Do a thing");
  });

  test("the diagram entry offers an image of the rendered file or an excerpt of its source", () => {
    expect(renderPayoff(WIDGET_TYPES, READY_MOLECULES)).toContain(
      "an `image` of the rendered file, or an `excerpt` of its source",
    );
  });
});

describe("COMPLETE_ASK_EXAMPLE", () => {
  test("is an ask with one question holding an excerpt and exactly one recommended option", () => {
    expect(COMPLETE_ASK_EXAMPLE.kind).toBe("ask");
    const ask = COMPLETE_ASK_EXAMPLE.value as {
      askId: string;
      language: string;
      items: { props: { options: { recommended?: boolean }[]; items: { type: string }[] } }[];
    };
    expect(ask.askId).toBeTruthy();
    expect(ask.language).toBeTruthy();
    expect(ask.items).toHaveLength(1);
    const props = ask.items[0]?.props;
    expect(props?.items.map(({ type }) => type)).toContain("excerpt");
    expect(props?.options.filter((o) => o.recommended === true)).toHaveLength(1);
  });
});
