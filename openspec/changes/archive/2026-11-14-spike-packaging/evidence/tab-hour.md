# Criterion 13: the background board tab for an hour (run `tab-hour`)

Question [F33]: does a browser discard or freeze a background AskBoard board tab within an hour? The board holds a WebSocket to the session process on `127.0.0.1`, and AD-21 discards the ask when the board disconnects and does not reconnect within the grace period.

## The run

- Run `tab-hour`, 2026-10-30 from 10:20 to 11:29 CET, macOS 26.6.2 (arm64, 36 GiB, on AC power, 45 % memory free at the start), Playwright 1.64.1, Bun 1.4.4.
- Probe: `probe/tab.ts` serves the board stand-in on `127.0.0.1` (random port): a WebSocket back to the server, a heartbeat every 5 s carrying `performance.now()`, `document.visibilityState` and `document.hasFocus()`, and the page's `visibilitychange`, `freeze`, `resume`, `pagehide`, `pageshow` and `document.wasDiscarded` at load; it reconnects 1 s after a close. The server logs every event and every WebSocket open and close (with its code) as JSONL with a server timestamp. `probe/tab-drive.ts` opens the board in tab 1, opens a second tab in front, and keeps both for 65 minutes; no browser window was opened on screen.
- Command, from `openspec/changes/spike-packaging/probe/` with `PLAYWRIGHT_BROWSERS_PATH` set to the scratch browser folder:

  ```sh
  bun tab-drive.ts --run tab-hour --minutes 65 --engines raw-chrome,raw-firefox-installed,pw-chromium,pw-firefox,pw-webkit --scratch <scratch>
  bun tab-drive.ts --run tab-hour --minutes 65 --engines raw-chromium --scratch <scratch>   # started 4 minutes later
  ```

  `raw-chromium` started 4 minutes after the others, once its keychain stall was found (below); all six overlapped for 61 minutes. Each engine lasted 65.1 minutes from its server's start, with the board hidden (or, for `pw-*`, behind the front tab) from minute 0.1.
- Raw logs and per-engine summaries: `probe/runs/tab-hour/<engine>.jsonl` and `<engine>.summary.json` (git ignores `runs/`). Smoke runs before it: `tab-smoke` (2 min) and `tab-smoke-2` (1 min). Re-summarise any log with `bun tab.ts report runs/tab-hour/<engine>.jsonl`.

## Modes, and which ones the run covers

Playwright keeps every page it controls visible: in headless Chromium, Firefox and WebKit the background board reported `visible` and `hasFocus() === true` for the whole smoke run, after `newPage()` and `bringToFront()`; in Chromium it stayed visible even with its window minimised over CDP, consistent with the focus emulation Playwright enables on every page. Opening windows on screen was ruled out. So the hidden-tab modes launch the browser binary headless themselves and open the front tab over the browser's own protocol, without attaching to the board; in new headless Chrome the two tabs share one window, as in a desktop browser:

| Engine | Browser and mode | Second tab | Board seen as | Covers |
|---|---|---|---|---|
| `raw-chrome` | installed Google Chrome 156.0.8078.79, `--headless=new`, fresh user-data-dir | CDP `Target.createTarget`, same window, in front | `hidden`, `hasFocus()` false | timer throttling and lifecycle of a hidden tab, headless; no memory pressure |
| `raw-chromium` | Playwright's Chromium binary (Chrome for Testing 156.0.8078.4), `--headless=new`, `--use-mock-keychain` | as above | `hidden`, `hasFocus()` false | as above |
| `raw-firefox-installed` | installed Firefox 124.0.2, `--headless`, fresh profile | WebDriver BiDi `browsingContext.create`, in front | `hidden`, `hasFocus()` false | as above |
| `pw-chromium` | Playwright's Chromium headless shell 156.0.8078.4, with Playwright's three background-disabling switches removed | Playwright `newPage()` and `bringToFront()` | `visible`, `hasFocus()` true | headless keeps the tab visible: the run does not cover discarding |
| `pw-firefox` | Playwright's Firefox 157.0, headless | as above | `visible`, `hasFocus()` true | headless keeps the tab visible: the run does not cover discarding |
| `pw-webkit` | Playwright's WebKit 27.2, headless | as above | `visible`, `hasFocus()` true | headless keeps the tab visible: the run does not cover discarding |

- Without `--use-mock-keychain`, Chrome for Testing waited on a macOS keychain prompt and never requested the board; the installed Chrome found its keychain item and ran without the switch.
- Playwright launches Chromium with `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows` and `--disable-renderer-backgrounding`; `pw-chromium` removes them with `ignoreDefaultArgs`, the `raw-*` modes never had them.
- In a first smoke, whose logs were overwritten, Playwright-driven new headless Chromium (`channel: "chromium"`) and the installed Chrome (`channel: "chrome"`, fresh user-data-dir) also kept the background board visible.

