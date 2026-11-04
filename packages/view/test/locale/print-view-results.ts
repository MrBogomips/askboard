// Prints the view's value fixtures and a message time at the viewer's offset as JSON; the
// determinism test runs it under each time zone and runtime locale.

import { viewerTimes, viewResults } from "./view-cases.ts";

console.log(JSON.stringify({ fixed: viewResults(), viewer: viewerTimes("2026-10-31T17:42:05Z") }));
