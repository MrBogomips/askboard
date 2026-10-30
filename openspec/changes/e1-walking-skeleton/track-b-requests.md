# Track B requests

Changes Track B needs in files it does not own (tasks.md, Parallel tracks). Each entry says what, why, the task it blocks, and how Track B works around it meanwhile.

## 1. One rule for the board page's CSP (task 8.3, not blocking)

- **What:** a contract function, for example `boardPagePolicy(manifest: ViewManifest): string` beside `cspHashSource` in `packages/contract/src/hash.ts` or `routes.ts`, that builds the board page's policy from the manifest: `default-src 'none'`, `script-src` with the board page script's hash and every chunk script's, `style-src` with the board page's and every chunk's style hashes (`'none'` when there are none), `connect-src 'self'`, `img-src data: blob:`, `font-src data:`, and no `frame-src` in E1 (AD-8, design decision 5, board-host spec "The board page and its policy").
- **Why:** `board-host` (Track A, 6.3) computes this policy, and so does the view's test server (Track B, 8.3), which must answer as `board-host` does. Two copies of one rule can drift, in a directive or in whether `default-src 'none'` is there, and the browser tests would then pass against a policy the real session process does not send.
- **Blocks:** nothing. Workaround: the test server's own copy, `packages/view/test/browser/harness/policy.ts` (`boardPagePolicy`), unit-tested against the rule above; the harness check in `harness.browser.ts` compares the served policy with it by directives and sources, not by text, so 9.3 can run it against `board-host` whatever order that writes. If the contract gains the function, the test server uses it and its copy goes.
