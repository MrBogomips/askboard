---
title: "Inputs reconciled: research vs the draft UX spines"
run: ux-askboard-2026-10-27
step: bmad-ux Finalize, "Inputs reconciled" (surface dropped qualitative ideas)
inputs:
  - DESIGN.md and EXPERIENCE.md (draft spines)
  - .memlog.md (canonical, read through L145; later entries override earlier ones and the spines)
  - extract-visual-companion.md (§4 patterns by widget family, §4.9 anti-patterns, §5.3 D1 to D21)
  - extract-mcp-performance.md (§1 numbers, §3 constraints C1 to C42, §5 open questions)
  - checked where the extracts left a point open - prd-askboard-2026-10-25/prd.md (FR-3, FR-11, SM-1, SM-C2, R5), addendum.md ("Plannotator features not matched"), architecture/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md (AD-4 to AD-10, AD-17, AD-20, Conventions)
created: 2026-10-27
status: findings only. No spine, memlog, PRD or architecture file was edited.
---

# Inputs reconciled: research vs the draft UX spines

## Reading notes

- **Citation keys.**
  - `Lnn` is line nn of this run's `.memlog.md`.
  - `EXP §x` and `DES §x` are sections of `EXPERIENCE.md` and `DESIGN.md`.
  - `VC §x` is a section of `extract-visual-companion.md`.
  - `PERF Cn` is constraint n in `extract-mcp-performance.md` §3, and `PERF §x` a section of it.
  - `AD-n` is a decision of the AskBoard `ARCHITECTURE-SPINE.md`.
  - `PCR-n` and `ACR-n` are rows of `prd-change-requests.md` and `architecture-change-requests.md`.
- **Statuses.**
  - **Adopted:** the run took the idea, and the spines or the memlog say where.
  - **Adopted in part:** the core of the idea is in; a named part is not.
  - **Rejected:** a decision excludes it.
  - **Excluded by L68:** the idea is beyond the FR-11 minimum of a widget that L68 caps at that minimum. The cap was decided for the whole class; the idea itself was never weighed.
  - **Not addressed:** no decision touches it.
- **Numbers.** Figures with a PERF citation are the research's own. Prices are for Opus 5.5 (Claude Code's default) unless noted: output $20/MTok, 5-minute cache write $5/MTok, cache read $0.20/MTok. Sonnet 5.5 is half (PERF §1.2). Latency is about 6.8 s plus 5.6 s per 1,000 output tokens (PERF §1.4). Token sizes of short fields marked **(est.)** are this reconciliation's estimates; the research did not measure them.

## 1. Summary

**45 ideas checked:** D1 to D9, plus 36 qualitative patterns from VC §4.

| Status | All | D1–D9 only |
|---|---|---|
| Adopted | 20 | 1 (D6) |
| Adopted in part | 4 | 2 (D2, D4) |
| Rejected | 5 | 2 (D1, D9) |
| Excluded by L68 | 3 | 1 (D5) |
| Not addressed | 13 | 3 (D3, D7, D8) |

- **D3, D7 and D8 are confirmed open.** L21 raised them, no later entry closes them, and EXP Open Items 26 lists them.
- **D8 has moved under the UX.** The architecture now ships a mod as the push transport (AD-4). The mod adds "the list of pending asks" to the terminal notice (ARCHITECTURE-SPINE, Conventions). That list is a user-facing surface, and no UX spec covers it.
- **No decline action.** The run never decided Plannotator's "skip" (decline to answer) or the research's "dismissed" outcome. A user who won't answer can only postpone or close the tab, and a closed tab makes the agent re-ask.
- **Biggest new agent-side costs:**
  - the translation resend of UJ-4;
  - Diff review's fix A / fix B, when both diffs are sent inline;
  - several small agent-authored fields stacked on a plain question.
- **Cost-neutral decisions.** Most UX decisions add no agent cost, because AskBoard holds or computes the data. See §6.3.

## 2. Ideas table

