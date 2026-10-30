// A test-only component chunk's entry: it registers, under the Choice's catalog name, a component
// that throws while rendering, so a browser test can check that the item's error boundary holds
// (view spec, "An item that fails"; AD-9). Like the real chunks it reaches the shell's
// `CatalogRenderer` port through the shared-module registry, never a copy of its own (design
// decision 7); the type import keeps it in step with the port.

import { CHOICE } from "../../../src/catalog/components.ts";
import type * as Port from "../../../src/catalog/port.ts";
import { shared } from "../../../src/shared-modules.ts";
import { THROWING_CHOICE_ERROR } from "./throwing-choice-error.ts";

/** The name the shell provides the port by, as the view build maps it (shell/index.tsx). */
const CATALOG_PORT = "@askboard/view/catalog";

const port = shared(CATALOG_PORT) as typeof Port;

port.register(CHOICE, () => {
  throw new Error(THROWING_CHOICE_ERROR);
});
