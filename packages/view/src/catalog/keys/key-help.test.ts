import { describe, expect, test } from "bun:test";
import { type KeyEntry, ownEntry, RANKING_KEYS } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../port.ts";
import { KeyHint, KeysButton, KeysPanelContext, useKeysPanel } from "./key-help.tsx";

// The hint's and the button's markup (keyboard-shortcuts-help, design decision 5; spec: Keyboard
// shortcuts are discoverable): `aria-keyshortcuts` from the table, the Keys button that opens the
// frame's panel. What opens and closes in a browser is the browser files' (`keys-help.browser.ts`).

const provided = (node: ReactNode, language: "en-US" | "it-IT" = "en-US") =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(Tooltip.Provider, null, node),
    ),
  );

// `KeyHint` takes its control as children; the cast lets createElement pass it as an argument.
const Hint = KeyHint as (props: { entry: KeyEntry; children?: ReactNode }) => ReactNode;

const moveUp = RANKING_KEYS.find((entry) => entry.action === "move.up");
if (moveUp === undefined) throw new Error("the Ranking has no move.up entry");

describe("KeyHint", () => {
  test("puts aria-keyshortcuts from the table on the control it wraps", () => {
    const html = provided(
      createElement(Hint, { entry: moveUp }, createElement("button", { type: "button" }, "Up")),
    );
    expect(html).toContain('aria-keyshortcuts="Alt+Shift+ArrowUp"');
    expect(html).toContain(">Up</button>");
  });

  test("a keyless entry leaves the control as it is", () => {
    const keyless = ownEntry("probe.menu", "toolbar", [], "menu", { readOnly: false });
    const html = provided(
      createElement(Hint, { entry: keyless }, createElement("button", { type: "button" }, "M")),
    );
    expect(html).not.toContain("aria-keyshortcuts");
    expect(html).toContain(">M</button>");
  });
});

describe("KeysButton", () => {
  test("with no panel in the frame it draws nothing", () => {
    expect(provided(createElement(KeysButton))).toBe("");
  });

  test("with a panel it is a button that opens a dialog, named Keys, with `?` as its key", () => {
    const html = provided(
      createElement(
        KeysPanelContext.Provider,
        { value: { open: () => {}, anchor: () => {} } },
        createElement(KeysButton),
      ),
    );
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-keyshortcuts="?"');
    expect(html).toContain(">Keys</button>");
  });

  test("named in the board's language", () => {
    const html = provided(
      createElement(
        KeysPanelContext.Provider,
        { value: { open: () => {}, anchor: () => {} } },
        createElement(KeysButton),
      ),
      "it-IT",
    );
    expect(html).toContain(">Tasti</button>");
  });

  test("a class from the caller replaces the default", () => {
    const html = provided(
      createElement(
        KeysPanelContext.Provider,
        { value: { open: () => {}, anchor: () => {} } },
        createElement(KeysButton, { className: "mine" }),
      ),
    );
    expect(html).toContain('class="mine"');
  });
});

let seen: unknown = "unset";
const Probe = () => {
  seen = useKeysPanel();
  return null;
};

describe("useKeysPanel", () => {
  test("is undefined outside a frame with a panel", () => {
    renderToStaticMarkup(createElement(Probe));
    expect(seen).toBeUndefined();
  });
});
