# Track A requests

Changes Track A needs in what Track 0 owns (tasks.md, Parallel tracks). Track A does not make them: each lands once, in one branch, with the other track's agreement.

## Accepted

1. **`BOARD_RESPONSES` has no answer for a request refused by the `Host` or `Origin` check** (`packages/contract/src/routes.ts`; board-host spec, Host and Origin checks). `board-host` answers it with 403 plain text, the shape of `tokenRefused`, and a refused WebSocket upgrade with a bare 403. Proposed: a `refused` entry, `{ status: 403, contentType: "text/plain; charset=utf-8" }`, so that the view's test server can answer such a request as `board-host` does. Nothing in Track B depends on it today. Raised on 2026-10-30 (task 6.2). **Accepted** by the integrator on 2026-10-30: `BOARD_RESPONSES.refused`, 403 plain text, added by Track A, tested first in the contract and in `board-host`, which answers every gate refusal with it.
