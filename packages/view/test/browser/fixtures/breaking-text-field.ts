// A test-only component chunk's entry: it registers, under the TextField's catalog name, a button
// that reports ready once laid out and throws on its next render once pressed, so a browser test can
// make a widget item fail after its question counted as visible (view spec, "An item that fails
// stops every act of its question"; AD-9, AD-10; Issue #103). Like the real chunks it reaches the
// shell's `CatalogRenderer` port through the shared-module registry, never a copy of its own (design
// decision 7); the type imports keep it in step with the port.

import type * as React from "react";
import type * as Port from "../../../src/catalog/port.ts";
import { shared } from "../../../src/shared-modules.ts";

/** The name the shell provides the port by, as the view build maps it (shell/index.tsx). */
const CATALOG_PORT = "@askboard/view/catalog";

/** The error the test-only TextField throws once pressed. */
const BREAKING_FIELD_ERROR = "the test-only TextField broke after it counted as visible";

const port = shared(CATALOG_PORT) as typeof Port;
const react = shared("react") as typeof React;

const Breaking = ({ item, ready }: Port.ItemProps<{ readonly id: string }>) => {
  const [broken, setBroken] = react.useState(false);
  port.useReadyAfterLayout(ready);
  if (broken) throw new Error(BREAKING_FIELD_ERROR);
  return react.createElement(
    "button",
    { type: "button", onClick: () => setBroken(true) },
    `Break ${item.id}`,
  );
};

port.register("text-field", Breaking);
