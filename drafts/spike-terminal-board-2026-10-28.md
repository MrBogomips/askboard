# AskBoard boards in a Claude Code mod pane: research spike (2026-10-28)

**Status:** decided on 2026-10-29: boards in a pane are not in the first version and are re-evaluated later. The first-version band (option M4, §6) and the D1–D4 probes (§5.4) are settled when the mod delivery spike is proposed. This report is not authoritative: where it differs from the PRD, the spine or the UX documents under `docs/`, those win. If the idea is adopted, it goes through an OpenSpec change.

**Scope.** The product owner confirmed that "terminal-browser mod" means a Claude Code mod. Terminal browsers and terminals are covered only where the mod would rely on them.

**How facts are marked.** Everything was accessed on 2026-10-28.
- **[V]**: verified in a primary source: the official Claude Code docs, the mod types and authoring reference that Claude Code 2.1.311 writes for its build, project source, or GitHub API figures.
- **[S]**: a project's own claim, not tested.
- **[I]**: my inference.
- **[U]**: unverified, with the check that would settle it.
- **[O]**: observed on this machine.

## 1. Summary

**Recommendation: plan the board-in-a-pane for a later version (v1.x). Keep v1 to what is already in scope.**

What v1 keeps: the planned delivery mod (AD-4) shows FR-23's pending-asks list. Proposal: draw it as a band above the prompt, one row and one button per ask that opens the board in the browser. Shape that mod so a pane can be added later without reshaping it.

**Main reasons:**
- **Coverage.** The pane can only show a board as pixels from a browser engine, because no surface has a web view. Those pixels need `Image`, which draws only in kitty, Ghostty, iTerm2 under fullscreen rendering, and tmux with passthrough [V].
  - It does not draw in the Desktop app, the VS Code panel, background sessions or GNU screen [V].
  - In the product owner's setup (Herdr inside iTerm2 [O]) it most likely shows only the fallback text [I; U, probe D1].
- **Width.** A docked pane takes at most 45% of the terminal's width [V]. The board's floor is 1280 px (NFR-12).
- **Keyboard and mouse.**
  - Escape never reaches the pane's input region [V].
  - Ctrl+X chords belong to Claude Code [V].
  - Clicks need fullscreen rendering [V].
  - Native drag and drop would need experimental browser-protocol drag events [V for the protocol; U for the result].
- **Stability.** Mods are on by default [V], but the API "moves between releases" [V], and Anthropic can turn installed mods off remotely through a rollout switch [V].

**Decisions for tomorrow:**
1. Later or now (recommended: later).
2. Whether v1's delivery mod draws the pending-asks list as a band with an "Open board" button per ask (recommended: yes; it is already in scope).
3. Whether the mod-delivery spike gains the four display probes (recommended: yes, about half a day to one day).

## 2. What "terminal-browser mod" can mean

### 2.1 What a mod is, how it is built and installed, and how stable it is

**What it is** [V]:
- A plugin whose `hooks/hooks.json` names one hooks module (`"modules": ["./register.js"]`, exactly one path).
- The module is an ES module (JavaScript or TypeScript) exporting `register(on, options)`. It runs "in an environment of its own, with no DOM and no Node", and reaches files, processes, the network and the interface only through `$`.
- It may import other files of the plugin with `import` declarations. A module that contains `import()` does not load.
- A `Client` element's drawing code lives in a second file of the plugin, named by a literal relative path.

**How it is installed** [V]:
- Like any plugin, from a marketplace: `/plugin install <plugin>@<marketplace>`.
- An installed plugin runs from the copy cached at install time.
- `claude plugin validate` lists the events a mod handles and the API calls it makes. `claude plugin test` runs `*.test.ts` files with no session, so CI can run both.
- AD-19 already ships AskBoard's mod as the plugin's hooks module next to its settings hooks. A pane needs no separate installation.

**How organizations treat it** [V]:
- A mod installed from a GitHub, git, URL or npm source counts as the user's, not the organization's.
- `allowManagedModsOnly` refuses it, and so do `allowManagedHooksOnly`, `disableAllHooks`, `--safe-mode`, `--bare` and an untrusted workspace.
- A policy mod sees each mod's API calls when it loads and can refuse the whole mod. The documented example refuses any mod that calls `$.process.run` or `$.process.spawn`.

