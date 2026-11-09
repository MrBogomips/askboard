// A test-only component chunk's entry: it registers, under the TextField's catalog name, a probe
// type with a key table (keyboard-shortcuts-help, tasks 3.3 and 3.4), so that a browser test can
// check the key hints, the Keys button and the keys panel of the item frame before a real widget
// registers a table. It draws a toolbar (two tools in a `KeyHint`, then the Keys button), a list
// that takes focus, and a text field. The
// item's `label` is agent text, drawn in the list: the panel must never show it. Like the real
// chunks it reaches the shell's `CatalogRenderer` port through the shared-module registry, never a
// copy of its own (design decision 7); the type imports keep it in step with the port.

import { type KeyEntry, ownEntry, vocabularyEntry } from "@askboard/contract";
import type * as React from "react";
import type * as Port from "../../../src/catalog/port.ts";
import { shared } from "../../../src/shared-modules.ts";

/** The name the shell provides the port by, as the view build maps it (shell/index.tsx). */
const CATALOG_PORT = "@askboard/view/catalog";

const port = shared(CATALOG_PORT) as typeof Port;
const react = shared("react") as typeof React;

// `KeyHint` takes its control as children; the cast lets createElement pass it as an argument.
const Hint = port.KeyHint as (props: {
  entry: KeyEntry;
  children?: React.ReactNode;
}) => React.ReactNode;

const MOVE_UP = vocabularyEntry("move.up", "list", "tool");
const MOVE_TOP = vocabularyEntry("move.top", "list", "tool");

// A `readOnly` entry of each `shows`, a navigation entry that is not `readOnly`, and a keyless one.
const KEYS = [
  vocabularyEntry("cursor.down", "list", "navigation"),
  vocabularyEntry("select.toggle", "list", "pointer", { readOnly: true }),
  MOVE_UP,
  MOVE_TOP,
  vocabularyEntry("toolbar.next", "toolbar", "navigation", { readOnly: false }),
  vocabularyEntry("keys.open", "list", "panel"),
  ownEntry("probe.menu", "toolbar", [], "menu", { readOnly: true, label: "kanban.moveTo" }),
];

type ProbeProps = { readonly label?: string };

const Probe = ({ item, ready }: Port.ItemProps<Port.BoardWidgetItem>) => {
  const props = item.props as ProbeProps;
  port.useReadyAfterLayout(ready);
  const h = react.createElement;
  const tool = (name: string, entry: KeyEntry, text: string) =>
    h(
      Hint,
      { entry },
      h(
        "button",
        { type: "button", "data-probe-tool": name, "aria-label": `${text} ${item.id}` },
        text,
      ),
    );
  return h(
    "div",
    { "data-probe-item": item.id },
    h(
      "div",
      { role: "toolbar", "aria-label": `Probe tools ${item.id}` },
      tool("up", MOVE_UP, "Probe up"),
      tool("top", MOVE_TOP, "Probe top"),
      h(port.KeysButton, { "aria-label": `Keys ${item.id}` }),
    ),
    h(
      "div",
      {
        role: "listbox",
        tabIndex: 0,
        "data-probe-list": item.id,
        "aria-label": `Probe list ${item.id}`,
      },
      props.label ?? "",
    ),
    h("input", { type: "text", "data-probe-text": item.id, "aria-label": `Probe text ${item.id}` }),
  );
};

port.register("text-field", Probe, { keys: KEYS, name: "change.widgetRanking" });
