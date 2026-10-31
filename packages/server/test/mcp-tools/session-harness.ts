// A session process for session-process.test.ts: mcp-tools over the real stdio and the real process
// signals, around the real ask-core with ports that open nothing.

import { AskCore } from "@askboard/core";
import { processOf, serveSession, systemTimers } from "../../src/mcp-tools/index.ts";

const LINK = "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A";

const core = new AskCore({
  randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
  showing: { check: async () => ({ showable: true }), open: () => undefined },
  address: { link: async () => LINK },
  identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
  report: () => process.stderr.write("askboard: report\n"),
});

serveSession({
  deps: {
    core,
    timers: systemTimers,
    diagnostics: { write: (line) => process.stderr.write(`${line}\n`) },
  },
  process: processOf(process),
});
