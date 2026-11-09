import { describe, expect, test } from "bun:test";
import { type KeyEntry, ownEntry, RANKING_KEYS } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../port.ts";
import { keyTableOf } from "./effective.ts";
import { KeyHint, KeysButton, KeysPanelContext, useKeysPanel } from "./key-help.tsx";
import {
  KeyOverridesContext,
  KeyTableContext,
  useKeyOverrides,
  useKeysOpenEntry,
  useKeyTable,
} from "./key-table.tsx";

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

// The keys in effect (keyboard-shortcuts-help, task 10.2; view spec: Keyboard shortcuts are
// discoverable, The keys panel shows the user's changes). A Radix trigger carries `data-state`, which a
// control with no tooltip does not: it tells a removed action's hint from a table's keyless entry.
describe("KeyHint with the user's keys", () => {
  const button = createElement("button", { type: "button" }, "Up");
  const inFrame = (overrides: Record<string, readonly string[]>, node: ReactNode) =>
    createElement(KeyTableContext.Provider, { value: keyTableOf(RANKING_KEYS, overrides) }, node);

  test("inside a frame a widget's static entry shows and announces the keys in effect", () => {
    const html = provided(
      inFrame({ "move.up": ["Mod+Alt+ArrowUp"] }, createElement(Hint, { entry: moveUp }, button)),
    );
    expect(html).toContain('aria-keyshortcuts="Control+Alt+ArrowUp Meta+Alt+ArrowUp"');
    expect(html).not.toContain("Alt+Shift+ArrowUp");
  });

  test("outside a frame it shows the entry as given, whatever the overrides are", () => {
    const html = provided(
      createElement(
        KeyOverridesContext.Provider,
        { value: { "move.up": ["Mod+Alt+ArrowUp"] } },
        createElement(Hint, { entry: moveUp }, button),
      ),
    );
    expect(html).toContain('aria-keyshortcuts="Alt+Shift+ArrowUp"');
  });

  test("an action the user removed the keys of keeps its tooltip and carries no attribute", () => {
    const html = provided(
      inFrame({ "move.up": [] }, createElement(Hint, { entry: moveUp }, button)),
    );
    expect(html).not.toContain("aria-keyshortcuts");
    expect(html).toContain('data-state="closed"');
    expect(html).toContain(">Up</button>");
  });

  test("a table's keyless entry still has neither tooltip nor attribute, overrides or not", () => {
    const keyless = ownEntry("probe.menu", "toolbar", [], "menu", { readOnly: false });
    const html = provided(
      createElement(
        KeyTableContext.Provider,
        { value: keyTableOf([keyless], { "move.up": [] }) },
        createElement(Hint, { entry: keyless }, button),
      ),
    );
    expect(html).not.toContain("aria-keyshortcuts");
    expect(html).not.toContain("data-state");
  });
});

describe("KeysButton with the user's keys", () => {
  const withPanel = (overrides: Record<string, readonly string[]> | undefined) =>
    provided(
      createElement(
        KeyOverridesContext.Provider,
        { value: overrides },
        createElement(
          KeysPanelContext.Provider,
          { value: { open: () => {}, anchor: () => {} } },
          createElement(KeysButton),
        ),
      ),
    );

  test("its attribute comes from keys.open in effect", () => {
    const html = withPanel({ "keys.open": ["Mod+Alt+Enter"] });
    expect(html).toContain('aria-keyshortcuts="Control+Alt+Enter Meta+Alt+Enter"');
    expect(html).not.toContain('aria-keyshortcuts="?"');
  });

  test("given no key it is still a button named Keys, with a tooltip and no attribute", () => {
    const html = withPanel({ "keys.open": [] });
    expect(html).toContain(">Keys</button>");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('data-state="closed"');
    expect(html).not.toContain("aria-keyshortcuts");
  });

  test("overrides that do not name it leave `?`", () => {
    expect(withPanel({ "move.top": [] })).toContain('aria-keyshortcuts="?"');
    expect(withPanel(undefined)).toContain('aria-keyshortcuts="?"');
  });
});

const read: { table?: unknown; open?: unknown; overrides?: unknown } = {};
const Reader = () => {
  read.table = useKeyTable(RANKING_KEYS);
  read.open = useKeysOpenEntry();
  read.overrides = useKeyOverrides();
  return null;
};
const ReadUndefined = () => {
  read.table = useKeyTable(undefined);
  return null;
};

describe("useKeyTable, useKeysOpenEntry and useKeyOverrides", () => {
  const drawn = (overrides: Record<string, readonly string[]> | undefined) =>
    renderToStaticMarkup(
      createElement(KeyOverridesContext.Provider, { value: overrides }, createElement(Reader)),
    );

  test("with no overrides every entry is the table's, and `keys.open` is `?`", () => {
    drawn(undefined);
    const table = read.table as readonly { source: string }[];
    expect(table).toHaveLength(RANKING_KEYS.length);
    expect(table.every((entry) => entry.source === "table")).toBe(true);
    expect(read.overrides).toBeUndefined();
    expect((read.open as { keys: unknown }).keys).toEqual([{ key: "?", hold: "char" }]);
  });

  test("with overrides, the entries they name are the user's", () => {
    const overrides = { "move.up": [], "keys.open": ["Mod+Alt+Enter"] };
    drawn(overrides);
    const table = read.table as readonly { action: string; source: string }[];
    expect(table.filter((entry) => entry.source === "user").map((entry) => entry.action)).toEqual([
      "move.up",
      "keys.open",
    ]);
    expect(read.overrides).toBe(overrides);
    expect((read.open as { keys: unknown }).keys).toEqual([{ key: "Enter", hold: "mod+alt" }]);
  });

  test("a table given as undefined gives none", () => {
    read.table = "unset";
    renderToStaticMarkup(createElement(ReadUndefined));
    expect(read.table).toBeUndefined();
  });
});