| # | Idea (source) | Status | Where | Note |
|---|---|---|---|---|
| D1 | Review-first ceiling per widget: "show, annotate, comment, approve, light edits" (VC §5.3, §4.1) | Rejected | L67; EXP §Widget Scope, §Inspiration "Not adopted" | Not adopted as a blanket rule. C's narrower form, FR-11's "What the user does" column as the v1 ceiling (VC §6.2 #9), is adopted for the 15 widgets and the decision matrix that have no journey (L68). Journey widgets go past review-first by decision (L69–L75). |
| D2 | Plannotator "Ask this session" as the UX reference for the clarification loop (VC §5.3, §4.3) | Adopted in part | L45; FR-10; AD-20; EXP §Question card "Follow-up thread", §Inspiration | The loop exists per question: an inline thread with its composer at the foot, the agent's reply appended, and several rounds allowed. The final addendum names Plannotator as this reference, and EXP §Inspiration repeats it. The memlog never weighs it, and L21 does not list it. There is no board-level "ask this session" outside a question; the PRD Non-Goal (only answers and follow-ups go to the session) bounds it. |
| D3 | qa-guide side pane: why the agent asks, what each option does, a recommendation; history of 20 (VC §5.3, §4.2) | Not addressed | Raised L21, never closed; EXP §Inspiration "Raised but not closed", Open Items 26 | Confirmed open. Two of its three parts come in by other routes: option descriptions (L47) say what each option does, and the Recommended badge (L61) gives the recommendation. Nothing carries "why the agent asks". A history of past asks conflicts with transient asks (FR-25). |
| D4 | Annotations anchored to diagram elements that survive re-render; sketch mode for free-form (VC §5.3, §4.4) | Adopted in part | L70 (Graph); L118 and DES §Widgets "Diagram" (golden case); AD-7 anchors | Graph comments are pinned to nodes and edges and survive re-layout. In the golden case, the Diagram annotation is pinned to the "create order" element. AD-7 anchors by node or edge ID, else by quoted label, in a W3C-modelled shape. The spines don't say whether Diagram annotations survive the user's own correction of the source ("Diagram \| Source"). Document review stays at its minimum. For sketch mode, see A1. |
| D5 | Annotatable LaTeX and LaTeX documents (VC §5.3) | Excluded by L68 | L68; EXP §Widget Scope (LaTeX is in the minimum-only list) | Never raised: L21 does not list it. LaTeX stays at FR-11's single editable expression. C's question (VC §6.2 #13: out of v1, or covered by Document review?) has no recorded answer. |
| D6 | AskUserQuestion option description, header chip and annotations (VC §5.3, §4.2) | Adopted | L47, L48, L49; PCR-21; EXP and DES §Question card | Reshaped. AskUserQuestion's annotations belong to a question and are tied to preview selections. AskBoard's belong to an option, and both the agent and the user write them (L49), which answers VC §6.1 #1. The header chip also names the question in the outline. |
| D7 | Desktop Code tab Browser pane as a window for boards (VC §5.3) | Not addressed | Raised L21, never closed; EXP §Responsive "Claude Code surface", §Inspiration, Open Items 26 | Confirmed open. The spines restate NFR-8 (CLI only) without deciding whether the pane is in or out. |
| D8 | Mod companion surfaces: a launcher, pending questions, AskUserQuestion interception and redraw, diagram preview (VC §5.3) | Not addressed | Raised L21, never closed; EXP Open Items 26 | Confirmed open in the UX. The architecture has since made a mod the default push transport (AD-4), and the mod "adds the list of pending asks" to the board-link notice (ARCHITECTURE-SPINE, Conventions, "Board link and notice"). That list is user-facing, but EXP §Surfaces and §Notices leave it out. |
| D9 | Persisting and resuming unanswered asks (VC §5.3) | Rejected | L41; FR-25; EXP §Inspiration "Not adopted"; the addendum rules out Plannotator's Inbox mode | No memlog line names D9; L41 (no home, no inbox) and FR-25 exclude it. A bounded form is kept: a reload brings the board back (L57), a dropped connection resumes within the grace period (L85, AD-21), and a closed board can still be snapshotted, though a discarded one cannot (L137). |
| S1 | An open prompt on every widget (VC §4.1) | Adopted | FR-7; L63; AD-7; EXP §Question card | One free-text field per question serves as the open prompt, the note on an answer and the Approval reason (PCR-04). |
| S2 | Topic-specific actions with typed results: re-parent, re-estimate, move a milestone, flag a dependency (VC §4.1) | Adopted | FR-11 minimum; L69–L75; EXP §Widgets | Each journey widget gets named actions. Nothing names "flag a dependency". |
| Q1 | Context first: each question carries its context and reference links (VC §4.2) | Adopted | L106, L108, L79; EXP §Context | A split view when there are excerpts, the context column and the reading panel. Still open: where the references go on a question without excerpts (EXP Open Items 12). |
| Q2 | Grouped by area (VC §4.2) | Adopted | L42, L50; FR-2; EXP §Presentations | Areas as sections or tabs, and an outline navigator with each question's state. |
| Q3 | Free-text "Other" answer, added automatically (VC §4.2) | Not addressed | EXP §Question card "Option", Open Items 10 | FR-3 requires it. Its presentation is not recorded. |
| Q4 | Note on an answer (VC §4.2) | Adopted | L63; PCR-04 | Merged into the one free-text field. |
| Q5 | Option previews: mockups, code snippets, comparisons (VC §4.2) | Not addressed | EXP Open Items 10; DES §Question card "Option previews are not mocked" | FR-3 and the Choice widget's FR-11 row require them. FR-3 already says previews are text or data, never markup, which settles C's question about HTML previews (VC §6.2 #8). Where previews show and how they behave are open. |
| Q6 | Recommended option and "Accept recommended" (VC §4.2: Plannotator, AskUserQuestionPlus, VS Code) | Adopted | L61, L109; PCR-13 | A badge only, with nothing preselected. Accepting, per question or for the whole board, is an explicit click. The run brought this into v1 although the addendum had deferred it. |
| Q7 | "Skip": decline to answer (VC §4.2, Plannotator question cards) | Not addressed | Addendum, "Not in scope for the first version" ("FR-4 only postpones"); no memlog entry | The run brought "Accept recommended" back from the same deferred list, but not "skip". Postponing is not declining. This ties to the research's "dismissed" outcome (PERF C27, C28). |
| Q8 | Large question sets and moving between questions (VC §4.2: AUQ up to 10, AskUserQuestionPlus 1–20, OpenCode navigation) | Adopted | L50, L120, L121; EXP §Question card ("5 or more") | The outline navigator, the next-unanswered jump with its count, one question per view with a navigator, and the slim single-question board. |
| Q9 | Reject with a reason (VC §4.2, AUQ) | Adopted | L74, L63 | The reason goes in the question's free-text field. Rejecting does not require it; approving with changes does. |
| Q10 | A queue across agents; an inbox by state (VC §4.2: AUQ, Plannotator) | Rejected | L41; FR-24; EXP §Inspiration "Not adopted"; the addendum rules out Inbox mode | Each ask has its own tab, told apart by its context header. |
| Q11 | Option visuals: cards, mockups, split views, pros and cons, comparisons (VC §4.2: superpowers, Lavish, AskUserQuestion previews) | Adopted in part | L106 (split view); L69, L108 (Fix A \| Fix B \| A vs B) | The split view and the A/B comparison are in. Pros and cons and option cards are not addressed, and the decision matrix stays at its minimum (L68). For previews, see Q5. |
| T1 | Per-question "ask the model first" threads (VC §4.3, gap item 3) | Adopted | L45; FR-10; AD-20; EXP §Question card | A follow-up goes at once in either delivery mode, and the reply raises no agent-change notice. |
| T2 | A live thread per comment (VC §4.3, Crit) | Rejected (indirectly) | EXP §Voice and Tone Do/Don't; DES §Do's and Don'ts | "Reply" and "Resolve" on line comments were removed as Stitch departures, keeping "Edit" on the user's own comment. That cleaned up Stitch's output; Crit's pattern itself was never weighed. |
| T3 | A one-click "Explain" or elaboration request (VC §4.3: qa-guide, AUQ) | Not addressed | — | The user can only type a follow-up. |
| A1 | A free-form sketch or ink layer on diagrams (VC §4.4: Excalidraw, perfect-freehand) | Excluded by L68 | L68, L118; EXP §Widget Scope (Diagram: "None") | Diagram has no scope beyond its FR-11 minimum. |
| A2 | Annotating documents in place: labels, redline, comment side panel (VC §4.4: Recogito, Tiptap; Plannotator "comment, redline, label") | Excluded by L68 | L68; the addendum defers "labels on annotated passages" | Document review stays at FR-11 ("comments on passages and suggests edits"), which already covers comments and redline. Labels were not revisited. |
| A3 | An editable math field (VC §4.4, MathLive) | Adopted (PRD minimum) | FR-11 LaTeX row; L68 | Kept at the minimum. |
| R1 | Approve, approve with changes or reject; approve or edit (VC §4.5) | Adopted | FR-11; L74; EXP §Widgets "Approval" | The run adds a summary of the user's board changes beside the decision buttons. |
| R2 | Accept or reject each red/green edit (VC §4.5, Nimbalyst) | Adopted | FR-11; L69 | Per line and per file. |
| R3 | Comment rounds until approved, with a diff between rounds (VC §4.5, §4.6, Crit) | Not addressed | — | Rounds happen, through follow-ups and FR-6 item changes. But the change highlight compares the user's edits only with the agent's original (L76). An agent change to an item without unsent work "shows without a reload and raises no notice" (EXP §Agent-change notice), so nothing shows what the agent changed between rounds. |
| R4 | An auto-submit timer (VC §4.5, mcp-feedback-enhanced) | Rejected | L61; AD-10; NFR-10; EXP §Interaction Primitives "Explicit acts only" | Excluded by the explicit-acts rule rather than by name. |
| R5 | Phase checkpoints, action guards, plan approval (VC §4.5: HumanLayer, Magentic-UI, the Claude Code plan dialog) | Not addressed | The addendum defers plan-mode review | Outside AskBoard's role: it opens only when an agent asks. |
| F1 | Split or unified diff view; line comments exported to the agent (VC §4.6) | Adopted | L69; FR-11; AD-7 diff anchors | — |
| F2 | Line-range selection, virtualisation, structural diff (VC §4.6: @pierre/diffs, difftastic) | Not addressed | — | These belong to the component choice, which is still pending (L144). Virtualisation bears on render time for large diffs (§5, measurement). |
| F3 | Syntax highlighting in diffs and source views (VC §4.6, Shiki) | Not addressed | DES Open Items 11 | No palette is chosen for either mode. |
| G1 | Graph auto-layout (VC §4.7, elkjs) | Adopted | L70; L109 (toolbar) | The spines don't say who lays out the graph when it first opens (§5, layouts). |
| G2 | Tree outline: drag, rename, select, expand and collapse (VC §4.7, react-arborist) | Adopted | FR-11 Tree row; L71 | — |
| G3 | An accessible tree; keyboard use inside widgets (VC §4.7, headless-tree) | Not addressed | EXP §Accessibility Floor, Open Items 20 | The keyboard core stops at the edge of the widgets. |
| G4 | Other hierarchy views: WBS chart, mind map, org chart (VC §4.7) | Not addressed | — | The WBS is a Tree (L78, an assumption). |
| E1 | WBS as a tree or grouped table with estimate, owner and status columns; re-estimating (VC §4.8) | Adopted in part | L71, L78; FR-15 | Three-point estimates, PERT roll-ups and an excerpt per work package are in. Owner and status columns are not addressed, and the WBS visual is not mocked. |
| E2 | Gantt: grid plus chart, dependencies, drag, inline editing, zoom (VC §4.8) | Adopted | FR-11; L72 | The spines don't say whether a task grid sits beside the bars. |
| E3 | Critical path, scheduling and baselines computed and drawn by AskBoard (VC §4.8: DHTMLX PRO, SVAR PRO) | Adopted | FR-12; L72, L73; L132 (`critical` token) | Drawing both in-house avoids the paid tiers' licence traps. |
| E4 | Roadmap swimlanes; kanban drag-and-drop (VC §4.8: vis-timeline, dnd-kit) | Adopted (PRD minimum) | FR-11 Timeline and Kanban rows; L68 | Kept at the minimum. |
| E5 | Show then comment: read-only rendering, then comments (VC §4.8, Mermaid) | Adopted | AD-7; FR-7; EXP §Atoms "Widget frame" | A widget inside a question always has the open prompt. |

## 3. Never-addressed ideas: what the user should decide

| # | Idea | Decision needed |
|---|---|---|
| D3 | qa-guide side pane | How "why the agent asks" reaches the user. The options are (a) an optional rationale field per question, paid in agent tokens on every ask that uses it; (b) an "Explain" quick action that sends a preset follow-up, paid only when clicked, which also covers T3; or (c) out of v1. Recommended: (b). |
| D7 | Desktop Browser pane | Is the Desktop Code tab's Browser pane a v1 window for boards, or out under NFR-8? If out, record it under EXP "Not adopted" so it stops showing as open. |
| D8 | Mod companion surfaces | Give the mod's pending-asks list, which the architecture already ships, a UX spec: its content, where it draws (status line, band or toast) and its wording. Also record whether AskUserQuestion interception and redraw, and a diagram preview in the terminal, are in or out of v1. |
| Q3 | Free-text "Other" | How "Other" appears: an "Other…" option row that opens its own field, or reuse of the question's free-text field. The latter would mix an answer with the note (L63) in one field. |
| Q5 | Option previews | Where a preview shows (inline and expandable under the option, in the context column, or side by side for comparison), and how large one may get before it should be a widget. |
| Q7 | Decline to answer ("skip") | Whether "Decline" joins v1, as "Accept recommended" did, with a typed "dismissed, do not re-ask" outcome. Without it, closing the tab is the only way out, and a closed tab makes the agent re-ask (UJ-1 edge case). |
| T3 | "Explain" request | Fold into D3 option (b), or leave elaboration to typed follow-ups. |
| R3 | Diff between rounds | Whether the board marks what the agent changed in an item since the user last saw it (for example "Updated by the agent", with the changed parts highlighted), or keeps silent in-place updates when the user has no unsent work. |
| R5 | Checkpoints and plan approval | No decision needed: outside AskBoard's role. Optionally record it as out. |
| F2 | Line-range selection, virtualisation, structural diff | No UX decision now. Make virtualisation and line-range selection criteria for the component proposal (L144) for Diff review and Tree. |
| F3 | Syntax highlighting | Choose a code palette for light and dark (already DES Open Items 11). |
| G3 | Keyboard inside widgets | Whether the keyboard core extends into the journey widgets (Diff review's per-line accept and reject, Graph editing, rescheduling a Gantt task without dragging) or stays best effort. |
| G4 | Other hierarchy views | No v1 decision needed, since the WBS is a Tree. Record it as out if wanted. |

Also unrecorded, though excluded by L68: **D5**. Record LaTeX annotation and LaTeX documents as out of v1, or as covered by Document review. That closes C's question VC §6.2 #13.

## 4. Anti-pattern checks (VC §4.9, plus the failure modes in VC §4.2)

| # | Anti-pattern | Verdict | Evidence | Residual risk |
|---|---|---|---|---|
| 1 | Scope creep: "each widget (Gantt above all) can grow into a product" | Consciously overridden, then bounded | L67 lets journey widgets go past review-first (L69–L75; the Gantt gets zoom, a baseline and an always-on critical path). L68 caps the other 16 widgets at their minimum. The change highlight is display only (L76). | EXP Open Items 24 could spread molecule-level scope (zoom, baseline, expand and collapse) to a standalone Tree, Gantt or Table. The in-house Gantt baseline (L73) adds build scope. |
| 2 | Payload in the URL | Honoured | The board link carries only the ask ID and the token (EXP §Notices). Agent text reaches the notifier as a plain, truncated argument (AD-8). | — |
| 3 | One long blocking call | Honoured (the architecture owns it) | Delivery modes, follow-ups at once, and a board that stays answerable with no timeout (EXP §Interaction Primitives). AD-4: pull is authoritative, the mod pushes. | The UX adds agent-bound event kinds on the same path (language switch L34, answer revision L51, postpone undo L142, edit choice L58), so all share R1. |
| 4 | Raw agent HTML in views | Honoured | AD-8. FR-3 makes previews text or data. DES §Widgets "Diagram": the SVG is an `<img>` from a `blob:` URL. | Option previews have no presentation yet (Q5). The spines don't say whether agent text such as descriptions, annotations and replies renders as Markdown or plain text; AD-12 keeps Markdown in one renderer. |
| 5 | Pixel-region anchoring for diagrams | Honoured in intent, at risk in the wording | L70: Graph pins survive re-layout. AD-7 anchors diagrams by node or edge ID, else by quoted label. | DES §Widgets "Diagram" says the highlight and pins come "from the generated SVG or an overlay". An overlay placed by pixel coordinates would bring pixel anchoring back. The spine should say the overlay is keyed to element IDs and recomputed on every render, including after the user corrects the source. Image annotation is pixel-based by nature, which is correct for images. |
| 6 | Whole documents in tool results | Honoured | UJ-1: "the agent receives only the changes". AD-20: one generic `changes` diff by element ID. AD-6: `fetch` returns ranges and omits excerpt text, and a result stays under 30,000 characters. **L135 removed the board state and drafts from the language event**, which would otherwise have violated this rule. | FR-11 (PRD) has the Diagram widget return the corrected source with the annotations, whereas the research names "annotated UML" as an artefact to fetch on demand (PERF C24). Small for typical PlantUML. |
| 7 | A visible licence mark (the bpmn-js watermark) | Not triggered | No BPMN widget is in the catalogue. Components are not chosen yet (L144). DES defines no product mark. | Check at component selection. |
| 8 | Heavy components (Monaco, Hypothesis) | Not addressed yet | Components are still pending (L144, SOLUTION-DESIGN §9). | DES §Typography inlines both font families into every board view and every Snapshot (AD-8, AD-9). That weight is deliberate, but it counts toward render time (§5, measurement). |
| 9 | The research's avoid list (tldraw, Bryntum, Highcharts Gantt, gantt-task-react, SwiftLaTeX, Tiptap Comments and the others) | Honoured so far | No component is chosen. L73 draws the baseline (SVAR PRO) and FR-12 the critical path (DHTMLX PRO) in-house. | Re-check against the list when L144's proposal arrives. |
| 10 | Auto-resolving after a timeout (Codex, about 60 s) | Honoured | Asks never time out. NFR-10 and AD-10: nothing becomes an answer without an explicit act. | — |
| 11 | Typed fields submitting empty content (Codex #41797) | Honoured in part | "Approve with changes" cannot be sent without text (L74). AD-10 reports untouched review content as unchanged. | The spines don't record validation states for typed input (Form, Table and Spreadsheet values). |
| 12 | A question never shown, so the call hangs (OpenCode #51856) | Honoured in part | NFR-8 refuses an ask when no board can be shown. The terminal link is the notice that always works (FR-23). Asks don't block. | An ask whose board never connects "stays waiting until the agent closes it or the session ends" (EXP §Ask Lifecycle). Neither the agent nor the user learns that the board was never opened. |

## 5. Performance checks

The research's headline: "Payload size (K1+K2) is the main lever on cost and on K3", and "A data-only contract is the decisive design choice" (PERF §2).

| Area | Constraints | Verdict | Evidence | Gap |
|---|---|---|---|---|
| What the agent sends | C1–C12 | Respected, with cost flags (§6) | AD-7 excludes HTML, CSS, script and layout geometry. Derived values come from AskBoard (FR-12, AD-13). AskBoard expands molecules (AD-9). The Gantt is linked to the WBS by item IDs, so tasks are not sent twice (L78, an assumption). AD-6 keeps per-widget schemas out of the tool definitions, and AD-6 again returns `isError` for an invalid spec before any board opens. | The fields the UX added (ask title, agent name, declared language and locale, agent option annotations, minimum margin, Diff alternatives, presentation choice; ACR-06, ACR-07) all add to K1, and a few add a small decision to K2 (CF-3 to CF-12). C5 and C6 (a plain question stays close to AskUserQuestion) are at risk when these fields stack (CF-13). |
| Layouts | C13, C14 | Respected, with one exception | The split view is chosen by whether excerpts exist, and "the agent sends no layout for this" (L106). The user sets context placement (L111, L112). The single-question board slims down by itself (L120). The baseline and the change highlight come from the agent's original, which AskBoard keeps (L72, L76). Auto-layout is AskBoard's (L70). | The agent chooses the area presentation (sections, tabs or one question per view: L42, L121), which is a small layout decision of the kind C4 says to avoid (CF-12). The spines don't say that the Graph's **initial** layout is computed by AskBoard; if the agent had to send positions, C1 would be broken. |
| Grouping and follow-ups | C15–C19 | Respected | A board shows every question, 5 or more included, with areas, an outline, a next-unanswered jump and one question per view (EXP §Question card, L50, L121). A follow-up reply is appended to the thread and never resends the item (AD-20), which meets C18. An identical re-sent ask returns the same board with no new tab and no notice (AD-6), which meets C19. | The translation resend is the exception to C18: it resends content on purpose (CF-1). |
| Incremental updates | C20, C21 | Partly respected | Item changes (FR-6, AD-6 `update`) are priced as output (C20). The board side of a dropped connection is "Connection lost, retrying" (L85). | Whether an update carries a delta or the whole item is not decided (PERF §5 Q3). That matters for large items such as a WBS or a Gantt, and for translation updates (ACR-01). It is the architecture's call; the UX should not assume a full resend. |
| Answer return | C22–C32 | Respected, with one gap | Compact changes (UJ-1, AD-20). User annotations (L49) and the one free-text field (L63) are small, input-side additions to the answer. Snapshots and `fetch` serve large artefacts on demand (C24). Boards stay answerable after a call moves to the background (C30). The header names the subagent, and a subagent's ask closes when the subagent finishes (C31, AD-10). The architecture's outcomes are `open`, `postponed`, `closed`, `discarded` and `unavailable` (AD-6). | No **dismissed** outcome: the user has no way to decline (Q7), so C28's "a user action that dismisses" has no UX. Timeouts don't exist, so the timed-out outcome is moot. Waits past the cache TTL (C32) are the architecture's, but UX decisions can trigger agent turns after long idle periods (CF-2). |
| Large-data widgets | C33–C38 | Partly respected | Excerpts are pointers that AskBoard resolves at send time (AD-12). Molecules expand on the server. The WBS excerpt per work package is in pointer form (L71). | Fix A / fix B sent inline doubles the diff the agent emits (CF-3). Whether the agent can point at data instead of emitting it is still open (PERF §5 Q4): AD-7 has pointers only for excerpts and images, not for diffs or tables. Virtualisation of large diffs and trees is unaddressed (F2). |
| Measurement, SM-C2 "whole question visible" | C39–C41; SM-3, SM-C2; FR-33 | Respected | EXP §State Patterns "Cold load": a question counts as visible only when all its items are ready, and a partial board does not count. AD-9: "ready" means async work has settled and the content has been laid out once. AD-17: in benchmark mode the view mounts every area whatever the presentation, so tabs and one question per view hide nothing from the beacon. Benchmarks run in a headless browser (AD-17), so L81's background-tab rule does not affect t3. | (1) The loading treatment is not designed yet (EXP Open Items 15); a skeleton must never count as visible. (2) In the golden case, PlantUML rendering is part of "ready", so its render time is inside t3; nothing has measured it, and the renderer spike (SOLUTION-DESIGN §10.3) should. (3) The fonts inlined into every view (DES §Typography) and unvirtualised large widgets add render time; nothing has measured that either. |

## 6. Cost flags

### 6.1 Reference points from the research

- **Price of output.** Each 1,000 output tokens the agent emits costs about **$0.02 and 5.6 s** (C35, PERF §1.4).
- **Plain-question budget.**
  - SM-1 allows a plain question **+25%** over AskUserQuestion.
  - AskUserQuestion's non-thinking output per question is a median of **377** tokens and a mean of **450** (PERF §1.1).
  - The headroom is therefore about **94 to 112 tokens** per plain question.
  - PRD R5 already puts the +25% target at risk once the tool definitions exceed about 2,100 tokens.
- **Rich-question budget.** SM-1 allows a rich question up to 2× a plain AskUserQuestion question, about **750 to 900 tokens**.
- **Cost per question.** AskBoard's contract arm costs about **$0.050** per question (PERF §1.3).
- **Cache expiry.** A turn that comes after the 5-minute cache TTL has lapsed (API key, or a subagent) rewrites the whole prefix:
  - **$28.80 per 100 questions** at a 60k context (PERF §1.3);
  - that is about **$0.29 per miss** on Opus 5.5 and $0.14 on Sonnet 5.5.
- **Agent turns.** A turn with a warm cache re-reads the context: about $0.012 at 60k.
- **Upfront surface.** From the research's figures (T = 1,500 costs $0.53 per 100 questions, T = 5,000 about $1.75), each extra 100 tokens of always-loaded definitions costs about **$0.035 per 100 questions**.

### 6.2 Flags

| # | UX decision | What it adds on the agent side | Direction and size (Opus 5.5) | Lever |
|---|---|---|---|---|
| CF-1 | **Translation resend** (L34, L93, L94, L136, ACR-01; UJ-4 step 6) | The agent resends the texts of the questions, options and excerpts in the new language | **Up; high.** For a plain 10-question board, using AskUserQuestion's per-question size as a proxy for the text (inference), the resend is about 3,800 to 4,500 output tokens. That costs about $0.075 to $0.09 of output and 28 to 32 s, plus about $0.02 of cache write and about $0.04 of re-reads at R = 50. **In all, about $0.13 to $0.16 per switch, the cost of about 3 questions.** For a plan board, the video's kit plan was 8,911 output tokens (C34), so a full text resend can reach about $0.18 and about 57 s. **Excerpts get much dearer:** a pointer costs tens of tokens, but its translation costs as much as the excerpt is long, often several times more (est.). The agent must also read the source first, because `fetch` omits excerpt text (AD-6). A translated excerpt is then agent-written text, no longer the source at its location (FR-8). Thinking for the translation turn is extra and not estimated. | Make translation a separate choice: the chrome and formats switch locally at no cost, and translating the content is offered, or limited to open questions, or done lazily per question. Keep excerpts in the source language by default. |
| CF-2 | **The language-switch event wakes the agent** (L34, L135; mod push, AD-4) | An agent turn on every switch, even when the agent then translates nothing | **Up; medium.** With a warm cache, a re-read of about $0.012 at 60k, plus about 7 s fixed per call, plus whatever the agent emits. UJ-4's user is "late and tired", which suggests a long idle stretch: past the 5-minute TTL, add about $0.29 for the prefix rewrite. That can exceed the translation itself on a small board. Since L135 the event carries only the language and the locale, so its own input is a few tokens. | Same lever as CF-1: send the event only when the user asks for the content to be translated. |
| CF-3 | **Diff review, fix A / fix B** (L69, L108, ACR-07) | Two alternative diffs instead of one, when sent inline | **Up; medium to high, depending on diff size.** About 2× the diff share of K1, at $0.02 and 5.6 s per 1,000 diff tokens. A single moderate diff can already come close to the rich-question target of about 750 to 900 tokens; two exceed it. The research does not size diffs (PERF §3.6). | Let Diff review take references (two refs, commits or worktree paths) and compute the diffs in AskBoard. That would cost tens of tokens (inference). It is PERF §5 Q4; AD-7 has no diff pointer yet. |
| CF-4 | **Ask title** (L65, L110, PCR-03, ACR-06) | About 10 to 20 tokens per ask (est.), plus a small naming decision (K2) | **Up; low.** About $0.0003 per ask. On a single-question plain ask, that is about 10 to 20% of SM-1's headroom; across a multi-question ask it spreads thin. | Make it optional, with AskBoard falling back to the first header chip or the shortened question text. |
| CF-5 | **Agent display name** (L86, ACR-06) | About 4 to 8 tokens per ask (est.) | **Up; low.** | Make it optional, defaulting to the agent type the hooks already supply (AD-5); or set it once per agent instead of per ask. |
| CF-6 | **Declared language and locale** (L29, L33, ACR-07) | About 6 to 12 tokens per ask (est.), plus a small decision | **Up; low.** | Optional. Leave it out when the content follows the settings; the settings already come after the declaration in the precedence order (L33). |
| CF-7 | **Description per option** (L47, PCR-21) | About 10 to 25 tokens per option (est.), so 20 to 100 per question | **Neutral against AskUserQuestion,** whose schema already has `description`: its measured 377 to 450 tokens per question include descriptions. Up against an option that has only a label. | Keep it optional per option, so short, obvious options don't pay for it. |
| CF-8 | **Header chip** (L47) | At most 12 characters, about 3 to 5 tokens per question (est.) | **Neutral against AskUserQuestion,** which has `header`. | It also labels the outline; give a fallback when it is left out. |
| CF-9 | **The agent's option annotations** (L49) | About 15 to 30 tokens per annotated option (est.) | **Up; low per option, medium across a large board.** AskUserQuestion has no agent-written equivalent. For example, 10 questions with 2 annotations each come to about 300 to 600 tokens: $0.006 to $0.012 and 2 to 3 s. It overlaps the option description, so an agent may write the same thing twice. | Give annotations a distinct role (a caveat or risk, for example) or merge them with descriptions; tell agents in the skills to use them sparingly. |
| CF-10 | **The user's option annotations** (L49) | They go back to the agent in the answer | **Negligible.** Input side, part of the answer (A), cached at $5/MTok and re-read at $0.20/MTok. | — |
| CF-11 | **Minimum margin** (L75, ACR-07) | One number per sales estimate, about 5 to 10 tokens (est.) | **Negligible tokens.** But the agent has to know the policy, which may cost a lookup and some thinking (not quantified). | A project-level default in the settings, so the agent sends it only to override. |
| CF-12 | **Presentation choice** (L42, L121): sections, tabs or one question per view | A short enum, about 3 to 6 tokens (est.) | **Negligible tokens; a small layout decision,** which C4 says to avoid. | Make it optional, with AskBoard choosing by default (for example by the number of areas and questions). |
| CF-13 | **The fields above, stacked on a plain single-question ask** | Title, name, language and locale, presentation and two agent annotations come to about 50 to 105 tokens (est.) | **Up; medium in total.** That is **45 to 110% of SM-1's plain headroom** of about 94 to 112 tokens, on top of the risk R5 already flags for the upfront surface. Description and chip are AskUserQuestion parity and not counted. | Make every AskBoard-only field optional with a fallback in AskBoard, and use the golden minimal call per widget (C41) to hold the floor. |
| CF-14 | **An excerpt per work package** (L71; also the PRD's UJ-2) | About 20 to 40 tokens per pointer (est.), so 400 to 800 for about 20 work packages | **Up; medium on WBS boards.** About $0.008 to $0.016 and 2 to 4.5 s. Excerpts written out by the agent would cost several times more. Required by the PRD; SM-C1 says not to cut context to save tokens. | Skills steer agents to pointers, never written-out excerpts. |
| CF-15 | **More event kinds on the agent's path:** answer revision (L51), postpone undo (L142, ACR-05), edit choice (L58) | When the mod pushes an event to an idle main conversation (`$.prompt.submit`, AD-4), each can start an agent turn | **Up; low per event.** About $0.012 of re-read at 60k with a warm cache and about 7 s fixed; about $0.29 after the TTL. These are user-driven and rare. | The architecture can batch pushes; the UX needs no change. |
| CF-16 | **New fields in the upfront surface** (ACR-06, ACR-07) | The ask-level fields (title, name, language, locale) and the option fields (description, chip, annotation) must be described in the `ask` tool's generic schema | **Up; low.** Perhaps 100 to 250 tokens of definition (est.), so about $0.03 to $0.09 per 100 questions, 1 to 2% of the contract arm's $5.02. They also count toward R5's flag at about 2,100 tokens, the research's 1,500 budget and the 4,096-character cut (C8, C9). | Keep molecule-specific fields (minimum margin, Diff alternatives) in `contract` and the skills, deferred as AD-6 already requires, never in the tool definition. |

### 6.3 Cost-neutral by design

These UX decisions add no agent tokens, because AskBoard holds or computes the data. They follow the research's lever: move rendering and derived values to the server.

- the split view decided by whether excerpts exist (L106);
- context placement (L111, L112);
- the slim single-question board (L120);
- the outline navigator and the next-unanswered jump (L50);
- the change highlight against the agent's original (L76);
- the Gantt baseline (L72);
- auto-layout (L70);
- the always-on critical path (L72);
- derived values (FR-12);
- molecule expansion (AD-9);
- "Accept recommended" and "Accept all recommended" (L61);
- follow-up replies with no resend of the item (AD-20);
- reload and resume (L57, L85);
- preferences (L138);
- the language event without drafts (L135).

## 7. Spine text superseded by the memlog (only what bears on these checks)

The spines are drafts written before L135–L143. These overrides apply above:

- **Language-switch event.** EXP §Localization (third bullet under "On a switch") and UJ-4 step 4 still send the board state and drafts with the event. **L135 replaces that:** the event carries only the language and the locale. Anti-pattern 6 and CF-2 rest on L135.
- **Snapshots of ended boards.** EXP §Board banner, §Ask Lifecycle "Ended board" and §Snapshots "Ended boards" still allow a Snapshot of a discarded board. **L137 limits it to a closed board.** D9's note rests on L137.
- **Preferences.** EXP §Preferences and Settings leaves open when a change takes effect. **L138 settles it:** presentation preferences apply at once, and behavioural settings from the next session.
- **Bring to front.** EXP §Notices "Bring to front" is narrowed by **L141** to boards of the same session.
- **Postpone undo.** In immediate delivery it now has an event of its own (**L142**, ACR-05); see CF-15.
- **Architecture conflicts.** EXP Open Items 28 is settled by L135–L143 and `architecture-change-requests.md`.
