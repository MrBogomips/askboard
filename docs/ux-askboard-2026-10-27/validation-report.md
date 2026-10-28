# Validation Report — AskBoard

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-askboard-2026-10-27/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-askboard-2026-10-27/EXPERIENCE.md`
- **Run at:** 2026-10-28T11:02:01+01:00

## Overall verdict

Mechanically the pair is clean. All 247 token references resolve. All 112 colour keys are 6-digit hex in light and `-dark` pairs, and the 23 stated contrast ratios recompute exactly. All 57 components appear in both spines, and every L, PCR, ACR, S and AD citation resolves. The four journeys carry steps, climaxes and edge paths. As a contract it is not yet complete. The spines refer to "the question's answer act" but never define it, so a Form, atom or widget question has no way to send its answer in immediate delivery, the default mode (critical). Several load-bearing surfaces and states on the journeys and the golden case are also still open: the reading panel, the Approval visual, held, pending and postponed questions, Diagram source errors and the dark diagram theme. The language toggle's persistence also contradicts the language precedence. Close the critical and high findings before rendering the key-screen mocks. Otherwise the mocks will have to invent those answers.

The adversarial and edge-case reviews confirm the answer act as the one critical gap (all three reviewers raise it) and shift the picture in two ways. First, the spines ask for behaviour the architecture forbids or does not provide, with no change request behind it: "Accept all recommended" against AD-10, translating answered questions against AD-20, board-written behavioural settings beyond ACR-02, git-resolved Diff alternatives outside AD-12, a board-page/view split never stated, and pending change requests cited as if granted. Second, walking the journeys step by step reaches lifecycle, locale and scale gaps the per-surface walk does not: UJ-2 fails if Sara closes the tab after submitting, Submit under an unresolved agent-change notice, unsent work when the ask closes, arrow keys that select options under Radix, number input that can multiply a money value by 1,000, and 2,000-line diffs and 30-option questions. The three reviews raise 130 findings, which merge into 105: 2 critical, 25 high, 43 medium and 35 low. Only 5 need a product decision; the rest apply a recorded decision or the architecture, or can stay open (see Triage).

## Category verdicts

- Flow coverage — adequate (5 merged findings)
- Token completeness — adequate (8 merged findings)
- Component coverage — thin (12 merged findings)
- State coverage — thin (8 merged findings)
- Visual reference coverage — pending (not graded) (0 merged findings)
- Bloat & overspecification — adequate (6 merged findings)
- Inheritance discipline — adequate (6 merged findings)
- Shape fit — strong (2 merged findings)

Visual reference coverage is not graded: the key-screen mocks come after this gate. Surfaces that will need a visual reference, in priority order:

1. Golden single-question board, light and dark: the slim board, the split question with the Diagram, the annotation overlay, a pin with its comment card, the excerpt, the references and the bottom bar. It needs the dark diagram theme (F-06).
2. UJ-1 multi-question board: the two-row context header, the outline rail, the split question with Diff review ("Fix A | Fix B | A vs B", per-line ✓ ✕, status chips), the Graph question at full width, the follow-up thread, and the bottom bar in immediate delivery with delivery receipts.
3. The reading panel over the board: a load-bearing overlay whose placement is undecided (F-03).
4. UJ-3 sales estimate review with Approval: a switched-off optional line, the margin warning chip, the change highlight, the decision buttons and the change summary.
5. UJ-2 WBS with PERT and the Gantt plan: the baseline, the critical path, a changed estimate and a postponed question in submitted delivery.
6. One question per view and areas as tabs: the question navigator and the tab unanswered counts.
7. Alternate board states, as a second section of an existing mock: the closed, discarded, connection-lost and moved banners, the agent-change notice, "Removed by the agent", and the translation pending state.
8. Spine-only candidates, to confirm with the user: the settings panel, the mode-switch confirmation, the invalid-link page and the offline Snapshot view.

## Reviewer verdicts

### Adversarial review (`review-adversarial.md`)

Assumed reader: a developer or an agent who builds the renderer spike and the stories from these spines and reads them literally. Raw counts: 1 critical, 6 high, 10 medium, 3 low.

**Verdict.** The spines are well sourced and honest about their gaps, and their token system, fail-closed details and CSP-aware component choices are sound. But the answer pipeline cannot be built as written: the spines never define the act that turns work on a question into an answer, so immediate delivery, the default, has no defined send moment, and in the golden single-question case the only primary action is disabled. Six high findings should also be closed before the renderer spike and the stories start: four behaviours the architecture forbids or does not provide and no change request covers (bulk accept, translating answered questions, settings written by the board, git-resolved diff alternatives), a board-page/view split the spines never state, and pending change requests that read as settled.

Categories checked: contradictions (C-1, H-2, M-2, M-4, M-7, M-8, M-9); rules the architecture lacks, with no ACR (H-1, H-3, H-4, H-5, M-1, M-2, M-6); vague decisions (C-1, M-3, M-4, M-5, M-6); principles undermined: lower felt complexity (C-1, M-1, M-10), agent cost (C-1, H-2, M-1), NFR-10 (H-1, H-2), and on "sober and technical, minimal motion" nothing found; weak decisions (H-1, M-8, M-10); change requests presented as granted (H-6, with the missing ACR in M-1).

What is solid. Do not reopen these:

- Tokens: the layered colour and font tokens, the swap rule and the aliases; all 23 contrast pairs pass in both modes, and every state pill and chip carries a marker shape.
- Colour separation: the agent's voice and the user's voice have separate hues, waiting is neutral, and warning is used only for thresholds (apart from M-8).
- Fonts: bundled and inlined as `data:` URLs, matching AD-8's `font-src data:`; code views turn ligatures off.
- Fail-closed details: nothing is preselected and Recommended is only a badge; an untouched Toggle or Ranking returns nothing, and Ranking needs "Keep this order"; review widgets report untouched values as unchanged.
- Agent-cost rules: AskBoard-only fields are optional with derived defaults; AskBoard computes layouts, baselines, highlights and derived values; file excerpts are never translated; "Explain" is a ready-made follow-up rather than a rationale field.
- Where the UX yielded to the architecture: drafts never leave the board, no Snapshot after a discard, bring-to-front scoped to one session, the reconnection wording corrected.
- CSP-aware component choices: RJSF with a no-op validator and `tagName="div"`; the `.dark` class instead of next-themes; diagrams as `blob:` images under an overlay keyed to element IDs; Pragmatic drag and drop with keyboard move actions; class-based syntax highlighting; library risks handed to the spike as S-1 to S-7.
- Layout without agent geometry, widget scope with the minimum as the ceiling (R4), delivery semantics that follow AD-20, and honest Open Items.

Merged into findings homed elsewhere:

- C-1 → F-01 (Component coverage)
- M-1 → F-28 (Flow coverage)
- M-2 → F-05 and F-33 (Component coverage)
- M-4 → F-37 (Component coverage) and F-08 (State coverage)
- M-9 → F-46 (Inheritance discipline)
- L-2 → F-04 (required-reason label, Component coverage) and F-53 (display names, below)
- H-5's Snapshot-theme point also feeds F-69 (Edge-case review)

### Edge-case review (`review-edge-cases.md`)

Walks the journeys, the ask lifecycle, scale extremes, concurrency, locale, settings, keyboard use and Snapshots step by step, after reading both spines' Open Items; nothing listed there is repeated. Severity: critical means an answer the user never gave can reach the agent, or the core flow cannot be built from the spines; high means likely user harm (lost work, wrong values, a broken journey step) or two teams very likely to build it differently; medium a real gap with contained harm; low polish or an unlikely configuration. Raw counts: 2 critical, 18 high, 27 medium, 15 low (62).

**Verdict.** The review marked 17 findings as needing a product decision. After merging and triage, four merged findings stay in group A (F-01 from EC-01 and EC-03, F-11 from EC-35, F-12 from EC-38, F-21 from EC-15). The other twelve (EC-05, EC-08, EC-10, EC-20, EC-26, EC-27, EC-28, EC-32, EC-34, EC-39, EC-46, EC-50) resolve by applying a recorded decision or the architecture, and their B line names which.

Edge cases the spines already handle well:

- Reload versus close: a reload restores the board and its draft from AskBoard and never discards (AD-20, AD-21); a board never opened keeps the ask waiting with no grace timer.
- Recommendation versus answer: badge only, nothing preselected, acceptance always an explicit click; an untouched Ranking is no answer until a move or "Keep this order".
- Follow-up replies never bump the revision or raise a notice; a `translation` update changes only texts and raises no Reload/Keep; file excerpts stay in their source language (L149).
- Unresolved excerpts or paths outside the root show as unresolved and never block the board; formula errors are shown and the ask is not refused (AD-13).
- Closed and discarded boards are both readable and locked, a Snapshot only from a closed one; a second tab takes over and the old one shows the board moved.
- Postpone undo in both delivery modes; switching submitted to immediate with held work confirms and sends in the order produced.
- Diagram pins keyed to element IDs or labels re-attach, and detached pins are listed, never dropped; optional scope lines are switched off, never deleted.
- Snapshot safety (no token, no draft, fixed folder, never overwritten, a folder outside the project replaced with a warning); Enter never submits a Form; devcontainers and blocked notices fall back to the terminal link; remote hosts report unavailable; concurrent asks across worktrees stay separate; references open only on explicit clicks, http and https only.

Merged into findings homed elsewhere:

- EC-01, EC-03 → F-01 (Component coverage)
- EC-05 → F-37 (Component coverage)
- EC-07 → F-08 (State coverage)
- EC-17, EC-39 → F-33, F-05 (Component coverage)
- EC-26 → F-09 (Flow coverage)
- EC-29, EC-31, EC-46, EC-53 → F-07, F-41, F-40, F-80 (State coverage)
- EC-36 → F-28 (Flow coverage)
- EC-06, EC-35, EC-38 → F-10, F-11, F-12 (Adversarial review)
- EC-14 → F-49 and F-53; EC-24 → F-47; EC-52 → F-50 (Adversarial review)

## Findings by severity

Source IDs: "rubric §n.k" is the k-th finding under section n of `review-rubric.md`, in file order; C-, H-, M- and L-n are the adversarial review's; EC-nn are the edge-case review's. A part note such as "(count point)" marks a source split across two merged findings.

### Critical (2)

**[Component coverage]** — F-01 The answer act is never defined, so immediate delivery has no send moment (§ EXPERIENCE.md:150, :199, :225, :291, :701; DESIGN.md:601)

Both spines rely on "the question's answer act" but never define it, and Open Items does not list it. Submit is disabled in immediate delivery, the default (FR-22), so a question answered through atoms, a Form, a Table, a Tree, a Gantt or a Graph without options has no way to create its answer event. A literal build goes one of two ways, and both are wrong: either the first option click sends the answer, so in the golden case "Needs changes" reaches the agent before any annotation or note exists, the agent wakes and acts on half an answer, and every later pin wakes it again (NFR-1, SM-1); or nothing is sent until Submit, which is disabled. The golden case names Submit as "the only primary action", yet it is disabled on a default board. The revision rules disagree too (:299 allows revising any delivered answer, :376 only in immediate delivery), and the architecture does not define the act either (AD-10, AD-20).

Fix: Define the act per question shape, then derive the rest from it. The three reviewers converge on one explicit per-question action ("Answer"; held until Submit in submitted delivery) that sends the option, the widget's full value, the "Other…" text, option notes and the note together, re-armed as "Send revision" after later edits; Approval's decision buttons only select; the single-question board shows one primary action. The alternative left open is that a click on a plain single-choice option answers at once, as AskUserQuestion does, with the explicit action only for composite questions. Record the rule in Component Patterns (Question card, Widget frame, Form), Interaction Primitives and the keyboard core, and state whether an answer sent with Submit can still be revised.

Sources: rubric §3.1 · rubric §1.2 (Submit contradiction) · C-1 · EC-01 · EC-03 — Triage A

**[Edge-case review]** — F-02 Arrow keys on the options select them, under the inherited Radix behaviour (§ EXPERIENCE.md:23, :491, :531)

"Anything it does not state behaves as the Radix primitive does", and Radix Radio Group moves focus and checks the item on every arrow key. The spines state no delta. If a single-choice click is an answer act (F-01), every option a keyboard user arrows past, the recommended one included, reaches the agent as an answer the user never gave. That breaks AD-10 and NFR-10 for exactly the users the keyboard core exists for.

Fix: State a delta in the Option and Accessibility Floor rows: options use manual activation (arrow keys move focus only; Space or Enter selects), whatever F-01 decides.

Sources: EC-02 — Triage B

### High (25)

**[Component coverage]** — F-03 The reading panel's placement, opening and focus are undecided (§ EXPERIENCE.md:43, :179, :700, :785; DESIGN.md:630)

Side sheet, overlay or replacing the context column is open, and so are opening, closing, focus and whether it is modal (S-6). The golden case exercises it and SM-5 depends on it. The board-page/view split (F-14) also constrains it: the view's CSP sets frame-src 'none', so the panel cannot live inside the view.

Fix: Decide its placement, how it opens and closes (Esc, a close control), where focus goes and returns, and whether it is modal, then specify it in both spines.

Sources: rubric §3.2 — Triage B

**[Component coverage]** — F-04 Approval, the climax component of UJ-3, has no visual spec (§ DESIGN.md:676, :704; EXPERIENCE.md:165, :227; Open Items 4)

"Not mocked": the variant, labels and order of the three decision buttons, the required-reason cue for "Approve with changes" and the change summary's layout are all unstated, while the Do's say Submit is the bar's only primary. The note field still reads "Note for the agent (optional)" when "Approve with changes" makes it required.

Fix: Specify the button variants, labels and order, the required-reason cue and the summary's anatomy. When a decision makes the note required, change its label to "Reason for the changes (required)".

Sources: rubric §3.3 · L-2 (required-label point) — Triage B

**[Component coverage]** — F-05 The language toggle's persistence contradicts the language precedence (§ EXPERIENCE.md:143, :387, :389, :411, :664; AD-14)

Quick toggles and UJ-4 step 3 save the choice as the user setting "so later boards open that way", but the precedence ranks the agent's declared language and the project setting above the user setting (AD-14: project keys win), so later boards often do not open that way. Nothing stores the toggle per board either: the draft record's contents are a closed list (AD-20) and browser storage is banned, so after F5 or a takeover a board whose agent declared a language comes back in the agent's language, against L57. With several boards open, nothing says whether open boards follow; if language propagated live, another agent would be asked to translate a board the user never touched.

Fix: Decide which wins on a new board, then align Quick toggles, Localization, Preferences and UJ-4; hold the board's choice per ask; state what other open boards do.

Sources: rubric §3.4 · M-2 (language point) · EC-39 — Triage B

**[Token completeness]** — F-06 The dark diagram theme is open while the diagram tokens already carry dark values (§ DESIGN.md:367-373, :672, :743; EXPERIENCE.md:596)

The `diagram` component tokens point at layer-3 colours that have `-dark` values, so a consumer cannot tell whether those are the dark diagram theme or a placeholder. The golden case renders in dark whenever the system is dark.

Fix: State that the `diagram` tokens resolved in dark are the dark diagram theme, and map them to Mermaid `themeVariables` and PlantUML skinparams; or declare `diagram-*` colour tokens with light/dark pairs.

Sources: rubric §2.1 — Triage B

**[State coverage]** — F-07 A diagram source that fails to render has no state (§ EXPERIENCE.md:213, :223, :274, :567)

Neither a user correction in "Source" that does not parse nor an agent source that does not render is covered, in the spines or the architecture, and the golden case makes source correction its core act. A failed re-render can mark every pin detached and blank the Diagram tab; a failed first render never becomes "ready", which stalls the measured time to visible (SM-3, SM-C2).

Fix: Keep the last good render with its pins attached, show the renderer's message and line under Source, and do not count the failure as a re-render. A failed first render opens Source with the error and counts as ready. The answer carries the source as written.

Sources: rubric §4.1 · EC-29 — Triage B

**[State coverage]** — F-08 Held, postponed, declined and follow-up-pending questions have no treatment and no counting rule (§ EXPERIENCE.md:99, :142, :147, :257-259, :265, :381, :440; DESIGN.md:486-492, :597)

A held answer in submitted delivery (UJ-2 step 3), a sent follow-up awaiting its reply (UJ-1 step 4), and postponed and declined questions have no look, and the marker set has no shapes for postponed or declined questions in the outline and the question navigator. The counters disagree: while answers are held, ask-core does not know them, so the pill says "Waiting" while the outline shows them answered; "Next unanswered" reaches postponed questions while "N unanswered" leaves them out; the header, tab labels, notification and pending-asks list will count held, agent-recorded, added and deleted questions differently.

Fix: Decide each treatment and its marker shape, and write one counting table that every counter follows.

Sources: rubric §4.2 · rubric §4.5 (visual and count points) · EC-07 · M-4 (count point) — Triage B

**[Flow coverage]** — F-09 UJ-2's climax: splitting a work package, and the Gantt it drives, are unspecified (§ EXPERIENCE.md:464, :630; AD-7)

Step 2, "Sara splits a package", does not say whether a split adds a sibling, moves children or re-enters estimates. The Gantt is linked to the WBS by item IDs ([ASSUMPTION]), but who creates the new node's ID, whether the new package gets a Gantt task (with what duration and dependencies), and what deleting a package with Gantt dependents does are not stated, and user-made IDs may collide with IDs the agent adds later. "The Gantt dates and critical path move as Sara edits" therefore depends on behaviour each team will invent.

Fix: Add the Tree actions the split uses, define how added and deleted packages carry into the Gantt, and fix the form of IDs the view generates.

Sources: rubric §1.4 · EC-26 — Triage B

**[Adversarial review]** — F-10 "Accept all recommended" breaks AD-10, and no change request covers it (§ EXPERIENCE.md:68, :148, :163; DESIGN.md:599, :614; PCR-13; AD-10)

AD-10 allows an answer event only from "an explicit user action on its question on the board". One click in the bottom bar answers every question that has a recommendation, including questions in hidden tabs, on other pages of the pager, or below the fold, which the user may never have read. The result is a recommended value returned as an answer the user never considered: it breaks the letter of AD-10 and the spirit of NFR-10, and no ACR asks to change AD-10. At scale, one click on question 2 of a 50-question board sends 37 answers, 35 of them to questions never seen, and wakes the agent; a misclick costs 37 revisions to undo. Its effect on a question already answered differently is still open (Open Item 9).

Fix: Either drop it from v1 and keep the per-question "Accept recommended" (cheapest, no ACR), or make it a confirmed bulk selection: a list of every unanswered question with the option it would select; confirming selects them but never touches a question that already has a value and skips postponed and declined ones; add an ACR amending AD-10 to admit a confirmed bulk selection.

Sources: H-1 · EC-06 — Triage A

**[Adversarial review]** — F-11 Translating answered questions reopens the hole AD-20 closes (§ EXPERIENCE.md:187, :392, :667; ACR-01; AD-20)

AD-20 exists to prevent "a verdict changed silently after a gate recorded it". ACR-01 adds a `translation` update that can change every text of an answered question without reopening it, without invalidating the answer and without a notice, and nothing checks that a translation really is one. The agent could reword the Approval Marco approved, and the Snapshot the offer is built from would show his verdict next to text he never saw. Rewriting questions that need no further decision also costs the agent tokens. Inside editable widgets, nothing says whether WBS package names, Graph labels or Kanban titles the user renamed count as "texts": one build overwrites Sara's renames, another leaves the board half translated.

Fix: Either a translation targets only questions with no answer in the log, and answered questions keep their language with a label ("Answered in English"); or ACR-01 allows a translation of answered questions only while a switch is pending and only into that language, never changing IDs, option count or order, values or widget data, and keeps the answered revision's texts as the record that the log, fetch and Snapshots show. Either way, inside editable widgets translate only elements the user has not edited, and compare the change highlight against the translated original.

Sources: H-2 · EC-35 — Triage A

**[Adversarial review]** — F-12 The settings panel writes settings that no AD or ACR lets the board write (§ EXPERIENCE.md:44, :87, :278, :400-411; DESIGN.md:595; ACR-02, ACR-04; AD-14; L79)

AD-14 gives the board no write path at all. ACR-02 asks for one "for presentation preferences only" and keeps the project scope read-only. Yet the panel, with user and project scopes, also saves the asking rules, the Snapshot folder and the editor, so a developer would build a write path that no AD or ACR grants. The editor key is the worst case: it holds the command AskBoard runs for "Open in editor" (ACR-04), so a board page that can write it turns any flaw in that page into command execution at the next session. L79, on the other hand, records that the editor is chosen in the settings panel. Nothing says what "Open in editor" does when no editor is set.

Fix: Either the panel writes only the four presentation keys, at user scope, and shows asking rules, the Snapshot folder, the editor and every project-scope value read-only with the file and key to edit; or amend ACR-02 to cover the user scope of the behavioural keys (next-session semantics), deciding explicitly whether `editor` is included. In both cases hide "Open in editor" while `editor` is unset.

Sources: H-3 · EC-38 — Triage A

**[Adversarial review]** — F-13 Diff review alternatives given as branches or commits need git access the architecture does not provide (§ EXPERIENCE.md:221, :452, :537, :609; ACR-07; AD-12, AD-8)

UJ-1's first question has three gaps. No base: "Fix A" is a diff against what, the HEAD of the ask's root, the merge-base, or the branch the worktree came from? No access path: resolving a branch or commit means running git or bundling a git library, and the architecture names only the notifier, the browser opener and (with ACR-04) the editor as OS commands. Confinement: UJ-1 runs in a worktree, whose object store lives in the main repository's `.git`, outside the ask's root, which AD-12 resolves as unresolved. ACR-07's "resolves at send time under AD-12" cannot work for a worktree.

Fix: For v1, take the alternatives as two patch files under the root, which the agent writes with a redirect (no output tokens), naming the base in the item; AskBoard parses them; amend ACR-07. If branches or commits stay, ACR-07 must name the base, a read-only git CLI started with an argument vector, and an AD-12 exception for the repository's common directory.

Sources: H-4 — Triage B

**[Adversarial review]** — F-14 The spines never say what runs on the board page and what runs in the sandboxed view (§ EXPERIENCE.md:25-29, :53-68, :470-597; AD-8, AD-9)

AD-8 and AD-9 make the split load-bearing, but the spines leave it to the reader, and each literal build fails. A reading panel built inside the view cannot frame the source view (frame-src 'none'). A leave-page prompt raised from the view cannot fire (no allow-modals). The context header must live in the view, because the view alone assembles Snapshots and a Snapshot includes the header (L83), so its toggles and Settings must message the board page. A theme "sent from the board page" leaves Snapshots, which have no board page, always light. Settings writes and "Open in editor" must cross to the board page, since the view makes no requests.

Fix: Add a "Board page or view" table to Composition and Components: for each surface (header, outline, cards, bottom bar, settings panel, reading panel, banners, mode-switch confirmation, leave-page prompt, invalid-link page), where it renders and which message crosses the boundary. State that the view follows `prefers-color-scheme` when it has no parent host.

Sources: H-5 — Triage B

**[Adversarial review]** — F-15 Behaviour that depends on pending change requests reads as settled, with no fallback (§ EXPERIENCE.md:18; DESIGN.md:386; every row citing ACR-01 to ACR-10 or a PCR)

An ACR citation looks the same as an AD citation, but both change-request files are drafts the askboard repository may accept or refuse, and the renderer spike is to run on the final UX docs (L128), possibly before that pass. The reading panel (ACR-03), live preferences (ACR-02), translation of answered questions (ACR-01), postpone undo in immediate delivery (ACR-05), the ask title and agent name (ACR-06), the declared language, minimum margin and Diff alternatives (ACR-07), Decline (ACR-08, PCR-29), the delivery receipt (ACR-09, PCR-30), dagre (ACR-10) and "Accept recommended" (PCR-13) all give the builder no fallback if refused.

Fix: Add a "Depends on pending change requests" table to EXPERIENCE, with a pointer from DESIGN: behaviour, request, status (requested), fallback if refused (ACR-03 refused: project-file references open the source view in a new tab; ACR-02: toggles apply from the next session; ACR-05: postpone undo only in submitted delivery; ACR-08: no Decline; ACR-09: no receipt; ACR-01: only open questions are translated). Mark inline citations "(pending)".

Sources: H-6 — Triage B

**[Edge-case review]** — F-16 Submit while an agent-change notice is unresolved (§ EXPERIENCE.md:150, :187; AD-20)

Sara holds answers on 12 questions; the agent updates question 7, which holds one; the notice is off-screen and she clicks Submit, or switches to immediate delivery and confirms. AD-20 refuses an answer whose rev is not current unless an ignore edit choice exists. Depending on the build, the whole atomic append is refused with no explanation, or 11 answers go and question 7 silently stays held, or the board picks "Keep mine" implicitly, which is not an explicit act.

Fix: Block Submit and the mode-switch flush while any notice sits on a held item; the bottom bar says how many updates need a choice and jumps to the first.

Sources: EC-04 — Triage B

**[Edge-case review]** — F-17 The ask closes or is discarded while the user has unsent work (§ EXPERIENCE.md:188, :250; AD-10, AD-15, AD-20)

Marco is typing the reason for "Approve with changes" when the subagent that owns the ask finishes; the SubagentStop guard lets it through, since drafts are never events, and the ask closes with agent-finished. Or Luca exits Claude Code mid-note. Nothing says what happens to the draft on screen: it vanishes or freezes in locked fields, with no way to send or keep it and no sign that it never reached the agent; a Submit in flight is refused with no explanation.

Fix: The banner says "Your unsent work was not sent", the draft stays visible and selectable in the locked board, and "Copy my unsent work" puts it on the clipboard as text. Letting the guard learn that work is in progress (presence only, never content) would need a new ACR.

Sources: EC-08 — Triage B

**[Edge-case review]** — F-18 What a reopened question shows is undefined (§ EXPERIENCE.md:375, :496; AD-10, AD-20)

Sara submitted the WBS question after an hour of edits; the agent reopens it to add a work package (a new revision with no answer). One build shows the new revision empty, so Sara redoes the hour; another pre-fills her previous answer, which breaks "nothing starts with a value".

Fix: Show "Reopened by the agent", start from the agent's new revision, show the previous answer read-only for reference, and offer "Start from my previous answer" as an explicit act that moves it into the draft.

Sources: EC-09 — Triage B

**[Edge-case review]** — F-19 "Reload, losing my work" or "Keep mine" is a blind choice on large widgets (§ EXPERIENCE.md:187; SOLUTION-DESIGN §5.3)

Sara has 14 unsent edits on the WBS and 3 on the Gantt, both in one question; the agent changes one task's duration. The rev is per question, so Reload drops all 17 edits for one changed duration, and Keep discards the agent's fix without her knowing what it was. The notice does not say what will be lost.

Fix: Without a merge, the notice says what is at stake ("Your 17 changes on this question") and offers "Show the agent's change", a read-only view of the new revision with its differences marked, before the choice.

Sources: EC-10 — Triage B

**[Edge-case review]** — F-20 A follow-up reply that arrives off-screen is never announced (§ EXPERIENCE.md:170; Open Items 17, 21)

On a 50-question board Luca clicks "Explain" on question 3 and moves on to question 31; the reply lands in question 3's thread, or, in one question per view, on a question not shown. A reply raises no notice and no flag, so he waits for a reply that has arrived, or never sees it. Follow-ups and "Explain" are how the board serves SM-5.

Fix: An unread-reply marker on the question's outline entry and navigator marker, plus a header count ("1 new reply") that jumps to it, cleared once the reply has been in view.

Sources: EC-11 — Triage B

**[Edge-case review]** — F-21 UJ-2 breaks if Sara closes the tab after submitting (§ EXPERIENCE.md:247; UJ-2 steps 3-5; AD-21; FR-6)

After UJ-2 step 3 Sara has submitted, with the integration question postponed, and closes the tab: there is no unsent work, so no leave-page prompt. Past the grace period the ask is discarded (AD-21), the agent can no longer mark the postponed question answered (FR-6 needs an open ask), and the Snapshot request answers "discarded". Steps 4 and 5 fail, and nothing on the board tells Sara that the ask lives only while its tab is open. A browser that discards background tabs to save memory has the same effect.

Fix: Options: arm the leave-page prompt whenever the ask is open with postponed questions; show a persistent "Keep this tab open until the agent closes the ask" hint once it is answered with postponed questions; have the shipped skills take the Snapshot right after a Submit with postponed questions; or request an ACR letting such an ask outlive its tab.

Sources: EC-15 — Triage A

**[Edge-case review]** — F-22 A 2,000-line diff with per-line decisions (§ EXPERIENCE.md:221; DESIGN.md Diff review; AD-10)

4,000 always-visible ✓ and ✕ controls, a page slow to become visible (SM-3), and an answer where 1,996 lines are undecided. Neither hunks nor virtualisation are mentioned. If undecided reads as "unchanged", the agent may take it as accepted, which fails open.

Fix: The answer lists undecided changes explicitly, never as accepted; unchanged context collapses; files collapse; the diff is virtualised. Per-hunk decisions with per-line override are an option to weigh.

Sources: EC-20 — Triage B

**[Edge-case review]** — F-23 A question with 30 options turns into a dropdown (§ EXPERIENCE.md:157, :491; FR-1)

Choice renders "radios, checkboxes, or a dropdown for long lists", with no threshold, while FR-1 and :157 require that a question shows every option. A dropdown hides descriptions, annotations, the Recommended badge, "+ Add your note", previews and "Other…". Teams will pick different thresholds and different surviving chrome.

Fix: Question options never collapse to a dropdown. Above a stated count (for example 12) the list gains a filter field and keeps every row. The dropdown remains only for Form pick fields.

Sources: EC-21 — Triage B

**[Edge-case review]** — F-24 Dragging a Gantt task against its dependencies or the calendar (§ EXPERIENCE.md:235; AD-7, AD-13)

Sara drags a task to start two days before its predecessor ends, onto a weekend, or shrinks it below one day. Teams will snap to the earliest allowed start, allow it with a violation mark, or push the predecessor back, and each gives Sara a different plan from the same gesture.

Fix: A drag snaps to working days and cannot start before the earliest start its dependencies allow; the constraint shows during the drag; durations never go below one working day. To move past a dependency the user edits it explicitly.

Sources: EC-27 — Triage B

**[Edge-case review]** — F-25 Diff review's "A vs B": what the decisions mean (§ EXPERIENCE.md:221, :609)

UJ-1 asks "which of two fixes to keep, as a Diff review". Luca accepts lines in Fix A, rejects some in Fix B, then clicks ✓ in "A vs B". Whether line decisions are kept per source, what ✓ and ✕ mean in "A vs B", and how the choice of fix is expressed (an option, or the widget) are not stated. The climax of UJ-1 has no defined answer shape, and the agent may receive accepted lines from both fixes and no choice between them.

Fix: The choice of fix is a single-choice option on the question; line decisions and comments are kept per fix; "A vs B" is read-only for decisions and takes comments only.

Sources: EC-28 — Triage B

**[Edge-case review]** — F-26 Number and money input: the decimal comma and the browser's own number input (§ EXPERIENCE.md:394)

"Input atoms accept the board's locale", but parsing rules, grouping separators and ambiguous input are not stated, and a native `<input type="number">` follows the browser's locale, not the board's. "12,5" can become 125 on an English board and "1,234.56" can become 1.23456 on an Italian one: a silent error of 10 or 1,000 times on money.

Fix: Number and money atoms are text inputs with AskBoard's own parser for the board's locale; input that is ambiguous in that locale is refused with a message; the parsed value is echoed beside the field ("= 12.5"); never `type="number"`.

Sources: EC-33 — Triage B

**[Edge-case review]** — F-27 Switching language while a money or date field is half typed (§ EXPERIENCE.md:389; ACR-07)

Marco has typed "1.234" in a MoneyField on an Italian board and switches to English before leaving the field; elsewhere a DateField holds "03/04/2026". If raw text is kept and reparsed, 1,234 becomes 1.234 and 3 April becomes 4 March, silently; if only parsed values are kept, the half-typed input is lost. Which English locale applies (US or UK dates) is not stated, and a locale the agent declared is replaced by the toggle.

Fix: Before a switch, parse the field being edited in the old locale; drafts hold contract values; input that does not parse stays as flagged raw text, never reinterpreted. Record the English locale once.

Sources: EC-34 — Triage B

### Medium (43)

**[Flow coverage]** — F-28 Language switch (UJ-4): no event in the architecture, a waiting label that can stay forever, and unhandled round trips (§ EXPERIENCE.md:143, :252, :297, :390-395, :665-670; Open Items 23; ACR-01; AD-3, AD-20)

No ACR covers the language-switch event from the board to the agent: AD-3's events and AD-20's "always go at once" list both lack it, and ACR-01 covers only the agent's translation update, so UJ-4 cannot be built from the architecture plus the ACRs. UJ-4 has no failure path: "Waiting for the agent's revision…" shows on each item not yet resent, including excerpts and widget data the agent never translates (L149), and under R1 it can sit there until the board closes. Every switch wakes the agent and asks for a resend, even when the user only wanted Italian number formats; a quick EN → IT → EN round trip can land Italian texts on an English board, and going back to the original waits for another resend.

Fix: Add ACR-11, an ask-level `language-changed` event sent at once in both delivery modes and coalesced. Replace the per-item label with one board-level "Translation requested from the agent" notice, shown only when there is text to translate and dismissible, replaced by "The agent did not translate this board" once the event was received and the agent moved on without translating. A translation names its language and applies only if it matches; the board keeps each language's texts, so going back is local; rapid toggles are debounced.

Sources: rubric §1.1 · M-1 · EC-36 — Triage B

**[Flow coverage]** — F-29 The golden single-question case is a checklist, not a flow (§ EXPERIENCE.md:672-703; L116, L118)

It is the scenario the visual design is judged on, but it lists what it exercises, with no steps, climax or failure path, and it does not name the delivery mode. Its "Submit as the only primary action" contradiction is merged into F-01.

Fix: Write it as a short flow: read the excerpt, open a reference in the reading panel, annotate "create order", correct the source, choose "Needs changes", answer. Name the delivery mode and add the failure beat where the corrected source does not render (F-07).

Sources: rubric §1.2 — Triage B

**[Token completeness]** — F-30 The comfortable density has no tokens (§ DESIGN.md:546, :551, :729; EXPERIENCE.md:404)

No type sizes, row heights or spacing exist for comfortable, yet the Compact | Comfortable switch is a v1 header control on every board.

Fix: Add a comfortable ramp (typography and spacing deltas), or take the switch out of v1.

Sources: rubric §2.2 — Triage B

**[Token completeness]** — F-31 There are no elevation tokens (§ DESIGN.md:563-573, :733)

Three shadows are described (the header hairline, the bottom-bar shadow and the comment card) and overlays sit on `popover`, but there are no values and the tint is undecided.

Fix: Add `shadow-*` tokens with light and dark values, tinted on the warm neutral.

Sources: rubric §2.3 — Triage B

**[Token completeness]** — F-32 The syntax-highlighting palette is undeclared (§ DESIGN.md:670, :741; EXPERIENCE.md:537)

Diff review is UJ-1's climax widget and the approved stack highlights by class, but no `syntax-*` colours exist, nor their contrast on `diff-add` and `diff-del`.

Fix: Declare `syntax-*` class tokens with light/dark pairs and contrast on `diff-add` and `diff-del`, or commit to "off in v1".

Sources: rubric §2.4 — Triage B

**[Component coverage]** — F-33 Which view state survives a reload is unstated, and context-placement persistence is ambiguous (§ EXPERIENCE.md:67, :176, :246, :405, :411, :522; AD-20)

Preferences says switching placement on a board saves it as the user setting, while IA and Component Patterns say the per-question control overrides only that question and the default lives in the settings panel. "The same board comes back in its state" (L57), but AD-20's draft record does not list composer text, the user's option notes, per-question placement overrides, the board's language choice, or the active tab or pager position: after F5 the composer text is lost, the Inline override reverts and the board reopens on tab 1. Two teams will persist different subsets.

Fix: Say that only the settings-panel default writes the user setting, and list in State Patterns what survives a reload and what resets.

Sources: rubric §3.5 · M-2 (view-state point) · EC-17 — Triage B

**[Component coverage]** — F-34 The board banner and the agent-change notice have words but no visual (§ DESIGN.md:638-639)

Every ended board shows a banner (closed, discarded, connection lost, moved) and FR-6 makes the notice testable, but neither has an anatomy.

Fix: Give their surface, marker, tokens and action buttons.

Sources: rubric §3.6 — Triage B

**[Component coverage]** — F-35 The annotation comment card has no behavioural rules (§ DESIGN.md:664; EXPERIENCE.md:213)

Edit, delete, close and keyboard behaviour are unstated and it has no row of its own, though the golden case annotates "create order".

Fix: Add a Comment card row to both spines covering create, edit, delete, dismiss and focus return to the pin.

Sources: rubric §3.7 — Triage B

**[Component coverage]** — F-36 "Other catalogue widgets" covers 11 widgets in one row (§ DESIGN.md:677; EXPERIENCE.md:228)

Document review's suggestion marks, Kanban cards, Timeline lanes, Table cells, Spreadsheet's formula bar and LaTeX's preview have no visual anatomy.

Fix: Give each widget a row with its anatomy and the tokens it uses, even if it stays at the FR-11 minimum.

Sources: rubric §3.8 — Triage B

**[Component coverage]** — F-37 Decline: delivery, undo, ask state and "the agent learns" are undefined (§ EXPERIENCE.md:142, :166-167, :295-298, :371, :381, :750; DESIGN.md:618; ACR-08, PCR-29; AD-10)

Whether a decline is held until Submit, whether it can be undone, and whether Postpone or Decline apply to an already answered question are unstated; postponing an answered question would retract a delivered answer, which no event expresses. AD-10's question states are open, answered and postponed, and ACR-08 adds an answer kind "or event", not a state, so the rule "every question that is not postponed is answered" never fires on an ask with a declined question, and an agent waiting on the ask state waits until collect's 20-minute limit. "The agent learns not to ask it again" invites a persistent store of declined questions, which AD-14 and FR-25 rule out.

Fix: In ACR-08, add `declined` as a terminal question state; the ask is answered when every question is answered or declined; "learns" means the declined event carries the reason and the shipped skills say not to ask again within the task, with nothing persisted; undo reuses ACR-05's reopen event.

Sources: rubric §3.9 · rubric §4.5 (undo point) · M-4 · EC-05 — Triage B

**[State coverage]** — F-38 The cold-load look is not recorded (§ EXPERIENCE.md:243, :703; SM-C2)

SM-C2 rules out partial boards, but nothing says what the user sees while the golden case's PlantUML render runs.

Fix: Specify the per-question loading treatment and how long it may last before an error shows.

Sources: rubric §4.3 — Triage B

**[State coverage]** — F-39 Formula errors and failing field checks have no treatment (§ EXPERIENCE.md:186, :271-272; AD-13)

Both are on the board, but their look and whether a failing check blocks the answer are not recorded. UJ-2's and UJ-3's failure paragraphs point at them (F-71).

Fix: Decide the inline error style and whether a failing check blocks the answer act.

Sources: rubric §4.4 — Triage B

**[State coverage]** — F-40 Reading panel states, and a referenced file that changed since the ask (§ EXPERIENCE.md:177-179, :277; AD-12; ACR-03)

Loading, a missing file or one outside the root, and a binary or very large file are open. Excerpts resolve at send time while the panel reads the file on click, so if the agent has since edited `checkout.md`, the panel shows other text at lines 40-52 with no warning, and "Open in editor" on a deleted file may create an empty one.

Fix: Add a row for each state; the panel shows the current file and says "Changed since the agent asked" when the excerpted range differs; "Open in editor" is disabled for a missing file.

Sources: rubric §4.6 · EC-46 — Triage B

**[State coverage]** — F-41 Unresolved pointers outside excerpts: the Image atom and a Diff alternative (§ EXPERIENCE.md:198, :221, :485)

Excerpts have an unresolved state; an Image atom and a Diff review alternative (a deleted branch, a patch file outside the root) do not, so the widget is empty or errors and "A vs B" has nothing to compare.

Fix: Reuse the unresolved-excerpt treatment: show the pointer, disable the unresolved fix and "A vs B", keep the rest of the board working, and send the agent a typed warning (AD-6).

Sources: rubric §4.9 · EC-31 — Triage B

**[Bloat & overspecification]** — F-42 Several rules are stated in three to ten places (§ EXPERIENCE.md:120, :188, :248, :380, :642 and others)

"Connection lost, retrying" appears in 5 places, the readable locked ended board in 4, "Keep this order" in 9, the Gantt baseline in 10 across both spines, the postpone undo in 3, preselection in 8 and browser storage in 6. Every edit must touch them all, and one drift has already appeared (F-33).

Fix: State each rule once in its owning section (Component Patterns or Ask Lifecycle) and refer to it elsewhere by section name.

Sources: rubric §6.1 — Triage B

**[Bloat & overspecification]** — F-43 Composition and Components carries implementation configuration (§ EXPERIENCE.md:470-597)

Library versions, RJSF `tagName` and `extraErrors`, Mermaid `htmlLabels: false`, the A2UI translator mapping and the CSP rationale belong to the architecture's §9 and the renderer spike. F-14 asks to add a board-page/view table to the same section.

Fix: Keep the atom and layout tables and the behavioural rules; move the component-per-widget table, the Form library constraints and the CSP reasoning into a promoted technical-choices reference and link it.

Sources: rubric §6.2 — Triage C

**[Inheritance discipline]** — F-44 The sources frontmatter does not resolve as written (§ DESIGN.md:5-11; EXPERIENCE.md:4-10; L127)

The PRD and architecture paths omit their `prds/` and `architecture/` parents and give no root, while the two change-request files are relative to the workspace. This was deliberate (L127), but a consumer in askboard cannot follow them.

Fix: Use `{planning_artifacts}/prds/prd-askboard-2026-10-25/prd.md` and the equivalent architecture path, and add one line on where these live in the askboard repository.

Sources: rubric §7.1 — Triage B

**[Inheritance discipline]** — F-45 The spines cite as authority material their sources do not list (§ EXPERIENCE.md:343-358, :754-756; about 25 "TC §x" citations)

`.working/technical-choices-proposal.md` holds the 22 approved decisions that bind the renderer spike; `reconcile-prd.md`, `reconcile-research.md` and the research ideas D3 to D8 are also cited.

Fix: Add them to `sources`, or promote the technical choices into the workspace's reference material and cite L160 for the rest.

Sources: rubric §7.2 — Triage B

**[Inheritance discipline]** — F-46 Form rules that do not hold, and the L164 note that never reached the spines (§ EXPERIENCE.md:225, :447, :576, :580, :584; L164; .working/technical-choices-proposal.md:333)

The spine bans `oneOf`, yet the approved mapping builds a titled pick as `oneOf` of `const` and `title`, and a flat elicitation form "shows on a board unchanged" although elicitation's titled enums are `oneOf`. The on/off field goes past FR-11's typed-field list and L164 marks it "to confirm with the user", but the spine states it as settled; neither point is in Open Items. A length cap on the agent's `pattern` does not stop catastrophic backtracking: `(a+)+$` is six characters and hangs the view.

Fix: Build picks as `enum` with `ui:enumNames` and convert titled-enum elicitation forms to that shape; carry both L164 points into Open Items or settle them; check `pattern` at send time against a safe subset (no backreferences, lookaround or nested quantifiers) and refuse the rest with an item-level error, or drop `pattern` from v1.

Sources: rubric §7.3 · M-9 — Triage B

**[Adversarial review]** — F-47 The width rules squeeze UJ-1's own first question and ignore the terminal-beside-browser setup (§ DESIGN.md:196, :557, :559; EXPERIENCE.md:64-67, :328-329; Open Items 22 (EXPERIENCE), 7 (DESIGN))

At the 1280px floor, after the 212px rail, the gutters and the 360px context column, a split question gets about 600 to 650px. UJ-1's Diff review has an excerpt, so it renders split, and in Split view each side gets about 300px, roughly 35 characters of 12px JetBrains Mono; Gantt, Spreadsheet, Table and Graph suffer the same. The users work with the terminal beside the browser, so on a laptop the window is usually well under 1280px, where nothing is defined. Header row 2 has not been checked with the Italian strings.

Fix: In a split card, put the question text, options and context column side by side and let a wide widget span the full card width below them; open the Diff in Unified view under about 900px; define the layout below the floor down to about 960px (rail into a drawer, context inline, quick toggles into Settings); check header row 2 in Italian.

Sources: M-3 · EC-24 — Triage B

**[Adversarial review]** — F-48 "Read by the agent" is ambiguous and claims more than AskBoard can know (§ EXPERIENCE.md:109, :169, :255-256, :298, :620; DESIGN.md:620; ACR-09; AD-3, AD-21)

AD-3 has two signals: `received` (returned by collect, carried in a stop block, or reported delivered by the mod) and acknowledgement (the agent passed the event's cursor on its next collect). ACR-09 names acknowledgement, the spine says "once the agent collects it". With the mod, events are pushed and a later collect may never acknowledge them: one team never shows "read", another shows it as soon as an event is pushed. Neither signal means the model read anything.

Fix: Tie the receipt to `received` (AD-3), label it "delivered to the agent" ("consegnata all'agente"), and amend ACR-09.

Sources: M-5 — Triage B

**[Adversarial review]** — F-49 "Not while the user works on another board" needs a signal and an opener mode that do not exist (§ EXPERIENCE.md:438, :611; PCR-01; AD-8; L141)

"Working on another board" is undefined (focus, last input, how recent) and board-host receives no focus or activity signal; teams will read it as a focused tab, unsent work, or recent input. The browser opener is an OS command and cannot open a background tab (macOS `open -g` only keeps the application in the background; `xdg-open` has no equivalent). What a click on the notification does is unspecified, though in the busy case it is the main way to the board. No ACR covers any of this.

Fix: Define "working" as a board of the same session having focus and a user input in the last 60 s, reported over the board protocol (new ACR); in the busy case AskBoard does not call the opener and the notification or terminal link opens the board; state what a notification click does on each platform, with the terminal link as fallback.

Sources: M-6 · EC-14 ("working on" point) — Triage B

**[Adversarial review]** — F-50 The keyboard core leaves out the widgets' answer paths, against L28 (§ EXPERIENCE.md:287, :314, :318-322; Open Items 21; L28)

L28 puts answering in the keyboard core, but the list omits Decline, the Approval decisions, "Accept all recommended", the agent-change choice and the per-option note, and explicitly leaves out Diff review's per-line controls, Graph editing and Gantt drag: the answer paths of UJ-1's climax and UJ-2's. Stories written from the list will have no keyboard criteria for them. Composer keys are not stated either, so Enter may send a half-written follow-up that goes to the agent at once.

Fix: Define the core as every action that produces an answer, a postpone, a decline or an edit choice, and name the minimum per widget: Diff review ✓, ✕ and file actions as focusable buttons; Graph nodes and edges focusable, Delete removes them, "Add transition" with from and to pickers; Gantt start and duration editable in the grid; the Tree's move actions; the Approval buttons. In the composer, Enter adds a line and a modified Enter sends.

Sources: M-7 · EC-52 — Triage B

**[Adversarial review]** — F-51 Colour roles: a removal is both "danger" and "change", and three hues share the red arc (§ DESIGN.md:38, :49, :63, :484-485, :684; EXPERIENCE.md:616)

DESIGN says danger "is for rejected or removed content", but UJ-1's climax highlights the transition Luca removed in `{colors.change}`; two teams will colour it differently. Change (#a3336f, about 328°), destructive (#b42335, about 353°) and critical (#c2410c, about 18°) lie within 50° of each other, so "the critical path never reads as danger" does not hold: on UJ-2's climax a user-changed task on the critical path becomes a plum outline on an orange-red bar.

Fix: Anything the user did takes the change hue, and its shape shows the kind of change (a removed edge or line dashed or struck through); danger is only for the diff's removed lines and "Rejected" chips. Move critical off the red arc, or show it by shape in `{colors.foreground}`. Add change against critical and change against destructive to the contrast table as distinguishability checks.

Sources: M-8 — Triage B

**[Adversarial review]** — F-52 The question card piles controls onto the single question the design is judged on (§ EXPERIENCE.md:31, :63, :157-170, :672-703; DESIGN.md:390, :608-621)

The golden two-option question carries the header chip and the question, "Options · pick one" with "Accept recommended", two options each with "+ Add your note to this option", the Diagram with its toolbar, the note field with Postpone, Explain and Decline, the follow-up row and later the receipt: three free-text channels to the agent and four secondary buttons on one simple question. Where Explain and Decline go is still open, so a default build puts everything in view, against the design's first principle. Compact density, chosen for large boards, is also the default on the case the design is judged on.

Fix: Progressive disclosure: "+ Add your note" only on a selected option or on hover or focus; Postpone stays visible, Explain and Decline go behind a keyboard-reachable "More" in the same row; the follow-up row stays collapsed. Then check the golden case again. Consider comfortable density for single-question boards, against L36.

Sources: M-10 — Triage B

**[Adversarial review]** — F-53 Agent display names: the default reads badly and duplicates collide (§ EXPERIENCE.md:33, :58, :96)

Without a display name, the name "from the agent type" gives "Subagent code-reviewer · code-reviewer", and the main conversation has no agent type at all. Two code-reviewer subagents asking at once show identical headers, notifications and pending-asks lines, told apart only by derived titles that may be similar.

Fix: With no display name, show "Main agent" or "Subagent <type>" alone; add a short distinguishing suffix per type in the session ("code-reviewer #2").

Sources: L-2 (display-name point) · EC-14 (display-name point) — Triage B

**[Edge-case review]** — F-54 The agent updates a widget during a drag or while the user types (§ EXPERIENCE.md:187)

"Without unsent work, a change shows without a reload", but "unsent work" is not defined for a gesture in progress. The list re-renders under the pointer, the drop lands on a revision whose indexes moved, and a field's text is replaced under the caret or mid IME composition.

Fix: An active gesture (pointer drag, focused field with a pending edit, IME composition) counts as unsent work; an update arriving during it is applied when the gesture ends, then the normal rules apply.

Sources: EC-12 — Triage B

**[Edge-case review]** — F-55 Questions the agent adds or deletes, and navigation (§ EXPERIENCE.md:375; Open Items 16)

The ask goes back to partly answered, but nothing says where an added question appears or how it is signalled (it may sit in a tab Sara is not on), or where the pager goes when its current question is deleted.

Fix: Added questions carry a "New" marker in the outline, the tab label and the question navigator until seen, and the next-unanswered jump reaches them first. On deletion of the current question, the pager moves to the next and says "Question removed by the agent".

Sources: EC-13 — Triage B

**[Edge-case review]** — F-56 The connection drops during a Submit or while answering (§ EXPERIENCE.md:188)

Whether inputs stay editable while retrying, whether answer acts are queued, and how a Submit with an unknown outcome is reconciled are not stated. A retried Submit may append twice or not at all, and answers given while offline may be dropped or sent late without the user knowing.

Fix: Inputs stay editable; answer acts are queued, shown without a receipt ("not sent yet") and sent in order on reconnect; Submit is disabled while disconnected; a Submit in flight carries an idempotency key, and on reconnect the board reads the log to show whether it landed.

Sources: EC-16 — Triage B

**[Edge-case review]** — F-57 The leave-page prompt also fires on reload (§ EXPERIENCE.md:247, :302)

The browser's beforeunload cannot tell a reload from a close, so F5 with unsent work shows "Changes you made may not be saved", which is false here since the draft is mirrored. A developer may try to suppress it by sniffing keys, which is fragile.

Fix: State that the prompt also appears on reload, accepted as a browser limit; arm it only when the draft has changes; never try to tell reload from close.

Sources: EC-18 — Triage B

**[Edge-case review]** — F-58 Clicking the notification for a board that is already open (§ EXPERIENCE.md:249; AD-21; Open Items 17)

A second tab opens and takes over; the tab Luca was typing in turns to "board moved", with no way to continue there, and keystrokes not yet mirrored may be lost in the handover.

Fix: The moved tab offers "Continue here", which takes the board back; a takeover waits for the old tab's last draft mirror before restoring.

Sources: EC-19 — Triage B

**[Edge-case review]** — F-59 A 200-node WBS (§ EXPERIENCE.md:234, :301)

The initial expansion, rendering of large trees, the Tree's keyboard move actions (mentioned, never named) and deleting a node that has children are not stated: all-expanded shows 200 rows plus excerpts, all-collapsed hides the agent's work, and a delete may silently remove 30 children and their estimates.

Fix: Open expanded to the agent's chosen depth, or two levels by default; virtualise rows; name the moves (up, down, indent, outdent); deleting a node with children asks for confirmation and states the count.

Sources: EC-22 — Triage B

**[Edge-case review]** — F-60 A 500-line excerpt in the context column (§ EXPERIENCE.md:177; DESIGN.md Layout)

Height, scrolling, line wrapping and whether Markdown files render or show as source are not stated. The card grows 500 lines tall beside a short question, or Inline placement pushes the options far down; long lines overflow or wrap unreadably at 360px.

Fix: Excerpts cap at a stated height with internal scroll and "Open in reading panel"; code does not wrap and scrolls horizontally; Markdown excerpts show as source text with line numbers, so line ranges stay meaningful.

Sources: EC-23 — Triage B

**[Edge-case review]** — F-61 One question per view: auto-advance and the ends of the list (§ EXPERIENCE.md:146)

Whether answering advances, and what Previous and Next do at the ends, are not stated. An auto-advance puts the note Luca meant to add off-screen; Next on the last question is disabled in one build and wraps in another.

Fix: Never auto-advance; Previous and Next are disabled at the ends; the next-unanswered jump is the way forward.

Sources: EC-25 — Triage B

**[Edge-case review]** — F-62 Two diagram elements with the same label (§ EXPERIENCE.md:213; AD-7)

An element without an ID is keyed by its quoted label, so a pin on the second "authorized" message re-attaches to the first after a re-render, silently, and the agent receives the comment on the wrong message.

Fix: Key unlabelled elements by label plus occurrence; when a re-render makes the match ambiguous, list the pin as detached rather than guess.

Sources: EC-30 — Triage B

**[Edge-case review]** — F-63 Approval while the board holds changes (§ EXPERIENCE.md:227; AXFX FR-40)

Marco lowered a rate and switched a line off, then clicks plain "Approve", or "Reject". The agent cannot tell whether "Approve" approves the original estimate or the edited one, and a verdict revised after the agent received it reaches an agent that may already have built the offer.

Fix: With board changes present, plain "Approve" is disabled and "Approve with changes" is the approving act; "Reject" sends the edits as context; revising a verdict the agent has received asks for confirmation.

Sources: EC-32 — Triage B

**[Edge-case review]** — F-64 Long and right-to-left agent strings (§ EXPERIENCE.md:51, :58)

No truncation, wrapping or length cap is stated for chips, tabs, outline entries, the header name, the title or the Recommended row, and bidirectional text is not mentioned. Chips and tabs overflow the header and tab strip; mixed-direction text reorders "Main agent · <name>"; a control character can make a path or name read as something else.

Fix: Display caps with an ellipsis and the full text on hover and focus; the tab strip scrolls; the derived title is cut at a stated length; isolate every agent string (`dir="auto"`, bidi isolation) and show bidi control characters in paths, IDs and notifications as visible escapes.

Sources: EC-37 — Triage B

**[Edge-case review]** — F-65 The theme switches while a diagram renders (§ EXPERIENCE.md:596)

A light render can finish last and leave a light diagram, with the hit map of the wrong render, on a dark board; an open comment card or an annotation in progress closes; readiness (SM-3) moves.

Fix: Each render carries a generation number and only the latest is applied, hit map included; open comment cards and pins survive a theme re-render; the item is ready on its first completed render.

Sources: EC-40 — Triage B

**[Edge-case review]** — F-66 Single-key shortcuts on a board that has just taken focus (§ Open Items 20; L141)

Across sessions a new board comes to the front as the browser normally does (L141). If postponing, declining or jumping use single keys, the letters of the sentence Luca was typing on board A trigger them on board B, which he has not read.

Fix: Any key that answers, postpones, declines, submits or sends needs a modifier and never fires while focus is in a field; a newly opened board ignores keys until the user clicks or focuses inside it.

Sources: EC-41 — Triage B

**[Edge-case review]** — F-67 Large widgets trap the Tab key (§ EXPERIENCE.md:314; Open Items 21)

On a 2,000-line Diff review, a 200-node tree or 30 options, thousands of Tab presses stand between the keyboard user and the note, Postpone and Submit.

Fix: Each widget is one Tab stop with roving focus inside; Tab leaves it; the outline jump and the question heading give a way around.

Sources: EC-42 — Triage B

**[Edge-case review]** — F-68 Where focus goes after a state change (§ EXPERIENCE.md:315)

Focus rules exist only for the question navigator. After a decline, a deletion by the agent, a notice on the field being typed in, or the ask closing, focus falls to the page body, or a notice steals it mid-sentence.

Fix: After Decline or Postpone, focus moves to the question heading; after a deletion, to the next question's heading; a notice never takes focus, it is announced and reachable; on close, focus moves to the banner.

Sources: EC-43 — Triage B

**[Edge-case review]** — F-69 Snapshot viewing: chrome, theme, offline diagrams and references (§ EXPERIENCE.md:178, :421-422; DESIGN.md token sets; AD-15)

Which controls a Snapshot shows, which theme it opens in (with no board page to send the theme, a literal build always opens light), whether diagrams can re-render offline, and what happens to "Waiting for the agent's revision…" labels are not stated. A FILE reference in a Snapshot points at the token-gated reading panel, which does not exist offline, so the click fails silently or tries to reach a server that is not there.

Fix: A Snapshot hides answer, delivery and settings controls and keeps view controls; it opens in the viewer's system theme with a theme toggle that saves nothing; diagrams carry a light and a dark render; pending-translation labels are dropped; FILE references show path and anchor as text, marked "not available in a Snapshot"; web references open on an explicit click.

Sources: EC-44 · EC-45 · H-5 (Snapshot-theme point) — Triage B

**[Edge-case review]** — F-70 Display-only items outside any question (§ EXPERIENCE.md:53-68; AD-20)

AD-20 gives top-level items, such as a context Chart, their own revision, but the board anatomy holds only question cards. Teams will place them at the top, in an area or in a pseudo-card, and the outline and counts will include or ignore them differently.

Fix: A top-level item renders as an untitled context block at the top of its area (or of the board when it has none), is listed in the outline without a state, and never counts in any counter.

Sources: EC-47 — Triage B

### Low (35)

**[Flow coverage]** — F-71 UJ-2 and UJ-3 failure paragraphs point at unrecorded treatments (§ EXPERIENCE.md:642, :656)

The formula error and the empty-reason message they cite are not recorded.

Fix: Close them with F-39 and F-04, then cite the rows.

Sources: rubric §1.3 — Triage B

**[Flow coverage]** — F-72 UJ-4 has a working title and takes a PRD number before PCR-19 is applied (§ EXPERIENCE.md:658)

"Language switch (UX-originated)" is a working title, and the journey number is taken before the PRD has it.

Fix: When askboard applies PCR-19, adopt the PRD's title and number verbatim.

Sources: rubric §1.5 — Triage C

**[Token completeness]** — F-73 The Chart's categorical palette is unset (§ DESIGN.md:677, :742)

Under the inheritance rule, shadcn's default `chart-1..5` would apply without being checked against Warm Paper & Petrol.

Fix: Declare `chart-1..5` with light/dark values, or state that the shadcn defaults are accepted.

Sources: rubric §2.5 — Triage C

**[Token completeness]** — F-74 Spacing keys and primary-subtle are unused, and component tokens carry no metrics (§ DESIGN.md:31, :190-192)

`spacing.sm`, `spacing.md`, `spacing.lg` and `colors.primary-subtle` are defined but used by no component token or prose rule; the component tokens carry no padding, gap or height, so the compact metrics live nowhere.

Fix: Wire spacing into the component tokens (row padding, header row height), or drop the unused keys.

Sources: rubric §2.6 — Triage B

**[Token completeness]** — F-75 Four typography tokens have no lineHeight (§ DESIGN.md:148-175)

`typography.question`, `control`, `badge` and `label` lack `lineHeight`; `question` is the one large text and can run to several lines.

Fix: Add a `lineHeight` to each.

Sources: rubric §2.7 — Triage B

**[Token completeness]** — F-76 No icon set is chosen (§ DESIGN.md:486-492, :731)

The specs rely on marker shapes and glyphs (ring, half dot, square, bar, triangle, ✓ ✕ ↗ ↓) without a source for them.

Fix: Choose a bundled open-licence set, or state that the markers are CSS or inline SVG and the glyphs are text.

Sources: rubric §2.8 — Triage C

**[Component coverage]** — F-77 The "link-weight" action is not a Button variant (§ DESIGN.md:614, :659)

Accept recommended, "+ Add your note…", "Ask a follow-up", "Show preview" and "Collapse" use it, but the Button row lists only primary, secondary, tool-active and disabled.

Fix: Add a link/ghost variant with its tokens.

Sources: rubric §3.10 — Triage B

**[Component coverage]** — F-78 No control returns the theme to "follow the system" (§ EXPERIENCE.md:143, :403)

The Theme toggle overrides the system preference, and nothing undoes the override.

Fix: Make the toggle three-state (System, Light, Dark), or put "Follow system" in the settings panel.

Sources: rubric §3.11 — Triage B

**[Component coverage]** — F-79 Some named pieces have no row (§ DESIGN.md:245, :608, :649-651; EXPERIENCE.md:494, :533)

The `section-label` token has no row; the Divider atom and the Scale's Toggle Group rating mode are missing from DESIGN's Primitives.

Fix: Add them to the existing rows.

Sources: rubric §3.12 — Triage B

**[State coverage]** — F-80 Settings and Snapshot write failures, Snapshot feedback, and unsent work at Snapshot time (§ EXPERIENCE.md:151, :278, :424-426; AD-15; Open Items 18)

A settings-file write failure and a Snapshot write failure (folder unwritable, disk full) have no state, and the Snapshot feedback is open. AD-15 says a Snapshot taken with unsent work "says so" without saying where, so the note may appear only inside the file, unseen.

Fix: Add one error row each, with the folder path, and the success feedback; before taking a Snapshot with unsent work, say "Your unsent work will not be in the Snapshot" on the board, and in the file.

Sources: rubric §4.7 · EC-53 — Triage B

**[State coverage]** — F-81 What remains after "Keep mine", and the "0 unanswered" state (§ EXPERIENCE.md:142, :187)

Whether a marker lasts after "Keep mine", and how the count and the next-unanswered jump look at zero, are not stated.

Fix: Add both to State Patterns.

Sources: rubric §4.8 — Triage C

**[Bloat & overspecification]** — F-82 DESIGN carries mechanism (§ DESIGN.md:414, :672)

The "Dark theme mechanism" paragraph and the Diagram row's blob and SVG-rewrite pipeline repeat EXPERIENCE's Dark theme and Annotation overlay sections.

Fix: Keep the visual outcome in DESIGN and link to EXPERIENCE for the mechanism.

Sources: rubric §6.3 — Triage C

**[Bloat & overspecification]** — F-83 Some sections restate the sources (§ EXPERIENCE.md:25-29, :365-382, :416-426, :428-442)

The Foundation's architectural frame, Ask Lifecycle (AD-10 states), Snapshots (FR-26, FR-27, AD-15) and Notices (FR-23) restate their sources.

Fix: Keep only the UX deltas and cite the requirement for the rest.

Sources: rubric §6.4 — Triage C

**[Bloat & overspecification]** — F-84 The "Decided after distill" subsections record history, not the contract (§ DESIGN.md:719-721; EXPERIENCE.md:716-721)

The memlog already holds the run's history.

Fix: Drop them.

Sources: rubric §6.5 — Triage C

**[Bloat & overspecification]** — F-85 The Italian column of Voice and Tone is empty in 28 of 29 rows (§ EXPERIENCE.md:93-121)

The column is "—" almost everywhere.

Fix: Keep it only if the Italian strings will be filled before the stories; otherwise drop it and keep the Open Items line.

Sources: rubric §6.6 — Triage C

**[Inheritance discipline]** — F-86 Several elements have more than one name (§ EXPERIENCE.md:67, :76-77, :176, :509-522, :677, :754)

One question per view / Question pager; Single-question board / slim board; Sections and Tabs / Area sections and Area tabs; context column / context block; outline navigator / outline rail; bottom action bar / bottom bar.

Fix: Use the Presentations and Component Patterns names everywhere.

Sources: rubric §7.4 — Triage B

**[Inheritance discipline]** — F-87 Colour names where component tokens are meant (§ EXPERIENCE.md:275, :612, :652)

"'Agent: Working' in `{colors.agent}`" renders `agent-text` on `agent-subtle`, with `agent` only as the marker; "a warning status chip in `{colors.warning}`" is `status-chip-warning`.

Fix: Reference `state-pill-agent-working` and `status-chip-warning`.

Sources: rubric §7.5 — Triage B

**[Inheritance discipline]** — F-88 NFR-9 is cited for "a board loads nothing from the network" (§ DESIGN.md:526; EXPERIENCE.md:307, :335)

NFR-9 is "No telemetry"; the rule against loading anything comes from AD-8's CSP and the addendum.

Fix: Cite AD-8 first.

Sources: rubric §7.6 — Triage B

**[Shape fit]** — F-89 DESIGN.md adds material outside the canonical body (§ DESIGN.md:4-12, :382-386, :715)

An H1 and a "Citations" preamble before Brand & Style, an "Open Items" section after Do's and Don'ts, and the frontmatter keys status, sources and updated beside the token keys; tools that read the DESIGN.md spec may not expect them.

Fix: Keep Open Items last and mark it as outside the spec, or move its contents into the memlog and EXPERIENCE Open Items.

Sources: rubric §8.1 — Triage C

**[Shape fit]** — F-90 Notices and Snapshots overlap the IA rows (§ EXPERIENCE.md:46-48, :151, :416-442)

Notices overlaps the IA rows for System notification and Terminal link; Snapshots overlaps the IA Snapshot row and the Snapshot control.

Fix: Keep the detail in Notices and Snapshots, and leave the IA rows as pointers.

Sources: rubric §8.2 — Triage C

**[Adversarial review]** — F-91 The radius tokens do not map onto shadcn the way DESIGN says (§ DESIGN.md:181-185, :577-579)

shadcn derives its radius scale from `--radius` (sm = radius − 4px, md = radius − 2px, lg = radius, xl = radius + 4px), and its Button and Input use `rounded-md`, so `--radius: 4px` as written gives 2px controls. The spine's `rounded.md` (6px) also collides with Tailwind's `rounded-md`.

Fix: Set `--radius: 6px`, so `rounded-md` gives 4px for controls and `rounded-lg` 6px for the question card; rename the tokens to Tailwind's names.

Sources: L-1 — Triage B

**[Adversarial review]** — F-92 The selected delivery mode is told apart almost by hue alone (§ DESIGN.md:74, :326-332, :436-437, :457-459, :660)

The selected segment differs from the track by about 1.16:1 (`card` on `muted`) plus a text hue: a weak cue for the board's most consequential toggle. The "partly answered" pill uses exactly the `primary-subtle` and `primary-text` values, so it reads as a selected, interactive control.

Fix: Give the selected segment a cue that is not colour (semibold with a check mark, or a 2px underline in `primary`); point `ask-partial` at a neutral or a hue of its own, outside the accent family.

Sources: L-3 — Triage B

**[Edge-case review]** — F-93 Reopening the link of a closed ask, or a tab closed moments ago (§ EXPERIENCE.md:83; AD-21)

The invalid-link page covers discarded asks, not closed ones, so it is unclear whether a closed board can be reopened to take a Snapshot; a tab reopened within the grace period silently comes back.

Fix: A closed ask's link opens its locked board, Snapshot included; a tab reopened within grace returns.

Sources: EC-48 — Triage B

**[Edge-case review]** — F-94 The outline rail on a 50-question board (§ EXPERIENCE.md:61)

The rail is sticky, but its own scrolling and a current-position marker are not stated, so it is taller than the window and the user cannot see where they are.

Fix: The rail scrolls on its own and highlights the question in view.

Sources: EC-49 — Triage B

**[Edge-case review]** — F-95 Agent-written excerpts on a language switch (§ L149)

L149 keeps excerpts taken from files in their source language; excerpts the agent wrote (GitHub, Atlassian or plain text) are not covered, and teams will translate them or not.

Fix: Agent-written excerpts stay as written, like file excerpts.

Sources: EC-50 — Triage B

**[Edge-case review]** — F-96 Mixed currencies summed into one total (§ EXPERIENCE.md:489)

A MoneyField's currency may be user-picked, and totals over mixed currencies are not covered: a USD line summed into an EUR total gives a wrong margin.

Fix: A summed money column has one fixed currency; mixed currencies show a formula error.

Sources: EC-51 — Triage B

**[Edge-case review]** — F-97 The agent pill cannot say which question blocks the agent (§ AD-4)

When collect waits for one item (question 37 of 50), the pill says only "Waiting for your answer".

Fix: When the wait names an item, the pill names its chip and jumps to it.

Sources: EC-54 — Triage C

**[Edge-case review]** — F-98 No minimum margin from the agent or the project (§ EXPERIENCE.md:236)

"Otherwise comes from a project default" leaves either no warning at all or an invented threshold.

Fix: With no minimum, no warning and no chip.

Sources: EC-55 — Triage B

**[Edge-case review]** — F-99 "For: Marco" shown to Marco himself (§ EXPERIENCE.md:58)

The agent names "Marco" and the git user is "Marco Rossi", so the header shows "For: Marco" to Marco.

Fix: Compare case-insensitively, as a prefix of the git name or against the git email's local part.

Sources: EC-56 — Triage C

**[Edge-case review]** — F-100 A one-question ask for which the agent requests one question per view (§ EXPERIENCE.md:77)

The slim board is automatic and the pager is the agent's choice; which wins is unclear.

Fix: The slim board wins; the pager needs two or more questions.

Sources: EC-57 — Triage B

**[Edge-case review]** — F-101 An area the agent has emptied (§ FR-2)

When the agent deletes every question of an area, an empty section or tab remains.

Fix: Hide an empty area.

Sources: EC-58 — Triage B

**[Edge-case review]** — F-102 Buttons that do nothing (§ EXPERIENCE.md:68, :150)

"Accept all recommended" on a board with no recommendations, and Submit in submitted delivery with nothing held.

Fix: Hide "Accept all" when there is no recommendation; disable Submit when nothing is held.

Sources: EC-59 — Triage B

**[Edge-case review]** — F-103 Explain clicked twice; follow-ups on finished questions (§ EXPERIENCE.md:168)

Two identical follow-ups wake the agent twice, and follow-ups on answered, declined or postponed questions behave differently per build.

Fix: Explain is disabled while its reply is pending; follow-ups stay available on any question while the ask is open.

Sources: EC-60 — Triage B

**[Edge-case review]** — F-104 A question whose only excerpt is unresolved (§ EXPERIENCE.md:64)

The question splits whenever excerpts exist, leaving a 360px column holding only an "unresolved" line.

Fix: Split only when at least one excerpt resolved; otherwise show the unresolved pointer inline.

Sources: EC-61 — Triage B

**[Edge-case review]** — F-105 Three tabs from three worktrees with similar titles (§ EXPERIENCE.md:51)

The tab reads "<title> · AskBoard"; headers tell asks apart, tabs do not.

Fix: Add the branch or worktree to the tab title when it differs from the main checkout.

Sources: EC-62 — Triage C

## Mechanical notes

- A merged finding takes the highest severity among its sources. It sits in the rubric category when the rubric raised it, otherwise under the reviewer that did (adversarial before edge cases).
- 130 raw findings (rubric 48, adversarial 20, edge cases 62) merge into 105.
- Tokens: 247 `{path}` references (DESIGN components YAML, DESIGN body and EXPERIENCE), 0 unresolved. 41 component tokens, each with a titled row under the same name except `section-label`. Unused keys: `spacing.sm`, `spacing.md`, `spacing.lg` and `colors.primary-subtle`.
- Colours: 112 keys, 56 light plus 56 `-dark`, all `'#rrggbb'` and all paired. The 30 alias comments match their targets in both modes. The palette table's 49 rows match the YAML; the 7 shadcn aliases are described in prose.
- Contrast: the 23 stated pairs recompute exactly in both modes and 28 extra pairs pass. Lowest: `border-strong` on `muted` 3.01 (light), the warning marker on `warning-subtle` 3.62 (light), `gantt-bar` on `card` 3.49 (light) and 3.42 (dark).
- Citations: 53 distinct L citations in DESIGN and 100 in EXPERIENCE, all pointing at memlog entries; PCR-01 to PCR-33, ACR-01 to ACR-10 and S-1 to S-7 exist; AD-2 to AD-22 exist in `ARCHITECTURE-SPINE.md`; FR, NFR, SM and UJ IDs exist in `prd.md` (FR-36 is the AXFX PRD's and is labelled so).
- Working artifacts: every cited `.working/` file exists (structural mock, golden-1-base, colour page, Stitch index, technical-choices proposal).
- Frontmatter: both files are `status: draft` and `updated: 2026-10-27`, consistent with memlog L163. DESIGN has name, description, sources and every token group; EXPERIENCE has name and sources.
- Diagrams: no Mermaid. The one PlantUML block (`EXPERIENCE.md:680-694`) is valid; its creation-before-authorization order is the deliberate defect the golden case asks the user to catch.
- Contradictions found: language toggle persistence vs precedence (F-05); context-placement persistence (F-33); the golden case's Submit vs Submit disabled in immediate delivery (F-01).

## Reviewer files

- `review-rubric.md`
- `review-adversarial.md`
- `review-edge-cases.md`

## Triage

Every merged finding sits in exactly one group. A: two reasonable resolutions would give a different product, so the decision is the user's. B: the resolution applies a recorded decision (memlog line, PCR) or the architecture (AD, ACR) with no new product choice; the line says what to apply. C: non-blocking, can stay as an open item.

Some B resolutions wait on an A answer: F-02, F-29 and the golden-case parts of F-52 on F-01, and F-102 on F-10.

### (A) Needs a product decision — 5 (1 critical, 4 high)

1. **Critical** · F-01 — What sends a question's answer: one explicit per-question "Answer" action for every question (clicks, widget edits and notes only fill the draft), or does a click on a plain single-choice option answer at once, with the explicit action only for composite questions? (rubric §3.1, rubric §1.2 (Submit contradiction), C-1, EC-01, EC-03)
2. **High** · F-10 — Keep "Accept all recommended" in v1 (PCR-13) as a confirmed bulk selection with an ACR amending AD-10, or drop it and keep only the per-question "Accept recommended"? (H-1, EC-06)
3. **High** · F-11 — On a language switch, may the agent translate questions already answered (ACR-01 then needs guards against AD-20), or do answered questions keep their language, labelled "Answered in English"? (H-2, EC-35)
4. **High** · F-12 — Should the settings panel edit the behavioural settings (asking rules, Snapshot folder and, per L79, the editor command), which needs a wider ACR-02 and accepts a board-written editor command, or show them read-only with the file and key to edit? (H-3, EC-38)
5. **High** · F-21 — When an answered ask still has postponed questions and its tab closes, how does UJ-2 continue: a leave-page prompt or "keep this tab open" hint, an early Snapshot by the skills, or an ACR letting the ask outlive its tab? (EC-15)

### (B) Apply a recorded decision or the architecture — 86 (1 critical, 21 high, 42 medium, 22 low)

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| F-02 | critical | Arrow keys on the options select them, under the inherited Radix behaviour | Apply AD-10 and NFR-10: options use manual activation (arrows move focus; Space or Enter selects). |
| F-03 | high | The reading panel's placement, opening and focus are undecided | Render it on the board page (AD-8 forbids framing inside the view) as a non-modal side sheet over the context column; Esc or a close control dismisses it and focus returns to the reference. |
| F-04 | high | Approval, the climax component of UJ-3, has no visual spec | Decision buttons are secondary with a selected state (no second primary); specify the summary anatomy; relabel the note "Reason for the changes (required)" when the decision requires it. |
| F-05 | high | The language toggle's persistence contradicts the language precedence | Keep the recorded precedence (EXPERIENCE.md:387, AD-14): the toggle sets this board, held per ask (F-33), and the user setting, which applies where no project or agent language does; language never propagates to open boards; Settings shows each effective value and its source. |
| F-06 | high | The dark diagram theme is open while the diagram tokens already carry dark values | Declare the `diagram` tokens' dark values as the dark diagram theme and map them to Mermaid themeVariables and PlantUML skinparams. |
| F-07 | high | A diagram source that fails to render has no state | Keep the last good render and its pins, show the parse error with its line under Source; a failed first render opens Source and counts as ready; the answer carries the source as written. |
| F-08 | high | Held, postponed, declined and follow-up-pending questions have no treatment and no counting rule | One counting table: held answers count as answered on the board and are marked held; the ask pill reflects only what the agent received; postponed and declined get marker shapes and their own counts; the jump becomes "Next open" and counts what it reaches. |
| F-09 | high | UJ-2's climax: splitting a work package, and the Gantt it drives, are unspecified | Apply "AskBoard computes derived values": a new WBS leaf gets a Gantt task (PERT expected duration, parent's predecessors); deleting a package reconnects its dependents after a confirmation; view-made IDs use a reserved prefix agents may not use. |
| F-13 | high | Diff review alternatives given as branches or commits need git access the architecture does not provide | Apply AD-8 and AD-12: v1 takes the two alternatives as patch files under the ask's root, with the base named in the item; amend ACR-07. |
| F-14 | high | The spines never say what runs on the board page and what runs in the sandboxed view | Add the "Board page or view" table derived from AD-8 and AD-9, with the view following prefers-color-scheme when it has no host. |
| F-15 | high | Behaviour that depends on pending change requests reads as settled, with no fallback | Add the dependency table with the fallbacks H-6 lists (each falls back to the architecture as it stands) and mark inline citations "(pending)". |
| F-16 | high | Submit while an agent-change notice is unresolved | Apply AD-20: Submit and the mode-switch flush are blocked until every notice on a held item is resolved; the bar counts them and jumps to the first. |
| F-17 | high | The ask closes or is discarded while the user has unsent work | Apply AD-20 (drafts never reach the agent): the banner says the unsent work was not sent, the draft stays visible and selectable, and "Copy my unsent work" copies it. |
| F-18 | high | What a reopened question shows is undefined | Apply AD-10 ("nothing starts with a value"): start from the new revision, show the previous answer read-only, offer "Start from my previous answer" as an explicit act. |
| F-19 | high | "Reload, losing my work" or "Keep mine" is a blind choice on large widgets | Keep the recorded two-way choice (no merge in v1); add the stake count and a read-only "Show the agent's change" before choosing. |
| F-20 | high | A follow-up reply that arrives off-screen is never announced | Add an unread-reply marker on the outline and navigator entries and a header count ("1 new reply") that jumps to it. |
| F-22 | high | A 2,000-line diff with per-line decisions | Keep per-line and per-file decisions (EXPERIENCE.md:221); list undecided changes explicitly in the answer (fail closed, AD-10); collapse unchanged context and files; virtualise. |
| F-23 | high | A question with 30 options turns into a dropdown | Apply FR-1: question options never become a dropdown; long lists gain a filter field; dropdowns only in Form pick fields. |
| F-24 | high | Dragging a Gantt task against its dependencies or the calendar | Apply the compute graph (dates derive from durations and dependencies on the AD-7 working calendar): drags snap to working days and stop at the earliest allowed start; dependencies are edited explicitly. |
| F-25 | high | Diff review's "A vs B": what the decisions mean | Apply the question-card anatomy (options plus widget): the fix choice is an option, decisions are kept per fix, "A vs B" takes comments only. |
| F-26 | high | Number and money input: the decimal comma and the browser's own number input | Number and money atoms are text inputs with AskBoard's own locale parser; ambiguous input is refused; the parsed value is echoed; never type=number. |
| F-27 | high | Switching language while a money or date field is half typed | Apply "formats switch with the language" (:389): parse in the old locale before switching, drafts hold contract values; English uses the agent's declared locale, else one recorded default (en-GB suggested). |
| F-28 | medium | Language switch (UJ-4): no event in the architecture, a waiting label that can stay forever, and unhandled round trips | Add ACR-11 (a coalesced language-changed event); one board-level notice with a terminal "did not translate" state; translations carry their language; texts kept per language; toggles debounced. |
| F-29 | medium | The golden single-question case is a checklist, not a flow | Rewrite it as the short flow above, naming the delivery mode, once F-01 settles the answer act. |
| F-30 | medium | The comfortable density has no tokens | Apply L36 (compact by default, with a user switch to comfortable): add the comfortable typography and spacing deltas. |
| F-31 | medium | There are no elevation tokens | Add shadow-* tokens with light and dark values, tinted on the warm neutral. |
| F-32 | medium | The syntax-highlighting palette is undeclared | Apply L160 (class-based highlighting approved): declare syntax-* tokens with light/dark pairs checked on diff-add and diff-del. |
| F-33 | medium | Which view state survives a reload is unstated, and context-placement persistence is ambiguous | Apply L57: the board language, per-question placement, composer text and option notes join the per-ask draft record (extend ACR-02 next to AD-20); tab or pager position restores; scroll and open threads reset. |
| F-34 | medium | The board banner and the agent-change notice have words but no visual | Specify surface, marker, tokens and actions for both, reusing the state-pill marker shapes. |
| F-35 | medium | The annotation comment card has no behavioural rules | Add a Comment card row to both spines: create, edit, delete, dismiss, focus back to the pin. |
| F-36 | medium | "Other catalogue widgets" covers 11 widgets in one row | Give each of the 11 widgets its own row with anatomy and tokens at the FR-11 minimum. |
| F-37 | medium | Decline: delivery, undo, ask state and "the agent learns" are undefined | Treat Decline as an answer kind (ACR-08): it follows the delivery mode, is revised or undone like an answer, adds a terminal declined state; Postpone and Decline are disabled on answered questions; nothing persists. |
| F-38 | medium | The cold-load look is not recorded | Specify the per-question loading treatment and the time after which it turns into an error. |
| F-39 | medium | Formula errors and failing field checks have no treatment | Inline error under the field or cell; a failing field check blocks that question's answer act, a formula error does not (AD-13: shown, never refused). |
| F-40 | medium | Reading panel states, and a referenced file that changed since the ask | Apply ACR-03 (the panel reads on click): rows for loading, missing, outside the root, binary and large; a "Changed since the agent asked" note; "Open in editor" disabled for a missing file. |
| F-41 | medium | Unresolved pointers outside excerpts: the Image atom and a Diff alternative | Reuse the unresolved-excerpt treatment for Image atoms and Diff alternatives, with a typed warning to the agent (AD-6). |
| F-42 | medium | Several rules are stated in three to ten places | State each repeated rule once in its owning section and refer to it by section name elsewhere. |
| F-44 | medium | The sources frontmatter does not resolve as written | Write sources as {planning_artifacts}/prds/… and …/architecture/…, plus one line on where they live in askboard. |
| F-45 | medium | The spines cite as authority material their sources do not list | Add the technical choices and reconcile files to sources, citing L160 for their approval. |
| F-46 | medium | Form rules that do not hold, and the L164 note that never reached the spines | Picks as enum with ui:enumNames; keep the on/off field as approved in L160 and record it as an accepted extra; restrict pattern to a safe subset checked at send time. |
| F-47 | medium | The width rules squeeze UJ-1's own first question and ignore the terminal-beside-browser setup | Wide widgets span the full card width below the split and the Diff opens Unified under about 900px; the layout below the floor stays Open Item 22. |
| F-48 | medium | "Read by the agent" is ambiguous and claims more than AskBoard can know | Apply AD-3: tie the receipt to received, label it "delivered to the agent", amend ACR-09. |
| F-49 | medium | "Not while the user works on another board" needs a signal and an opener mode that do not exist | Apply L141: define "working" (a focused board of the session with input in the last 60 s, new ACR); when busy, skip the opener; the notification or terminal link opens the board. |
| F-50 | medium | The keyboard core leaves out the widgets' answer paths, against L28 | Apply L28: the keyboard core covers every answer, postpone, decline and edit choice, with a named minimum per widget; in the composer a modified Enter sends. |
| F-51 | medium | Colour roles: a removal is both "danger" and "change", and three hues share the red arc | Apply the recorded rule "the critical path never reads as danger": user changes take the change hue with shape for the kind; critical leaves the red arc or moves to shape. |
| F-52 | medium | The question card piles controls onto the single question the design is judged on | Apply the first principle (lower felt complexity): progressive disclosure as listed; density stays compact by default per L36. |
| F-53 | medium | Agent display names: the default reads badly and duplicates collide | With no display name show "Main agent" or "Subagent <type>"; add a per-type ordinal for duplicates ("code-reviewer #2"). |
| F-54 | medium | The agent updates a widget during a drag or while the user types | An active drag, focused edit or IME composition counts as unsent work; the update applies when it ends. |
| F-55 | medium | Questions the agent adds or deletes, and navigation | "New" marker on added questions until seen, reached first by the jump; a deleted current question moves the pager on with "Question removed by the agent". |
| F-56 | medium | The connection drops during a Submit or while answering | Inputs stay editable while retrying; answer acts queue as "not sent yet"; Submit is disabled offline and idempotent on retry. |
| F-57 | medium | The leave-page prompt also fires on reload | State that the leave-page prompt also shows on reload (browser limit); arm it only when the draft has changes. |
| F-58 | medium | Clicking the notification for a board that is already open | Apply the AD-21 takeover with a way back: the moved tab offers "Continue here"; a takeover waits for the last draft mirror. |
| F-59 | medium | A 200-node WBS | Open to the agent's depth or two levels, virtualise, name the Tree moves, confirm deletes of nodes with children. |
| F-60 | medium | A 500-line excerpt in the context column | Cap excerpt height with internal scroll and "Open in reading panel"; no wrap for code; Markdown as source with line numbers. |
| F-61 | medium | One question per view: auto-advance and the ends of the list | Never auto-advance; Previous and Next disabled at the ends. |
| F-62 | medium | Two diagram elements with the same label | Key by label plus occurrence; an ambiguous match becomes a detached pin. |
| F-63 | medium | Approval while the board holds changes | Apply the three-decision design: with edits present, "Approve with changes" is the approving act; Reject carries the edits as context; revising a received verdict asks to confirm. |
| F-64 | medium | Long and right-to-left agent strings | Cap and ellipsize agent strings with the full text on hover and focus; isolate them for bidi; show bidi controls as escapes. |
| F-65 | medium | The theme switches while a diagram renders | Number renders by generation and apply only the latest; pins and comment cards survive a theme re-render. |
| F-66 | medium | Single-key shortcuts on a board that has just taken focus | Answer-producing keys need a modifier and never fire in a field; a new board ignores keys until the user focuses it. |
| F-67 | medium | Large widgets trap the Tab key | Each widget is one Tab stop with roving focus inside. |
| F-68 | medium | Where focus goes after a state change | Define focus targets after Decline, Postpone, deletion and close; notices never take focus. |
| F-69 | medium | Snapshot viewing: chrome, theme, offline diagrams and references | A Snapshot hides answer, delivery and settings controls, opens in the system theme, carries light and dark diagram renders, drops pending labels and shows FILE references as text. |
| F-70 | medium | Display-only items outside any question | Top-level items render as an untitled context block at the top of their area, listed without a state, never counted. |
| F-71 | low | UJ-2 and UJ-3 failure paragraphs point at unrecorded treatments | Cite the rows once F-39 and F-04 land. |
| F-74 | low | Spacing keys and primary-subtle are unused, and component tokens carry no metrics | Wire spacing.sm, md and lg into the component tokens (row padding, gaps, header row height), or drop them. |
| F-75 | low | Four typography tokens have no lineHeight | Add a lineHeight to question, control, badge and label. |
| F-77 | low | The "link-weight" action is not a Button variant | Add a link/ghost Button variant with its tokens. |
| F-78 | low | No control returns the theme to "follow the system" | Make the theme toggle three-state: System, Light, Dark. |
| F-79 | low | Some named pieces have no row | Add section-label, Divider and the Scale's Toggle Group to the existing DESIGN rows. |
| F-80 | low | Settings and Snapshot write failures, Snapshot feedback, and unsent work at Snapshot time | Add error rows for settings and Snapshot write failures with the path, the success feedback, and a pre-Snapshot note that unsent work is not included. |
| F-86 | low | Several elements have more than one name | Use the Presentations and Component Patterns names everywhere. |
| F-87 | low | Colour names where component tokens are meant | Reference state-pill-agent-working and status-chip-warning instead of bare colours. |
| F-88 | low | NFR-9 is cited for "a board loads nothing from the network" | Cite AD-8 (CSP) for "loads nothing from the network". |
| F-91 | low | The radius tokens do not map onto shadcn the way DESIGN says | Set --radius to 6px and rename the radius tokens to Tailwind's names. |
| F-92 | low | The selected delivery mode is told apart almost by hue alone | Add a non-colour cue to the selected segment; move ask-partial off the accent family. |
| F-93 | low | Reopening the link of a closed ask, or a tab closed moments ago | State AD-21's behaviour: a closed ask's link opens its locked board with Snapshot; a tab reopened within grace returns. |
| F-94 | low | The outline rail on a 50-question board | The outline rail scrolls on its own and highlights the question in view. |
| F-95 | low | Agent-written excerpts on a language switch | Apply L149: excerpts stay in their source language, agent-written ones included. |
| F-96 | low | Mixed currencies summed into one total | A summed money column has one fixed currency; mixed currencies raise a formula error. |
| F-98 | low | No minimum margin from the agent or the project | With no minimum margin anywhere, show no warning and no chip. |
| F-100 | low | A one-question ask for which the agent requests one question per view | The slim board wins; the pager needs two or more questions. |
| F-101 | low | An area the agent has emptied | Hide an area the agent has emptied. |
| F-102 | low | Buttons that do nothing | Hide "Accept all" when no question has a recommendation (if F-10 keeps it); disable Submit when nothing is held. |
| F-103 | low | Explain clicked twice; follow-ups on finished questions | Disable Explain while its reply is pending; follow-ups stay available on any question while the ask is open. |
| F-104 | low | A question whose only excerpt is unresolved | Split only when at least one excerpt resolved; otherwise show the unresolved pointer inline. |

### (C) Non-blocking open items — 14 (1 medium, 13 low)

| ID | Severity | Finding | Why it can stay open |
|---|---|---|---|
| F-43 | medium | Composition and Components carries implementation configuration | Editorial move with no harm before the stories; do it when the technical-choices reference is promoted (with F-45). |
| F-72 | low | UJ-4 has a working title and takes a PRD number before PCR-19 is applied | Resolves when askboard applies PCR-19. |
| F-73 | low | The Chart's categorical palette is unset | The inherited shadcn default works as a fallback; settle when a Chart is mocked. |
| F-76 | low | No icon set is chosen | Non-blocking for the mocks; the renderer spike can settle it within AD-8 (bundled assets only). |
| F-81 | low | What remains after "Keep mine", and the "0 unanswered" state | Polish; settle alongside F-08's counting table or in the mocks. |
| F-82 | low | DESIGN carries mechanism | Editorial; no downstream consumer misreads it. |
| F-83 | low | Some sections restate the sources | Editorial; the restated text matches its sources. |
| F-84 | low | The "Decided after distill" subsections record history, not the contract | Editorial; the memlog already holds the history. |
| F-85 | low | The Italian column of Voice and Tone is empty in 28 of 29 rows | Needed only before the stories; the Open Items line already tracks it. |
| F-89 | low | DESIGN.md adds material outside the canonical body | Matters only if a tool parses DESIGN.md against the spec; keep Open Items last. |
| F-90 | low | Notices and Snapshots overlap the IA rows | Editorial overlap with no contradiction; fold into F-42's pass. |
| F-97 | low | The agent pill cannot say which question blocks the agent | Enhancement; nothing breaks without it. |
| F-99 | low | "For: Marco" shown to Marco himself | Cosmetic; settle in the story. |
| F-105 | low | Three tabs from three worktrees with similar titles | Polish; the context header already tells asks apart. |