**Where it runs** [V]:
- Hooks run in the CLI, the Desktop app's Code tab, the VS Code extension, `-p` and the SDK. They don't run in Desktop sessions on WSL.
- Drawings appear in the terminal, the Desktop app and VS Code. Under `-p` and the SDK nothing draws, so AskBoard's benchmark (AD-17) never sees a pane.

**Stability:**
- On by default from 2.1.287 in the terminal and 2.1.286 in the Desktop app; `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` from early access is now ignored [V].
- Anthropic can turn installed mods off remotely: "the rollout switch served off" [V, troubleshooting page].
- The authoring reference bundled with 2.1.311: "The API is early access and moves between releases: the declaration file is the authority" [V].
- Features keep arriving: images in iTerm2 need 2.1.305, images in tmux need 2.1.310, multi-row `Input` needs 2.1.301. Before 2.1.289, a drawing error could end the session [V].
- The 2.1.311 type file has 22,672 lines; the skill describing it still says "about 14,000" [O].
- Installed mods share one worker thread. A mod traced to a worker crash is unloaded; after three crashes the session unloads every installed mod until `/reload-plugins` [V].

### 2.2 What a pane can render

**Terminal surface** [V]:
- **Elements:** `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code` (syntax colours and unified diffs), `Markdown`, `Client`, `Raster` and `Image`.
- **No HTML or web view.** No surface has one. The Desktop app and VS Code add `Svg`, at most as a "script-less sandboxed frame".

**`Image`** [V]:
- Shows PNG or RGBA bytes (at most 2 MiB per tree, crossing `$`), or a file or POSIX shared-memory object that another local process wrote. In that case the terminal "opens, reads and decodes it itself, so no pixel crosses `$`".
- Size: up to 255 × 255 cells, and 4096 × 4096 pixels for file or shared-memory sources.
- A keyed `Image` is swapped with `$.ui.blit`, which takes up to 120 frames a second and shows about 60.
- Where it draws, and where it shows its `alt` text instead:

| Context | Result |
|---|---|
| kitty 0.28 or later | Draws |
| Ghostty | Draws |
| iTerm2 3.5 or later | Draws under fullscreen rendering only, from bytes only (Claude Code 2.1.305 or later) |
| tmux 3.3 or later | Draws with `allow-passthrough` and `focus-events` on, from bytes only (Claude Code 2.1.310 or later) |
| Other terminals, GNU screen, background sessions | Shows `alt` text |
| File source over SSH | Blank |

**`Client`** [V]:
- A region drawn by a separate module that "gets no mods API".
- Receives pointer events (down, move, up, enter, leave; cells, and sub-cell positions where the terminal reports pixels).
- Receives key events "while a click has given it the focus". Each key carries `ctrl`, `shift` and `meta`, and no `alt`. "Escape never arrives: it returns the focus."
- Posts data to the hooks module at most once per frame (`ui.message`, at most 100,000 characters).
- Its code "runs on the drawing thread, a second per call at most".
- Absent from VS Code. The Desktop app has it, but with no `Image`.

**`Raster`** is a coloured cell grid of up to 512 × 256 [V].

**Pane geometry** [V]:
- With fullscreen rendering, a pane docks beside the transcript at "at most 45% of the terminal's width"; otherwise it sits inline above the prompt.
- Several panes show as tabs, one pane per `id` (an id is 1–64 letters, digits, `_` or `-`).
- A pane the mod opens on its own waits until the terminal is 144 columns wide (110 once the user has opened it before). A pane opened from the user's command or button press appears at any width.
- Pane drawings get `isFocused`, `placement` (`'dock'` or `'inline'`) and `bodyColumns`.

**Closing** [V]: `ui.close` fires before a pane closes, with the origin `plugin`, `person` or `unload`. "A hook answering without `next` keeps the pane open, save on an unload."

**Keyboard and focus** [V]:
- How a pane gets focus:
  - `focus: true` on a user-initiated open (granted only while the prompt is empty);
  - Ctrl+X then Tab;
  - a click, which in the terminal needs fullscreen rendering.
- Esc returns focus to the prompt. Ctrl+X then an arrow resizes the pane; Ctrl+X then X closes it.
- Keys reach a mod only while its pane or band has focus.

**Limits** [V]:

