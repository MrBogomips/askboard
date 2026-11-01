// Prints every locale fixture's text in both locales as JSON; the determinism test runs it under
// each time zone and runtime locale.

import { formatResults } from "./cases.ts";

console.log(JSON.stringify(formatResults()));
