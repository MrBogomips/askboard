import { describe, expect, test } from "bun:test";
import { Tooltip } from "radix-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../catalog/port.ts";
import { DEFAULT_PRESENTATION, type PresentationControls } from "./presentation-controls.ts";
import { type HeaderCounts, ProgressRow } from "./progress-row.tsx";
import { createStore } from "./store.ts";
import { ThemeControl } from "./theme-control.tsx";

// The progress row's optional parts and the Theme tool (answering-flow-visual; "Prefill recommended"
// with its count, answering-flow-guidance decision 8).

const counts = (over: Partial<HeaderCounts> = {}): HeaderCounts => ({
  openLabel: "2 to do",
  onNextOpen: () => undefined,
  unreadReplies: 0,
  onUnread: () => undefined,
  changed: 0,
  onChanged: () => undefined,
  ...over,
});

const drawRow = (language: "en-US" | "it-IT", row: Parameters<typeof ProgressRow>[0]) =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(Tooltip.Provider, null, createElement(ProgressRow, row)),
    ),
  );

describe("the progress row", () => {
  test("shows Prefill recommended with its count, disabled when the board is locked", () => {
    const open = drawRow("en-US", {
      counts: counts(),
      prefill: { disabled: false, onPress: () => undefined, count: 4 },
    });
    expect(open).toContain("Prefill recommended (4)");
    expect(open).toContain("data-askboard-prefill");
    const locked = drawRow("en-US", {
      counts: counts(),
      prefill: { disabled: true, onPress: () => undefined, count: 1 },
    });
    expect(locked).toContain("disabled");
  });

  test("says it in Italian, and has no button with nothing to prefill", () => {
    expect(
      drawRow("it-IT", {
        counts: counts(),
        prefill: { disabled: false, onPress: () => undefined, count: 2 },
      }),
    ).toContain("Precompila le consigliate (2)");
    expect(drawRow("en-US", { counts: counts(), prefill: undefined })).not.toContain(
      "data-askboard-prefill",
    );
  });

  test("shows the unread replies and the agent's changes only when there are some", () => {
    const quiet = drawRow("en-US", { counts: counts(), prefill: undefined });
    expect(quiet).not.toContain("new replies");
    const busy = drawRow("en-US", {
      counts: counts({ unreadReplies: 3, changed: 1 }),
      prefill: undefined,
    });
    expect(busy).toContain("3 new replies");
    expect(busy).toContain("The agent updated this");
  });
});

describe("the Theme tool", () => {
  test("is an icon button named Theme", () => {
    const controls = {
      presentation: createStore({ ...DEFAULT_PRESENTATION, locked: [] }),
      hosted: false,
      set: () => undefined,
      openSettings: () => undefined,
    } as PresentationControls;
    const html = renderToStaticMarkup(
      createElement(
        LanguageContext.Provider,
        { value: "en-US" },
        createElement(ThemeControl, { controls }),
      ),
    );
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain("data-askboard-theme");
  });
});