| Limit | Value |
|---|---|
| A hook's own time | 10 s |
| `$.http.fetch` | 30 s; 4 MiB body; text only |
| `$.process.run` | 30 s by default (10 min at most); pipes, no PTY |
| Redraws | 30 per second in the terminal |
| One drawing | 20,000 elements; 100,000 characters of text |

### 2.3 Four ways a mod could host a board

- **M1. A native board in mod elements ("board-lite").**
  - The contract is redrawn with `Text`, `Markdown`, `Code`, `Button`, `Input` and `Select`.
  - It works on the terminal, Desktop and VS Code with no browser [I].
  - It could cover Choice, Ranking (move buttons), Scale, simple Form fields, Approval, the open prompt, follow-ups, excerpts and a read-only diff. It cannot cover Graph, Gantt, Diagram, Timeline, Kanban, Image annotation, Spreadsheet or LaTeX rendering [I].
  - It is a second renderer, against AD-9's single `assemble`. The addendum parks it ("delivery in a TUI"), and §8.2 rules out "diagram previews in the terminal". AskUserQuestion already covers plain questions in the terminal.
- **M2. A pane showing terminal-browser's pixels.**
  - Prior art: terminal-browser's Claude Code mod [V, source read 2026-10-28].
    - It launches a bridge (`terminal-browser claude-bridge launch`) and long-polls `http://127.0.0.1:<port>/state` with a bearer token through `$.http.fetch`.
    - It draws one pane (id `browser`) with a keyed `Image`, whose source is a shared-memory frame, and an absolutely positioned `Client` over it. It blits each new frame.
    - It forwards pointer, key and wheel events (through `ui.message` and `ui.scroll`) as POSTs to `/input`.
  - Its README lists the caveats [V]: "mouse position will sometimes be slightly off", a macOS local-network prompt, the pane's width limit, "may break between releases", and kitty unicode placeholders required. It also says "within herdr performance is very bad".
  - It also exposes a `$.browser.open({url})` method to other mods [V]. AskBoard's mod could call it, which makes terminal-browser a plugin dependency.
- **M3. A pane showing AskBoard's own renderer.**
  - The session process (AD-2) drives the user's installed Chrome or Edge in headless mode over a DevTools-protocol pipe [I]:
    - `Page.startScreencast` for frames;
    - `Input.dispatchMouseEvent`, `dispatchKeyEvent` and `insertText` for input;
    - `Input.dispatchDragEvent` for native drag.
  - All of those protocol methods are marked experimental [V].
  - The mod is thin: it draws one pane per ask (tabs), shows frames from a file the session process writes (or as PNG bytes in iTerm2 and tmux), and forwards `Client` events to the local API.
  - Nothing is downloaded; the engine is a current Chromium, which AD-19's browser list already covers [I].
- **M4. Companion only, no board in the pane.** The mod draws the pending-asks list (FR-23) as a band or small pane: title, who asked, open questions, and buttons such as "Open board", which uses the browser.

### 2.4 Renderers the mod would rely on

- **terminal-browser** [V]:
  - Electron offscreen Chromium; MIT, 4,318 stars, created 2026-07-06, v0.15.1 released 2026-10-28.
  - **Telemetry on by default** (PostHog EU: launch, upgrade, daily-active and crash events, with no URLs in the code read). Opt out with `DO_NOT_TRACK=1` or `TERMINAL_BROWSER_NO_TELEMETRY=1`.
  - Downloads of 137–150 MB per platform.
  - Exposes an agent-driving CLI, `terminal-browser action`.
- **The user's Chrome or Edge, headless**, for M3: user software that AskBoard doesn't ship. Linux devcontainers usually have none [I].
- **Not usable as the pane's renderer:**
  - Carbonyl: last release 2023-02-18 (fails the adoption rule), and it needs a TTY, which `$.process` doesn't give [V, I].
  - Browsh: last release 2024-01-29 [V].
  - awrit: archived [V].
  - Text browsers: no JavaScript [I].
- **Fallback without a mod:** a multiplexer or terminal split running a terminal browser, or a terminal's own web pane (cmux, Wave, iTerm2). It touches no mod at all.

## 3. Feasibility

### 3.1 How AskBoard's plugin would carry it