## Results after 65 minutes

No engine disconnected, froze or discarded the board in the hour. In every mode the board kept one WebSocket for the whole run, loaded once, and logged no `freeze`, `resume` or `pagehide` before the teardown; the one close per engine is the driver shutting the browser at minute 65.1.

| Engine | Browser | Board seen as (heartbeats) | WebSocket disconnects in the hour | Longest heartbeat gap | How the gap grew | Freeze, resume, discard |
|---|---|---|---|---|---|---|
| `raw-chrome` | Google Chrome 156.0.8078.79 | `hidden` (76 of 76) | 0; closed with 1001 at teardown | 60.1 s | 5 s for the first 57 s hidden, one 22 s gap at 79 s, then 60 s from 2.3 minutes after hiding to the end (every 5-minute window: 60.0 to 60.1 s) | none; `wasDiscarded` false |
| `raw-chromium` | Chrome for Testing 156.0.8078.4 | `hidden` (76 of 76) | 0; 1001 at teardown | 60.1 s | 5 s for the first 58 s hidden, one 35 s gap at 93 s, then 60 s from 2.5 minutes after hiding to the end | none; `wasDiscarded` false |
| `raw-firefox-installed` | Firefox 124.0.2 | `hidden` (779 of 779) | 0; 1006 at teardown | 5.1 s | never: 5.0 to 5.1 s for the hour | none; `wasDiscarded` not supported |
| `pw-chromium` | Chromium headless shell 156.0.8078.4 | `visible` (780) | 0; 1001 at teardown | 5.0 s | never | none; `wasDiscarded` false |
| `pw-firefox` | Firefox 157.0 (Playwright build) | `visible` (779) | 0; 1001 at teardown | 5.1 s | never | none; `wasDiscarded` not supported |
| `pw-webkit` | WebKit 27.2 (Playwright build) | `visible` (780) | 0; 1006 at teardown | 5.0 s | never | none; `wasDiscarded` not supported |

Reading for AD-21:

- Within an hour, headless and without memory pressure, neither hidden Chrome nor hidden Firefox drops the board's socket, freezes it or discards it.
- Hidden Chrome runs the board's repeating timer once a minute from about one minute after the tab goes to the background (consistent with Chrome's intensive wake-up throttling). Anything in the board driven by a repeating timer, such as an application heartbeat, fires at most once a minute while hidden, so a server rule that reads a missing board heartbeat as a disconnect needs more than 60 s of tolerance; the socket itself stays open meanwhile.
- When the socket does drop, a hidden board reconnects in about 1.3 s (run `tab-drop`, next section); a frozen board reconnects as it thaws, and a discarded board only when the user returns to it (run `tab-forced`). A discard therefore outlasts any short grace period.

## Reconnect from a hidden tab (run `tab-drop`)

A hidden board must reconnect on its own when the socket drops. `bun tab-drive.ts --run tab-drop --minutes 8 --drop-every 150 --engines raw-chrome,raw-chromium,raw-firefox-installed --scratch <scratch>` closes every board socket from the server (code 4000) at 2.5, 5 and 7.5 minutes, with the board hidden since the start; log `probe/runs/tab-drop/<engine>.jsonl`.

| Engine | Reconnect after each drop (s) | Heartbeat gap meanwhile |
|---|---|---|
| raw-chrome (Chrome 156.0.8078.79) | 1.34, 1.34, 1.34 | 60 s, as in `tab-hour` |
| raw-chromium (Chromium 156.0.8078.4) | 1.34, 1.34, 1.34 | 60 s |
| raw-firefox-installed (Firefox 124.0.2) | 1.01, 1.00, 1.01 | 5 s |

The board's 1 s reconnect timer, started from the `close` event, is not held to the once-a-minute rate that throttles its repeating heartbeat: Chrome delayed it by about 0.34 s only.

## Forced freeze and discard (run `tab-forced`)

To see what a freeze and a discard look like to the session process, `probe/tab-force.ts` forces both on a hidden board in Playwright's Chromium binary (Chrome 156.0.8078.4, new headless, raw CDP, an unpacked extension for `chrome.tabs`): `bun tab-force.ts --run tab-forced --scratch <scratch>`, 110 s, log `probe/runs/tab-forced/chromium-forced.jsonl`.

| Step (s) | What the server saw |
|---|---|
| 4: front tab opened | `visibilitychange` to `hidden` |
| 24: frozen for 30 s (CDP `Page.setWebLifecycleState`) | `freeze`; no heartbeat for 30 s; the WebSocket stayed open |
| 54: unfrozen | `resume`, then the WebSocket closed at once (server code 1001, page code 1006); the board reconnected 1.2 s later |
| 74: discarded (`chrome.tabs.discard`) | `pagehide` (`persisted: false`), WebSocket closed (1001); no reconnect while discarded |
| 94: the board tab activated | the page loaded again (from the cache, no HTTP request), `wasDiscarded: true`, `sessionStorage` kept; the WebSocket reopened |

