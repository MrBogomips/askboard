// Prints the hash of every fixture's results; the determinism test runs it under each time zone
// and locale.

import { resultsHash } from "./hash.ts";
import { runAll } from "./suite.ts";

const tally = runAll();
if (tally.failed > 0) {
  console.error(JSON.stringify(tally.failures.slice(0, 5)));
  process.exit(1);
}
console.log(resultsHash(tally));