Nothing new to install. The pane code goes in the same plugin, `packages/mod/` (spine, Structural Seed):
- the hooks module, extended with `ui.render` (`Pane`, `AbovePrompt`), `ui.message`, `ui.close`, `ui.scroll`, and `command.run` for an `/askboard` command;
- one `Client` module file;
- a `types/index.d.ts` if `$.state` is used.

CI runs `claude plugin validate` and `claude plugin test`. Organizations that allow only their own mods refuse it, as they already would refuse the delivery mod (R1). An org can install it from a directory marketplace to count it as its own [V].

### 3.2 Data, input and focus

**M3, frames:**
- The session process writes each frame to a file under its 0700 runtime folder (on Linux, `/dev/shm` is memory) and bumps a generation counter. The mod blits `{file, format, generation}`.
- In iTerm2 and tmux, frames must be bytes: base64 PNG fetched through the local API (`$.http.fetch` text, up to 4 MiB). That exceeds AD-5's "each response body stays under 1 MiB" [I].
- Node has no POSIX shared-memory API without a native addon [I].

**M3, input:**
- `Client` events are posted to the mod at most once per frame, then sent by `$.http.fetch` POST to the local API, then the session process dispatches them over the DevTools protocol.
- A round trip is likely 50–150 ms [I; U].

**Keyboard [V]:**
- No Escape: the board uses Esc to close the reading panel, menus and comment cards.
- No Alt.
- Ctrl+X chords are reserved.
- A click first, and clicks need fullscreen rendering.

The NFR-12 shortcuts' modifier is still "not recorded" (EXPERIENCE Open Items 21). It would have to be Ctrl or Shift.

### 3.3 Against AskBoard's requirements

Legend: ✓ meets, ~ partly or with conditions, ✗ fails, ? unverified.

| Requirement | M1 native | M2 terminal-browser | M3 own renderer | M4 companion |
|---|---|---|---|---|
| Full board (18 widgets) | ✗ about half | ✓ [I] | ✓ [I] | n/a (opens browser) |
| Sandboxed view, CSP, token (NFR-4, NFR-5) | n/a: no agent markup | ✓ Chromium | ✓ Chromium; token stays in the session process | ✓ |
| `127.0.0.1` only | ✓ | ✓ + its own loopback bridge | ✓; protocol pipe, no port [I] | ✓ |
| Keyboard core (NFR-12) | ~ native focus model | ~ no Esc or Alt | ~ no Esc or Alt | ✓ (browser) |
| Pointer and drag | ~ buttons only | ~ synthetic; "slightly off" [S] | ~ native drag experimental [V/U] | ✓ |
| Bring to front (FR-23) | ~ pane waits below 144 columns unless the user acts | same | same | ✓ |
| One tab per ask (FR-24) | ✓ pane per ask | ✗ one pane `browser` [V] | ✓ pane per ask (tabs) | ✓ |
| Leave guard (FR-25) | ✓ via `ui.close` | ? | ✓ via `ui.close` | ✓ browser |
| References in the signed-in browser (FR-9) | ✓ | ✗ opens its own tab [V] | ✓ if new windows go to the OS browser | ✓ |
| Editor launch (AD-8) | ✓ | ✓ | ✓ | ✓ |
| Container / SSH | ✓ | ✗ file frames blank; bytes only | ✗ no Chrome; bytes only [I] | ✓ |
| Terminals and surfaces | terminal, Desktop, VS Code | kitty-placeholder terminals [S] | kitty, Ghostty, iTerm2 fullscreen, tmux | all |
| Product owner's setup (Herdr in iTerm2) | ✓ | ✗ likely [I; herdr#3941 open] | ✗ likely [U] | ✓ |
| Width ≥ 1280 px | n/a | ✗ (≤ 45%) | ✗ | ✓ |
| New dependency | none | terminal-browser plugin + app | none (maybe playwright-core) | none |

**Better than a browser tab** [I]:
- The board sits next to the agent that asked, inside its session, so it never surfaces in another session's terminal (NFR-2).
- Closing it can be held back while work is unsent, which is stronger than the browser's prompt.
- No app or window switch.

**Worse:**
- Terminal coverage, width, input fidelity, accessibility (pixels only), resources (a Chromium renderer per board) and API churn.
- Containers and SSH are worse too: a file frame doesn't reach the outer terminal, and a renderer is rarely installed in a container [I]. That runs against the hope that a pane helps over SSH or in a devcontainer.

### 3.4 Adoption rule

