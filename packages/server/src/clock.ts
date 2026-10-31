// ask-core's Clock port (ask-lifecycle, design decision 3), with the runtime's `Date` and
// `setTimeout`: the core's time and the grace timer, so ask-core itself stays runtime-neutral
// (AD-1). Task 5.3 wires the rest of the ask lifecycle.

import type { Clock } from "@askboard/core";

export const systemClock: Clock = {
  now: () => Date.now(),
  after: (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
};
