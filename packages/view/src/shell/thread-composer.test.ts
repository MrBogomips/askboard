import { describe, expect, test } from "bun:test";
import { BOARD_KEYS, type KeyEntry } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer, type ComposerProps } from "./thread-composer.tsx";

// The composer's Send and send key (board-keys, design decisions 5 and 6; spec: Follow-up thread).

const table = BOARD_KEYS as readonly KeyEntry[];
const base: ComposerProps = {
  composerRef: { current: null },
  label: "Ask the agent a follow-up…",
  sendLabel: "Send",
  value: "Why?",
  editable: true,
  canSend: true,
  table,
  onChange: () => {},
  onSend: () => {},
};

const draw = (over: Partial<ComposerProps> = {}) =>
  renderToStaticMarkup(
    createElement(Tooltip.Provider, null, createElement(Composer, { ...base, ...over })),
  );

describe("Send", () => {
  test("carries the same aria-keyshortcuts as Answer", () => {
    expect(draw()).toMatch(
      /<button[^>]*aria-keyshortcuts="Control\+Enter Meta\+Enter"[^>]*>Send<\/button>/,
    );
  });

  test("an action with no keys, or none in the table, carries none", () => {
    const keyless = table.map((entry) =>
      entry.action === "board.sendFollowUp" ? { ...entry, keys: [] } : entry,
    );
    expect(draw({ table: keyless })).not.toContain("aria-keyshortcuts");
    expect(draw({ table: [] })).not.toContain("aria-keyshortcuts");
  });
});

type Fields = { onKeyDown: (event: unknown) => void; onChange: (event: unknown) => void };
const area = (props: Partial<ComposerProps>): Fields => {
  const root = Composer({ ...base, ...props }) as ReactElement<{ children: ReactElement[] }>;
  return (root.props.children[0] as ReactElement<Fields>).props;
};
const keyEvent = (over: Record<string, unknown> = {}) => {
  const event = {
    key: "Enter",
    keyCode: 13,
    altKey: false,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    target: { tagName: "TEXTAREA" },
    prevented: false,
    preventDefault() {
      event.prevented = true;
    },
    ...over,
  };
  return event;
};

describe("the send key", () => {
  test("Mod+Enter sends once and prevents the default", () => {
    let sent = 0;
    const event = keyEvent();
    area({ onSend: () => sent++ }).onKeyDown(event);
    expect(sent).toBe(1);
    expect(event.prevented).toBe(true);
  });

  test("a repeat sends nothing, and nothing sends when it cannot", () => {
    let sent = 0;
    area({ onSend: () => sent++ }).onKeyDown(keyEvent({ repeat: true }));
    area({ onSend: () => sent++, canSend: false }).onKeyDown(keyEvent());
    expect(sent).toBe(0);
  });

  test("Enter alone is the field's", () => {
    let sent = 0;
    const event = keyEvent({ ctrlKey: false });
    area({ onSend: () => sent++ }).onKeyDown(event);
    expect(sent).toBe(0);
    expect(event.prevented).toBe(false);
  });

  test("typing reports the text", () => {
    const seen: string[] = [];
    area({ onChange: (text) => seen.push(text) }).onChange({ target: { value: "a" } });
    expect(seen).toEqual(["a"]);
  });
});