| Component | Licence | Stars | Last push | Last release | Result |
|---|---|---|---|---|---|
| terminal-browser (M2) | MIT | 4,318 | 2026-10-28 | 2026-10-28 | **Pass**, with caveats: 4 months old, 0.x, telemetry on by default |
| playwright-core, optional for M3 (microsoft/playwright) | Apache-2.0 | 98,747 | 2026-10-28 | 2026-10-14 | Pass |
| ChromeDevTools/devtools-protocol (type definitions only) | BSD-3 | 1,583 | 2026-10-27 | — | Pass, if used |
| Carbonyl | BSD-3 | 19,604 | 2024-07-01 | 2023-02-18 | Fail (activity) |
| Browsh | LGPL-2.1 | 19,105 | 2025-07-11 | 2024-01-29 | Fail |
| awrit | BSD-3 | 1,378 | — | — | Fail (archived) |

The user's Chrome or Edge is user software, not shipped.

## 4. PRD review

Quotes are from `prd-askboard-2026-10-25/prd.md` (updated 2026-10-28).

**Unaffected:**
- §1 Vision ("opens in a browser on the user's own machine").
- NFR-3 and NFR-4.
- NFR-5 for M2 and M3 (a real engine). M1 sends no agent markup at all.
- NFR-11.
- AXFX §5.10 ("The web UI serves only the local machine") and AXFX §7 ("Local web UIs"): a pane on the same machine honours both.
- AD-17's benchmark: under `-p` nothing draws.

**Touched, with proposed wording:**
- **FR-21:** "The architecture pushes them through a Claude Code mod". The same mod would gain display, so R1 now covers display too.
- **FR-23:** "AskBoard brings its board to the front in the browser … Where AskBoard's push path runs (R1), the terminal notice also lists the pending asks."
  - For v1, place the pending-asks list in a band above the prompt with an "Open board" button per ask. That closes EXPERIENCE Open Items 6 and the D8 gap in `reconcile-research.md`.
  - Later wording:
    > When an ask arrives, AskBoard brings its board to the front where the user's configuration says: in the browser (the default), or in a pane beside the chat where the terminal can draw one. It also shows a system notification, and the terminal notice lists the pending asks.
- **FR-24:** "Each ask opens in its own browser tab". A pane per ask (Claude Code shows them as tabs) satisfies it in M1 and M3. M2's single pane does not: a second ask would navigate away from the first board, which is then discarded (FR-25, AD-21) [I].
- **FR-25:** "closing its tab first raises the browser's prompt". In a pane, the mod's `ui.close` hook can keep the pane open and ask for confirmation [V]. A consequence for the later version: "Closing a board's pane while it holds unsent work or open postponed questions first asks the user to confirm."
- **FR-9:** "GitHub and Atlassian references open in the user's browser, where the user is already signed in". Later wording:
  > References open in the user's default browser, also when the board is shown in a pane.
- **FR-35:** add the behavioural setting "where boards show" (`browser`, `pane`, `both`), read-only on the board.
- **NFR-8, "Claude Code CLI":** consistent. The pane is terminal-only, since `Image` is terminal-only [V]. The Desktop Browser pane stays out (§8.2).
- **NFR-9:** M2 needs AskBoard to launch terminal-browser with `DO_NOT_TRACK=1`.
- **NFR-10:**
  - M2's agent CLI (`terminal-browser action`) lets an agent press "Answer". Mitigation: a hook that refuses it [I].
  - In M3, input reaches a board through the local API's session token. A process of the same OS user could inject input, which is already out of scope (SOLUTION-DESIGN §6).
- **NFR-12, "down to a viewport about 1280 pixels wide":** **the main conflict.** At 45%, a 1280 px board needs a terminal about 2,850 px wide [I]. Typical docked widths are about 680 px on a 14" laptop and about 1,150 px on a 27" 2560 px display [I]. The keyboard core also loses Escape and Alt [V]. Later wording:
  > In a pane beside the chat the board stays usable down to about N px wide; the keyboard core uses no Escape or Alt shortcut.
