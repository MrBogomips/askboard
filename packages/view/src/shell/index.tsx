// The view shell's entry, bundled into the shell chunk (design decisions 7 and 8). It provides the
// `CatalogRenderer` port to the component chunks, which run after it, and boots once the srcdoc
// has parsed, when every chunk has run: it reads the `askboard-data` block, renders each item
// through the catalog and connects ext-apps' `App` to the board page. Task 8.4 builds the renderer
// out: the item frame, the error boundary, ready tracking and the draft store.

import type { BoardDocument } from "@askboard/contract";
import { App } from "@modelcontextprotocol/ext-apps";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BOOT_DATA_ID, parseBootData } from "../boot-data.ts";
import { componentOf } from "../catalog/components.ts";
import * as port from "../catalog/port.ts";
import { provide } from "../shared-modules.ts";

/** The name component chunks import the port by; the view build maps it to this chunk's copy. */
const CATALOG_PORT = "@askboard/view/catalog";

provide(CATALOG_PORT, port);

const Item = ({ item }: { item: BoardDocument["items"][number] }) => {
  const [value, setValue] = useState<readonly string[]>([]);
  const Component = port.componentFor(componentOf(item));
  if (Component === undefined) return null;
  return <Component item={item} value={value} onValueChange={setValue} />;
};

const Board = ({ document }: { document: BoardDocument }) => (
  <main className="flex flex-col gap-4 p-4">
    {document.items.map((item) => (
      <Item key={item.id} item={item} />
    ))}
  </main>
);

const boot = (): void => {
  const data = parseBootData(document.getElementById(BOOT_DATA_ID)?.textContent);
  const root = document.getElementById("root");
  if (root === null) throw new Error("the view has no #root element");
  createRoot(root).render(<Board document={data.document} />);
  // A Snapshot has no host, so the view-protocol handshake starts only under a parent (AD-9).
  if (window.parent !== window) {
    void new App({ name: "askboard-view", version: "0.0.0" }).connect();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