So a freeze costs one reconnect when the tab thaws, and a discard leaves the session with no board until the user returns to the tab, which then reloads.

## What the run does not cover

- **Memory pressure**: the machine had 36 GiB with about 45 % free; no browser came under memory pressure, so the low-memory discarding of Chrome and Firefox did not get a chance to act.
- **Chrome Memory Saver and Energy Saver**: the scratch Chrome profiles had their defaults; Memory Saver discards inactive tabs after a mode-dependent delay, which is what task 7.4 checks. Energy Saver (battery) was not active: the machine was on AC power.
- **Safari**: Playwright's WebKit is not Safari, and in Playwright it keeps the background page visible, so the `pw-webkit` row says nothing about Safari's tab policies.
- **Current Firefox**: the hidden Firefox tab is the installed Firefox 124.0.2, an old release. Playwright's own Firefox build (157.0) could not be put in the background: it never answers WebDriver BiDi `browsingContext.create` (15 s timeout in `tab-smoke-2`), and a tab opened by the board with `window.open` left the board visible.
- **Headed windows, App Nap, display or system sleep**: every engine ran headless; a minimised or occluded window, macOS App Nap of a backgrounded application, a sleeping display and a sleeping machine were not tried. A sleeping machine suspends the session process as well.
- **Server-side liveness**: the stand-in server used Bun's defaults (WebSocket `idleTimeout` 120 s, `sendPings` on). Whether the browser answers protocol pings while its page timers run once a minute was not measured separately.
- **A natural freeze or discard**: none happened in an hour, so their effect was measured only by forcing them (next section); `chrome://discards` was not read.

## Steps for the product owner (task 7.4)

Repeat it in branded Chrome with Memory Saver on, and in Safari, on the machine and power setting the board will be used with. Allow 70 minutes; both browsers can run at the same time with two servers.

1. Start one stand-in server per browser, from `openspec/changes/spike-packaging/probe/` (no `bun install` needed: `tab.ts` uses Bun only). `caffeinate -i` keeps the Mac from idle sleep for as long as the server runs:

   ```sh
   caffeinate -i bun tab.ts serve --run po-tab --engine chrome-memory-saver
   caffeinate -i bun tab.ts serve --run po-tab --engine safari
   ```

   Each prints one line such as `{"board":"http://127.0.0.1:52345/board","blank":"http://127.0.0.1:52345/blank","log":".../runs/po-tab/safari.jsonl"}`.
2. **Chrome**: in Settings, Performance, turn Memory Saver on and note the mode chosen (moderate, balanced or maximum). Open the `board` URL in a new tab and wait until the page shows `hb` with a time. Open another tab (any site) in the same window and stay on it; do not open DevTools on the board tab. Use the machine as usual for an hour without returning to the board tab. Optionally, open `chrome://discards` near the end and note the board row's visibility, loading state, "frozen" and discard count.
3. **Safari**: the same with the Safari server's `board` URL: board tab first, then another tab in front, an hour without returning.
4. After the hour, click the board tab once in each browser (a discarded tab reloads now), wait 10 s, then stop each server with Ctrl-C.
5. Read each log:

   ```sh
   bun tab.ts report runs/po-tab/chrome-memory-saver.jsonl
   bun tab.ts report runs/po-tab/safari.jsonl
   ```

   What to read in the output:
   - `wsCloses`: each WebSocket close with its minute, code and `reopenedAfterS` (seconds until the board reconnected). Any close before step 4 is a disconnect AD-21 must survive; a gap longer than the grace period loses the ask.
   - `pageLoads` greater than 1, or `true` in `wasDiscarded` (Chrome only): the browser discarded the tab and reloaded it on return.
   - `longestGapS` and `maxGapPer5MinS`: how far the heartbeat stretched; `firstGapOver7_5sAtMin` says when throttling began.
   - `visibilityAfterFrontTab`: should be `hidden`; `visible` means the tab was not really in the background.
   - `lifecycle`: `freeze` and `resume` with their minutes, if any. `wasDiscarded` is `null` where the browser lacks it, as Firefox and Playwright's WebKit did here; expect the same from Safari, where `pageLoads` is the discard signal.
6. Record the outcome in `findings.md`, § Criterion 13: browser version, Memory Saver mode, and the items above. To see a discard in the log before the hour run, `chrome://discards` has an "Urgent Discard" link per tab; a forced discard (run `tab-forced`) gave a `pagehide`, a close with code 1001, and on return a second page load with `wasDiscarded: true`.