- **SM-3:** the renderer's start adds to time-to-visible in real use [U]. **SM-5:** possibly better.
- **R1:** add the remote rollout switch [V] and the shared hooks worker [V]. **R2:** add "the mod drawing API moves between releases" [V]. **R3:** Plannotator now ships `plannotator-tui` and a Herdr plugin [V], so the competition is moving into the terminal.
- **New R7:** "A board in a pane depends on the terminal (kitty graphics), loses Escape and Alt, and is narrower than the board's floor."
- **§8.2:** keep "Boards in the Claude Desktop Browser pane" and "diagram previews in the terminal". Add:
  > Boards in a Claude Code mod pane beside the chat: later version. The first version's mod shows only the pending-asks list, with a button that opens each board in the browser.

  The addendum's "delivery in a TUI" stays for M1.
- **New OQ6:** "Is a board in a pane beside the chat a goal, and down to what width?"

## 5. Impact on architecture and UX; one mod for both roles

### 5.1 Can one mod do both?

Yes. A plugin has exactly one hooks module [V], and AD-19 already makes AskBoard's mod that module. Delivery and display share:
- the session-file lookup;
- the local API client and session token;
- the `$.clock.every` poller started at `session.start` (AD-5).

**The coupling risks, and how to contain them:**
- Installed mods share one worker. A display hook that blocks it gets the mod unloaded, and with it push delivery [V]. Pull keeps correctness (AD-4), but latency returns.
- A policy mod judges the whole mod by its API calls [V]. Adding `$.process.*` for a renderer could get push refused too.
- **Rule:** keep the mod thin. Only `$.http.fetch`, `$.fs.read`, `$.ui.*`, `$.session.send`, `$.prompt.submit` and `$.clock`: no `$.process`. Put the renderer in the session process (a new driven adapter in `board-host`), and make every display hook cheap.

### 5.2 Architecture decisions affected

**For the v1 band (M4):**
- **AD-4:** the mod's role grows from push to also drawing the pending-asks list. The FR-23 list is already the mod's job.
- **EXPERIENCE Notices:** set the wording and placement. No AD reopens.

**For a later pane (M3); AD-4 and AD-5 reopen, the rest are amended:**
- **AD-1:** a new driven adapter, `pane-renderer`, in the session process. The mod stays an out-of-process client using contract schemas.
- **AD-5:** "The local API answers at once, with no long-poll. Each response body stays under 1 MiB". A frame stream needs either file frames plus small state polls, or an exception for byte frames.
- **AD-7:** the local API schema set gains frame, input and pane-state messages, owned by `board-host`.
- **AD-2:** the working signal comes from the pane's `isFocused` and input.
- **AD-21:** the headless page is a live board connection. A pane and a browser tab of the same ask take over from each other. A pane close counts as a disconnect unless the mod holds it.
- **AD-8:** references from the headless page leave through `board-host` to the OS browser. The sandbox is unchanged.
- **AD-11:** protocol over a pipe, no debugging port. Board tokens never cross the local API to the mod.
- **AD-14:** the new `boardSurface` key.
- **AD-18:** "can show a board" stays tied to the browser; the pane is extra.
- **AD-22:** Chrome or Edge discovery; diagnostics.

**For M2:** AD-19 changes as well (a dependency on another plugin, under the adoption rule).

**For M1:** AD-9 reopens.

### 5.3 UX affected

- **EXPERIENCE Foundation**, "Form factor".
- **Surfaces:** the terminal link and pending-asks list (D8), now a band.
- **Notices:** "Bring to front", and the pane opening rule (144 or 110 columns, or a user click).
- **Interaction Primitives:** "Close and reload".
- **Accessibility Floor:** keyboard core and shortcuts (no Escape or Alt in a pane).
- **Responsive & Platform:** the 1280 px floor; "Other widths: Not recorded" (Open Items 23); the Claude Code surface row.
- **Board anatomy and DESIGN Layout & Spacing:** a narrow layout. "One question per view" and inline context placement are natural building blocks [I].

### 5.4 Effect on the mod-delivery spike (SOLUTION-DESIGN §10.1)

Its scope stays push delivery. Add four probes using a static or looping test frame, with no renderer. About half a day to one day [I].

