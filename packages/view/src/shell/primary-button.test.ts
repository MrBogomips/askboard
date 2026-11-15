import { describe, expect, test } from "bun:test";
import { BOARD_KEYS, type KeyEntry } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrimaryButton, type PrimaryButtonProps } from "./primary-button.tsx";

// The primary button's keys (board-keys, design decisions 4 and 5; spec: Answer by key, The board's
// keys are discoverable): `data-askboard-primary`, `aria-keyshortcuts`, the blocked reason.

const answerEntry = BOARD_KEYS.find((entry) => entry.action === "board.answer") as KeyEntry;
const base: PrimaryButtonProps = {
  card: { canAnswer: true, ready: false },
  children: "Answer",
  entry: answerEntry,
  describedBy: undefined,
  single: false,
  submitted: false,
  onAnswer: () => {},
};

const draw = (over: Partial<PrimaryButtonProps> = {}) =>
  renderToStaticMarkup(
    createElement(Tooltip.Provider, null, createElement(PrimaryButton, { ...base, ...over })),
  );

describe("the primary button", () => {
  test("carries data-askboard-primary, once, on the Answer button", () => {
    const html = draw();
    expect(html.match(/data-askboard-primary/g)?.length).toBe(1);
    expect(html).toMatch(/<button[^>]*data-askboard-primary[^>]*>Answer<\/button>/);
  });

  test("an enabled one carries aria-keyshortcuts Control+Enter Meta+Enter", () => {
    expect(draw()).toContain('aria-keyshortcuts="Control+Enter Meta+Enter"');
  });

  test("a blocked one is disabled and keeps aria-describedby", () => {
    const html = draw({ card: { canAnswer: false, ready: false }, describedBy: "reason" });
    expect(html).toContain("disabled");
    expect(html).toContain('aria-describedby="reason"');
  });

  test("an entry with no keys, as {board.answer: []} gives, carries no aria-keyshortcuts", () => {
    const html = draw({ entry: { ...answerEntry, keys: [] } });
    expect(html).toContain("data-askboard-primary");
    expect(html).not.toContain("aria-keyshortcuts");
  });

  test("a table without the entry draws the button as it is", () => {
    expect(draw({ entry: undefined })).not.toContain("aria-keyshortcuts");
  });

  test("submitted delivery shows the ready state as aria-pressed; immediate has none", () => {
    expect(draw({ submitted: true, card: { canAnswer: true, ready: true } })).toContain(
      'aria-pressed="true"',
    );
    expect(draw()).not.toContain(' aria-pressed="');
  });

  test("a press gives the pressed button to onAnswer", () => {
    const seen: unknown[] = [];
    const tree = PrimaryButton({ ...base, entry: undefined, onAnswer: (c) => seen.push(c) });
    const press = (tree as ReactElement<{ onClick: (event: unknown) => void }>).props.onClick;
    const button = {};
    press({ currentTarget: button });
    expect(seen).toEqual([button]);
  });
});