| Probe | What it checks | Passes when |
|---|---|---|
| D1 | `Image` with a keyed blit (file source, and bytes for iTerm2 and tmux) | It draws in Ghostty, kitty, iTerm2 fullscreen, tmux with passthrough, and Herdr 0.9.5 in iTerm2 (the product owner's setup). The achieved frame rate is recorded |
| D2 | A `Client` over an `Image` | It receives clicks, drags, wheel (`ui.scroll`), text keys, Ctrl and Shift; Esc and Alt confirmed lost |
| D3 | One pane per ask | Panes show as tabs; an unasked open waits below 144 columns; a `ui.close` hook can hold a close |
| D4 | One module with both roles | Polling plus blitting stays within hook budgets and doesn't delay push; `claude plugin validate` shows no `$.process` call |

Existing criteria 10 (`$.http.fetch` reaches `127.0.0.1`; `Origin`) and 11 (policy refusal) cover the shared path. terminal-browser's mod already fetches from `127.0.0.1` [V], which is secondary evidence for criterion 10.

## 6. Options

**Now. Pane-hosted boards in v1 (M3):**
- **Cost:** large, about 3–5 extra weeks [I]: the renderer adapter, frame and input local API, pane UX, a narrow layout across the wide widgets (Diff, Graph, Gantt, WBS), CI on a kitty-capable terminal.
- **Risk:** high (API churn, terminal matrix, experimental protocol methods).
- **Unlocks:** the board beside the chat.
- **Delays:** the renderer spike grows. The AXFX-first widgets, which are the widest, slip. NFR-12 changes. AskBoard's AXFX arrival slips further.

**Now with M2 (depend on terminal-browser):**
- **Cost:** medium [I].
- **Risk:** high: a third-party 0.x plugin and app, telemetry, agent driving, one pane only, the product owner's setup unlikely to work.
- **Unlocks:** a quick demonstration.
- **Delays:** same as above, minus the renderer.

**Later (recommended), with the v1 band (M4) and probes D1–D4:**
- **Cost now:** about a day for the band spec (already in scope) plus about half a day to one day of probes.
- **Risk:** low.
- **Unlocks:** a decision on data: terminal coverage in practice, input fidelity, width.
- **Delays:** nothing.

**Drop:**
- **Cost:** zero.
- **Risk:** R3 unanswered.

**Interaction with the four planned spikes:**
- **Mod delivery spike:** gains D1–D4.
- **Formula spike:** none.
- **Renderer spike:** optionally record the golden case at about 900 and 700 px to size the narrow-layout question (about half a day [I]).
- **Packaging spike:** under M3, add discovery of the user's Chrome or Edge to criterion 12, and the hidden-page behaviour to criterion 13.

## 7. Proposed spike: board in a mod pane (later, after the mod-delivery and renderer spikes)

Description only; no OpenSpec change is created.

**Questions:**
1. Can the session process render a real board headless in the user's Chrome or Edge and stream frames to a mod pane? Measure the frame rate, the latency from a click to the new frame, and CPU and memory per board.
2. Do the keyboard core (without Escape or Alt), text entry, pointer drag (Gantt, Graph) and native drag and drop (Ranking, Kanban, Tree, through `Input.dispatchDragEvent`) work?
3. Does one pane per ask hold? Do pane and browser-tab takeover (AD-21), `ui.close` holding (FR-25) and references opening in the OS browser (FR-9) work?
4. At what pane width is the board usable as it stands, and what would a narrow layout need?
5. Does it work in Ghostty, kitty, iTerm2 fullscreen, tmux and Herdr, and what do containers, SSH and the Desktop app show (the alt text and the browser fallback)?
6. Does M2 (terminal-browser's `$.browser.open`) pass the same checks? Comparison only.

**Pass or fail checks:**

| Check | Passes when | Failure means |
|---|---|---|
| View isolation | The view reports `self.origin === "null"`, a view `fetch` fails, no CSP violation | Fail |
| Keyboard core | Every action completes without Escape or Alt | Fail |
| One board per ask | A second ask leaves the first board live | Fail |
| Close with unsent work | The pane close is held with a confirmation | Fail |
| References | A GitHub reference opens in the default browser | Fail |
| Isolation of push | A pane-renderer crash doesn't stop push or pull | Fail |
| Product owner's setup | It draws in the product owner's setup, or a documented switch makes it draw | Decides adoption |
| Width | Golden case and UJ-1 complete at the measured docked width | Decides the narrow layout |

**Size:** about 5–8 days for one person [I].

## 8. Open questions for the product owner

1. **Renderer:** depend on terminal-browser (M2: fast to try, third party, one pane, telemetry) or build AskBoard's own on your Chrome or Edge (M3: more work, one pane per ask, no new dependency)?
2. **Goal:** is the board beside the chat worth a narrow board layout and Escape-free shortcuts (NFR-12)?
3. **Your setup:** this session runs in Herdr 0.9.5 inside iTerm2 [O]. A pane would most likely show text only there. Would you run Claude Code directly in iTerm2 with `/tui fullscreen`, or in Ghostty or kitty, to get it?
4. **Opening:** should a pane open by itself for a new ask (only where the terminal is 144 columns or wider), or only when you click "Open" in the pending-asks band?
5. **v1 band:** draw FR-23's pending-asks list as a band with an "Open board" button per ask?
6. **Probes:** add D1–D4 to the mod-delivery spike?
7. **Organizations:** is it acceptable that `allowManagedModsOnly` turns off both push and the pane, or should the pane come from a separate, optional plugin? That would change AD-19's "one plugin".

## 9. Sources (all accessed 2026-10-28)

**AskBoard documents (read-only):**
- `askboard/CLAUDE.md`
- `docs/prd-askboard-2026-10-25/prd.md` and `addendum.md`
- `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (AD-1, AD-2, AD-4, AD-5, AD-7, AD-8, AD-9, AD-11, AD-14, AD-17 to AD-22, Structural Seed)
- `SOLUTION-DESIGN.md` (§4.1, §6, §10, §13 F8 to F12)
- `research-cc-delivery-2026-10-27.md` (§9, §10)
- `docs/ux-askboard-2026-10-27/EXPERIENCE.md`, `DESIGN.md`, `reconcile-research.md` (D7, D8), `.memlog.md` (L156, L157)
- AXFX PRD §5.10, §6, §7 (planning repository)

**Claude Code docs:**
- Mods overview: https://code.claude.com/docs/en/plugins/mods/overview
- Mods reference: https://code.claude.com/docs/en/plugins/mods/reference
- Draw in the interface: https://code.claude.com/docs/en/plugins/mods/interface
- Interface gallery: https://code.claude.com/docs/en/plugins/mods/gallery
- Manage mods for your organization: https://code.claude.com/docs/en/plugins/mods/admin
- Troubleshoot a mod: https://code.claude.com/docs/en/plugins/mods/troubleshoot

**Mod types:** the type declarations and authoring reference that Claude Code 2.1.311 writes for its build (`ImageProps`, `ImageSource`, `ImageBlitArgs`, `ClientProps`, `ClientSurface`, `ClientElements`, `ClientPointerEvent`, `ClientKeyEvent`, `PaneOpenArgs`, Pane props, `$.ui.open`, `$.ui.close`, `$.ui.blit`, `$.http.fetch`, `$.process`, `RasterProps`, `Elements`).

**terminal-browser:** https://github.com/zenbu-labs/terminal-browser. Files read: README, `claude-code-plugin/README.md`, `hooks/register.tsx`, `surface.tsx`, `bridge-protocol.ts`, `browser/src/telemetry.ts`, `browser/src/session/session.tsx`, `pixel/README.md`, `pixel/packages/pixel/src/web/host.ts`; release v0.15.1.

**DevTools protocol:** https://github.com/ChromeDevTools/devtools-protocol, `json/browser_protocol.json` (`Page.startScreencast`, `Input.dispatchDragEvent`, `Input.insertText`, `Emulation.setFocusEmulationEnabled`, all experimental).

**Other renderers:**
- https://github.com/fathyb/carbonyl
- https://github.com/browsh-org/browsh
- https://github.com/chase/awrit
- https://github.com/microsoft/playwright

**Herdr:**
- Plugins doc at v0.9.5: https://raw.githubusercontent.com/herdrdev/herdr/v0.9.5/docs/next/website/src/content/docs/plugins.mdx
- Configuration reference at v0.9.5: https://raw.githubusercontent.com/herdrdev/herdr/v0.9.5/docs/next/website/src/data/config-reference.json
- Issues: https://github.com/herdrdev/herdr/issues/3941, /3946, /4858, /5134, /5594

**Competitor:**
- https://github.com/plannotator/plannotator-tui
- https://github.com/plannotator/herdr-annotate

**Other:**
- GitHub REST API figures for the repositories in §3.4.
- Local observation: `TERM_PROGRAM=herdr`, `herdr --version` 0.9.5, iTerm2 in the process list.
