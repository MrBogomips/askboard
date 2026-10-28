---
title: AskBoard UX, PRD-side inputs reconciled
source_run: ux-askboard-2026-10-27
step: bmad-ux Finalize, "Inputs reconciled"
inputs:
  - prd-askboard-2026-10-25/prd.md (final, as at commit 73d5cb6)
  - prd-askboard-2026-10-25/addendum.md
  - extract-axfx-contract.md (AXFX PRD §5.10, FR-36 to FR-41, at cf5ac80)
checked:
  - DESIGN.md, EXPERIENCE.md (draft, 2026-10-27)
  - .memlog.md (canonical, up to L145)
  - prd-change-requests.md (PCR-01 to PCR-28), architecture-change-requests.md (ACR-01 to ACR-07)
created: 2026-10-27
---

# AskBoard UX: PRD-side inputs reconciled

This file checks the draft spines against the AskBoard PRD, its addendum and the AXFX contract (§5.10). The memlog is canonical: where it overrides the spines, the memlog wins, and §6 lists the spine text that is out of date. No spine, memlog entry or change list was edited.

**Conventions.** `EXP:n` and `DES:n` are lines of `EXPERIENCE.md` and `DESIGN.md`. `memlog Ln` is a line of `.memlog.md`. PCR and ACR are rows of `prd-change-requests.md` and `architecture-change-requests.md`.

**Statuses.**
- **covered**: the spines meet the requirement's UX consequences. Additions recorded in a change request are named in the note.
- **departed**: the spines change a consequence the PRD states, and a change request records the change.
- **missing**: the spines give the requirement no treatment, and no change request records a departure. *Acknowledged* means the spines list the gap in their Open Items but do not treat it.
- **n/a**: the requirement has no UX consequence in the first version.

A **gap** in the note of a covered or departed row is a sub-consequence with no treatment. §2 collects the gaps.

## Summary

| Group | covered | departed | missing | n/a |
|---|---|---|---|---|
| PRD FRs (33) | 20 | 6 | 2 | 5 |
| PRD NFRs (11) | 9 | 0 | 1 | 1 |
| PRD SMs (7) | 3 | 0 | 2 | 2 |
| PRD journeys (3) | 2 | 1 | 0 | 0 |
| Addendum items tagged UX (6) | 3 | 0 | 3 | 0 |
| AXFX FR-36 to FR-41 (6) | 5 | 0 | 1 | 0 |
| **Total (66)** | **42** | **7** | **9** | **8** |

UJ-4 is UX-originated (PCR-19) and is not counted.

**Headlines.**
- The spines cover the board's behaviour well. Every departure from the PRD has a PCR, except one: the delete-on-unsent-work assumption, which has no PCR number (FR-6).
- The largest gap is the one the PRD hands to UX explicitly: the FR-13 atom and layout set, the widget components and the visual design of most widgets. memlog L144 has routed it to a proposal.
- The spines never mention the agent's cost (NFR-1, SM-1, SM-2), although several UX decisions add content the agent has to write.
- No change request contradicts AXFX §5.10.
- About twenty spine lines still carry text that memlog L135 to L143 overrode, mostly in Localization, Snapshots, Notices and Open Item 28.

## 1. Coverage table

### 1.1 PRD functional requirements

| ID | Status | Where in the spines | Note |
|---|---|---|---|
| FR-1 | covered | EXP:149 (Question card) | Every question on one board, 5 or more included, and every option shown. The token-cost consequence is not a UX matter. |
| FR-2 | covered | EXP:66-75 (Presentations), EXP:139 (Area) | Three areas show as three labelled parts, and an ask with no areas shows one group. PCR-22 extends the presentations: sections, tabs, one question per view. **Gap:** the spines don't say how areas show in the one-question-per-view presentation. |
| FR-3 | departed | EXP:151-155 (Option, Recommended badge, Accept recommended, Option annotation, Open prompt); DES:607-610 | The note on an answer merges into the open prompt (PCR-04). The recommended option gets a badge and an explicit accept (PCR-13, which resolves PCR-28). Option descriptions, a header chip and annotations are added (PCR-21). **Gap, acknowledged:** the free-text "Other" answer and option previews have no presentation (EXP:151, EXP:545; DES:607, DES:704). |
| FR-4 | covered | EXP:156 (Postpone), EXP:221, EXP:314 | A postponed question stays on the board, and the postpone reaches the agent according to the delivery mode. Undo is added (PCR-06, ACR-05). PCR-26, where FR-4 has the agent "close" a postponed question, is still open (EXP:528). |
| FR-5 | missing | EXP:324 cites FR-5 only for a resend after a discard | Nothing says what the user sees when an ask is resent under the ID of an ask that is still open (FR-5: "does not open a second board"): whether a second tab or notification appears, or the open board reacts. The other consequences are agent-facing. |
| FR-6 | departed | EXP:174 (Agent-change notice), EXP:214, EXP:222-224 | A change on unsent work raises the inline notice, flagged in the outline and the header. A closed ask shows a locked banner. An answer the agent records shows as answered. Departures: translation updates skip the change signal (PCR-18, ACR-01). Deleting an item with unsent work turns it read-only with "Removed by the agent", although FR-6 says the item "disappears". This [ASSUMPTION] is recorded only in PCR §D, with no PCR number. **Gap:** whether the board marks an answer the agent recorded is open (EXP:222). |
| FR-7 | covered | EXP:149, EXP:155 (Open prompt) | Every question shows an open prompt, and its text returns with the item ID. The same field also serves as the FR-3 note and the Approval reason (PCR-04). **Gap, acknowledged:** FR-7 says "whether or not they also answer it", but how the user sends a note without answering in immediate delivery is open (EXP:544, Open Item 9). |
| FR-8 | covered | EXP:164 (Excerpt), EXP:228 | Pointer and written excerpts are covered, and an unresolved pointer doesn't block the board. The unresolved visual is not mocked (DES:620). |
| FR-9 | covered | EXP:165-166 (Reference, Reading panel); DES:621 | One click. A project file opens in the in-board reading panel, with "Open in editor" (PCR-14, ACR-03, ACR-04). Web, GitHub and Atlassian references open in the browser. |
| FR-10 | covered | EXP:157 (Follow-up thread), EXP:426 | Inline thread, several rounds. The agent's reply is appended to the thread (AD-20), not made by changing the question's items as the PRD's assumption had it. The PRD deferred that assumption to the architecture, so no PCR is needed. **Gap:** the state between sending and the reply is not recorded (EXP:226). |
| FR-11 | departed | EXP:187-201 (Widget frame, Widgets), EXP:386-402 (Widget Scope) | All 18 widgets are placed. The widgets the journeys reach get scope beyond their minimum, and the others are capped at it (PCR-23). FR-11's Approval row "with a reason" changes: only "approve with changes" requires text, and rejecting does not (PCR-04). The Diagram returns the corrected source with the annotations (EXP:195). |
| FR-12 | covered | EXP:173 (Derived value), EXP:197, EXP:255 | Live, within the same interaction, without the agent. Gantt dates, the critical path and the baseline are drawn by AskBoard (EXP:397). |
| FR-13 | missing (acknowledged) | EXP:59-63 (split rule), EXP:579 (Open Item 27) | The split view is covered, and is automatic (PCR-22). The atom set and the rest of the layout set, which FR-13 hands to UX, are not designed. memlog L144 sends them to a subagent proposal, because the renderer spike needs them. The spines' "Atoms" sections hold UI controls, not FR-13 atoms (§4). |
| FR-14 | covered | EXP:173, EXP:231 | An error shows on the board. **Gap:** its treatment is not recorded. |
| FR-15 | covered | EXP:196-200, EXP:392-410 | The four ready-made molecules, with scope (PCR-23). Their composition is an [ASSUMPTION] (memlog L78). |
| FR-16 | n/a | — | Agent-only, and post-MVP (§8.2). |
| FR-17 | n/a | — | Post-MVP (§8.2). A user-facing export and import will need a surface later. |
| FR-18 | departed | EXP:154-155, EXP:319 | The answer format must carry the merged open-prompt field (PCR-04), a revision marker (PCR-05) and the user's option annotations (PCR-21). |
| FR-19 | covered | EXP:54, EXP:93, EXP:458 | "For: <name>" shows only when that person is not this machine's git user (PCR-16). Who answered and when travel in the answer, with no board surface needed. |
| FR-20 | n/a | — | Data contract. The change highlight (EXP:172) is its counterpart on the board. |
| FR-21 | covered | EXP:132-133 (agent state), EXP:209 | The agent's working or waiting state shows at once. **Gap:** the fallback for when answers cannot reach a working agent (FR-21 Notes, R1) has no UX. The board doesn't tell "sent to AskBoard" from "received by the agent", and a pending follow-up reply has no treatment (EXP:226). |
| FR-22 | covered | EXP:141-142, EXP:250-253 | The starting mode, switching while answering, and the immediate and submitted rules. Confirmation when switching with held answers (PCR-08). |
| FR-23 | departed | EXP:373-383 (Notices), EXP:42-43 | Bring to front gains a condition (PCR-01). The notification's content is set (PCR-02, PCR-03). The terminal link's text is open (Open Item 5). EXP:381 and EXP:424 are not yet narrowed to the same session (§6). |
| FR-24 | covered | EXP:53-56, EXP:132-133, EXP:308-316 | One tab per ask. The sticky header shows project, directory, branch and worktree, the ask state and the agent state. The ask title, the agent's display name and the postponed count are added (PCR-03, PCR-07, PCR-16, ACR-06). |
| FR-25 | departed | EXP:77-79, EXP:215, EXP:308-324 | A reload is not a close (PCR-09). An ended board stays readable and locked (PCR-10). There is no home view (PCR-12, which resolves PCR-27). Three spine lines still let the user take a Snapshot of a discarded board (§6). |
| FR-26 | covered | EXP:143, EXP:361 | The user takes a whole-board Snapshot from the bottom bar. Snapshots are now limited to open or closed boards (PCR-10, memlog L137), which the spines don't reflect yet (§6). **Gap:** the feedback after taking one is not recorded. |
| FR-27 | covered | EXP:349, EXP:359-366 | Offline, in the Snapshot folder, ignored by git by default, outlives the ask. Its content is extended (PCR-15). Not mentioned: the data embedded in the file can be read by an agent without rendering it. That is mainly the architecture's concern. |
| FR-28 | n/a | — | Installation has no board surface. |
| FR-29 | n/a | — | The skills are agent-facing. |
| FR-30 | covered | EXP:348, EXP:352 | Asking rules sit in the settings panel, and the project rule wins (PCR-20). |
| FR-31 | covered | EXP:89-113 (Voice and Tone strings) | No board string uses an AXFX term. The shared AXFX family identity (DES:391) is visual, not vocabulary. The spines state no explicit rule. |
| FR-32 | covered | EXP:75 | In benchmark mode the view mounts every area (AD-17). The report is a file, with no board UX. |
| FR-33 | covered | EXP:207 | A question counts as visible only when all its items are ready. |

### 1.2 PRD non-functional requirements

| ID | Status | Where in the spines | Note |
|---|---|---|---|
| NFR-1 | missing | — | The spines say nothing about the agent's cost, yet several UX decisions add content the agent must write: the ask title and the agent's display name (PCR-03, ACR-06), the header chip, option descriptions and annotations (PCR-21), the declared language, the minimum margin and the Diff review alternatives (ACR-07), and full translation resends (PCR-18, UJ-4). No change request weighs them against SM-1, SM-2 or R5. |
| NFR-2 | covered | EXP:384 | Each ask has its own tab, and no board shows another ask's items. |
| NFR-3 | covered | EXP:21, EXP:286 | Local machine. The devcontainer's forwarded port counts as local. |
| NFR-4 | covered | EXP:79, EXP:364 | The invalid-link page. A Snapshot holds no token. |
| NFR-5 | covered | EXP:25, EXP:165-166; DES:651 | Agent content is shown as data. The editor command comes from the settings. Only `http:` and `https:` links open. Diagrams render as an image. |
| NFR-6 | covered | EXP:28, EXP:397; DES:523 | The adoption rule. The Gantt baseline is drawn by AskBoard. The fonts are under the OFL. The icon set is open (DES:689). |
| NFR-7 | covered | EXP:285 | A viewport floor is added (PCR-24). |
| NFR-8 | covered | EXP:287, EXP:291 | CLI only. Remote hosts get `unavailable`. |
| NFR-9 | covered | EXP:262, EXP:290; DES:523 | Nothing loads from the network, and the fonts are bundled. |
| NFR-10 | covered | EXP:151-153, EXP:246-249, EXP:323 | Nothing is preselected, accepting a recommendation is always an explicit click (PCR-13), and the agent is told when an ask is discarded. The connection-lost banner is added (PCR-11). |
| NFR-11 | n/a | — | — |

### 1.3 PRD success metrics

| ID | Status | Where in the spines | Note |
|---|---|---|---|
| SM-1 | missing | — | See NFR-1. |
| SM-2 | missing | — | See NFR-1. |
| SM-3 | covered | EXP:207 | "Visible" means the whole question is ready. **Gap:** the loading treatment is not recorded. |
| SM-4 | n/a | — | Benchmark arithmetic. |
| SM-5 | covered (implicit) | EXP:157, EXP:164-166 | Excerpts, the in-board reading panel and follow-ups keep the user on the board. The spines never cite SM-5 (§3). |
| SM-C1 | n/a | — | Concerns the benchmark question set. |
| SM-C2 | covered | EXP:207 | A partial board does not count as up. |

### 1.4 PRD journeys

| ID | Status | Where in the spines | Note |
|---|---|---|---|
| UJ-1 | covered | EXP:416-433 | The steps are quoted verbatim. EXP:424 is overridden (bring to front, §6). |
| UJ-2 | covered | EXP:435-452 | The steps are quoted verbatim. In step 4, whether the board marks the answer as recorded by the agent is open. |
| UJ-3 | departed | EXP:454-466 | "Removes an optional scope line" becomes switching the line off (PCR-23, memlog L77). The Approval has no visual spec (DES:655). |
| UJ-4 | added (PCR-19), not counted | EXP:468-480 | UX-originated. Step 4 is overridden (§6). |

### 1.5 Addendum items tagged UX

Two addendum sections carry the "architecture, UX" tag: "Technical references: A2UI and Plannotator" and "Widget building blocks". They split into six items.

| ID | Item | Status | Where in the spines | Note |
|---|---|---|---|---|
| ADD-1 | A2UI as the reference for atoms and layouts | missing | — | The spines never mention A2UI. The addendum says AskBoard's atoms "closely mirror its basic catalogue", and the architecture keeps A2UI as a future preference (memlog L128). This item stands or falls with FR-13. |
| ADD-2 | Plannotator as the UX reference (question cards, "Ask this session", annotation) | covered | EXP:297 | The question card, the inline follow-up thread, comments pinned to the graph, and "Accept recommended" (PCR-13). |
| ADD-3 | Candidate components per widget | missing (acknowledged) | EXP:28, EXP:579 | The widget components and the form library are not chosen. The memlog L144 proposal is pending. |
| ADD-4 | "The visual design of the widgets is to be done with Google Stitch" | missing (acknowledged) | DES:645-657, DES:710 | Stitch covered the board and the Diagram (the golden case). Diff review, Graph and Gantt are partly specified, from the structural mock and the colour page. The rest have no visual spec: the WBS with PERT, the Approval and the sales estimate review (the climax widgets of UJ-2 and UJ-3), the decision matrix, and 14 more widgets. The Stitch variants were dropped (memlog L125). |
| ADD-5 | Component adoption rule | covered | EXP:28; DES:523 | The fonts are under the OFL. The icon set is open. |
| ADD-6 | Gantt dates and critical path computed by AskBoard | covered | EXP:197, EXP:397 | The baseline is drawn by AskBoard too (memlog L73). |

**Untagged addendum items with a UX bearing** (not counted):
- **"Accept recommended" on the question card.** The addendum defers it. The UX brings it into the first version (PCR-13).
- **"Skip" on the question card, and labels on annotated passages.** Deferred by the addendum. The spines are silent, which is consistent.
- **Inbox mode.** Ruled out by the addendum. The spines agree (EXP:301).
- **"No localStorage inside views."** The spines ban browser storage altogether (EXP:261).
- **Forms based on JSON Schema** (react-jsonschema-form, JSON Forms). The form library is not chosen (EXP:579).

### 1.6 AXFX contract (AXFX PRD §5.10)

| ID | Status | Where in the spines | Note |
|---|---|---|---|
| FR-36 | covered | through FR-1, FR-2 and FR-3 | No limit on the number of questions or options, and questions grouped by area. AskUserQuestion parity is extended (PCR-21). **Gap:** the "Other" answer and option previews (as in FR-3), and areas in the one-question-per-view presentation (as in FR-2). |
| FR-37 | covered | EXP:157, EXP:164-166 | Context and references beside the question. Follow-ups before answering. |
| FR-38 | covered | EXP:155, EXP:187, EXP:392-402 | An open prompt on every question. The WBS and the Gantt come first and are in the first version with added scope. Timeline (roadmap review), Diagram (annotatable UML) and LaTeX are in the catalogue. A display-only widget has no open prompt (EXP:187). That matches the AskBoard PRD, which meets FR-38 through FR-7's open prompt on every question. |
| FR-39 | missing (acknowledged) | EXP:579 | The same gap as FR-13. |
| FR-40 | covered | EXP:196, EXP:199 | The Approval verdict and the edited WBS, with a summary of the user's changes beside the decision before it is sent. |
| FR-41 | covered | as FR-31 and NFR-3 | Independent of AXFX. The web UI serves only the local machine. |

## 2. Missing items

**Silent: no treatment and no change request.**
1. **NFR-1, SM-1, SM-2. The agent's cost of the UX additions.** Ask title, display name, header chip, option descriptions and annotations, declared language, minimum margin, Diff alternatives and translation resends all add content the agent has to write. The spines give no budget, and no change request records the trade-off.
2. **FR-5. Resending an ask that is still open.** What the user sees is not stated: no second board, and whether a second tab or notification appears.
3. **ADD-1. A2UI.** It is not named as a reference for the atom set.

**Acknowledged: listed in the spines' Open Items, with no treatment and no change request.**

4. **FR-13 and AXFX FR-39. The atom and layout set.** It blocks the renderer spike. The memlog L144 proposal is pending.
5. **ADD-3. Widget components and the form library.** The memlog L144 proposal is pending.
6. **ADD-4. The visual design of most widgets**, including the climax widgets of UJ-2 (the WBS with PERT) and UJ-3 (the Approval and the sales estimate review).

**Partial gaps in covered or departed items.**
- **FR-3 and AXFX FR-36:** the free-text "Other" answer and option previews have no presentation.
- **FR-7:** sending an open-prompt note without answering, in immediate delivery.
- **FR-21 and FR-10:** no UX for the case where answers cannot reach a working agent: no delivered or received state, and no treatment for a pending follow-up reply.
- **FR-6:**
  - the delete-on-unsent-work departure needs a numbered PCR, or must be dropped;
  - the board marker for an answer the agent recorded is open.
- **FR-2 and AXFX FR-36:** how areas show in the one-question-per-view presentation.
- **FR-8 and FR-14:** the treatments of an unresolved excerpt and of a formula error.
- **FR-26:** the feedback after the user takes a Snapshot.
- **FR-27:** the agent-readable data in the Snapshot is not mentioned.
- **SM-3:** the loading treatment.

## 3. Qualitative ideas dropped or weakened

1. **Cheap asking as a selling point. Dropped.**
   - The PRD says: "Rich questions must stay cheap for the agent… The cost of the harness–AskBoard interaction is a selling point, designed in from the start" (§1, §4.9, NFR-1, R5).
   - Neither spine mentions cost.
   - UJ-4's climax makes it worse. A pointer excerpt costs the agent "almost nothing" (§4.2), but to translate one the agent has to write the excerpt out in the new language.
2. **Audience breadth. Weakened.**
   - The PRD says: "for anyone who works in Claude Code: engineers first, and also power PMs and sales people", and AskBoard is open source under MIT (§1, §2.1, NFR-6).
   - The spines frame it as "internal, for the team's own projects… little onboarding" (EXP:29, memlog L10). The look is "sober and technical", like "a documentation page" (DES:391), compact by default, with values set in monospace.
   - Nothing weighs the PM and sales users, or first-time open-source users. The choice is logged (memlog L10) but has no change request.
3. **"Interactivity is reduced, not lost". Weakened.**
   - §1 promises that "the agent receives the answers while it keeps working", and FR-21's Notes keep a reduced mode when that is impossible (R1).
   - The spines design only the full-interactivity case (§2, FR-21), although memlog L20 required that the follow-up and immediate-delivery UX hold whichever path is chosen.
4. **SM-5, "answered on the board without going back to the terminal or the sources". Kept in substance, never named.**
   - The excerpts, the in-board reading panel and the follow-ups serve it.
   - The spines' design principle, "lower the felt cognitive complexity" (memlog L116), stands in for it.
   - That principle measures the effort the user feels, whereas §1's promise is that "Understanding the problem, they answer it correctly".
5. **The PMs' and sales people's job: "its ideas and visuals end up in the offer, deck or document the agent builds" (§2.2). Weakened.**
   - The Snapshot is specified as an offline viewer that holds the header, the threads and the postponed marks (EXP:362-363).
   - Nothing treats its visuals as material for reuse, such as the theme it is captured in, or the board chrome against the content.
   - FR-27's agent-readable data is not mentioned.

**Kept:**
- the cryptic question full of acronyms and bare references, as the problem (DES:389);
- "see it and work on it rather than read about it";
- "compare it visually before I accept it" (Diff review, A vs B);
- the source one click away;
- asking never stops the agent;
- the agent sends content and data, never markup.

## 4. Glossary drift in EXPERIENCE.md

| PRD term | Spine usage | Where | Drift |
|---|---|---|---|
| Primitive (an atom or a layout the agent composes) | "Atoms" heads a table of UI controls: Button, Segmented control, Status chip, Focus ring, Widget frame | EXP:179 (also DES:635) | A clash of meaning with FR-13, at the very point where the real atom set is missing. Rename the heading, for example "Base controls". |
| Widget vs molecule | The "Widgets" table lists the four molecules (WBS with PERT, Gantt plan, Sales estimate review, Decision matrix) | EXP:189-200 (also DES:645) | The glossary keeps the two apart. Widget Scope gets it right: "Widget or molecule" (EXP:392). |
| Open prompt | The UI label is "Note to the agent", or "Note for the agent (optional)" in the golden case | EXP:101, EXP:543 | EXP:87 says the board uses the glossary's own words for what the user acts on, and this label doesn't. It is defensible, since the field also carries the FR-3 note (PCR-04), but the drift should be recorded, or the term used. |
| Agent "waiting for an answer" (FR-24) | "Agent: Waiting for your answer" | EXP:96 | Minor. |
| Unsent work (FR-6, FR-25) | "drafts", "draft record" (an architecture term) | EXP:26, EXP:333, EXP:581-582 | Mixed vocabulary. The memlog L135 override removes most of it from Localization. |
| "the user expected to answer" (FR-19) | "expected answerer" | EXP:54, EXP:93 | A new term, not in the glossary. |
| "WBS with PERT estimates" / "WBS-with-PERT molecule" (FR-15, UJ-2) | "WBS with PERT" | EXP:196, EXP:396 | Minor shortening. |

**Used verbatim:**
- ask, area, question, option, board, answer, item;
- follow-up, excerpt, reference;
- widget (outside the cases above), derived value, formula, molecule;
- asking rule, delivery mode (immediate, submitted), context header, postponed;
- Snapshot, capitalized throughout;
- the five ask states, which match FR-24.

"Plain question", "rich question", "molecule repository" and "item ID" are not used, which is fine.

**New UX terms** that are not drift, but are candidates for the PRD glossary pass: ask title, header chip, option annotation, reading panel, outline navigator, question navigator, context column, context placement, single-question board, agent-change notice, change highlight, revised answer.

## 5. AXFX contract check

No PCR or ACR contradicts AXFX FR-36 to FR-41. The claim in `prd-change-requests.md` holds: none of the requests touches what AXFX requires, and no contract-change request toward the AXFX PRD follows. Notes for the reconciliation:

- **PCR-22, one question per view.** FR-36 ("grouped by area") and FR-2 need this presentation to show each question's area, and the spines don't say how. This is a spine gap, not a contradiction.
- **PCR-05 (answer revision) and ACR-05 (question reopened by the user).** In immediate delivery, an Approval that serves as an AXFX human-gate verdict can be superseded after delivery. FR-40 asks only for structured data, so nothing is contradicted. AXFX's gate validators will still meet the revision marker: worth a note on the AXFX side, not a contract change.
- **PCR-13, "Accept all recommended".** One click answers every question that has a recommendation, a gate included if the agent marks a recommended option. Each acceptance is an explicit click, and NFR-10 holds.
- **PCR-04.** The Approval's reason is the open prompt, and a rejection needs no text. FR-40's verdict stays structured, and FR-38's open prompt is kept.
- **FR-38's "each [widget] … plus an open prompt".** A display-only widget has none (EXP:187). This matches the AskBoard PRD, which meets FR-38 through one open prompt per question (FR-7).
- **ACR-03 and ACR-04** (the framed source view, "Open in editor"). Both stay on the local machine, so FR-41's local-only NFR holds.

## 6. Spine text the memlog has since overridden

Everything in this section is in `EXPERIENCE.md`. No overridden text was found in `DESIGN.md`.

| Where | Spine text (abridged) | Overridden by | What holds now |
|---|---|---|---|
| EXP:333 (Localization) | "The event carries the language, the locale and the board state, including answers given but not yet sent… as drafts" (cites PCR-18) | memlog L135; PCR-18 as aligned (L143) | The event carries only the language and the locale. Drafts never leave the board. |
| EXP:475 (UJ-4, step 4) | "…the board state, unsent answers included as drafts" | memlog L135 | The same: language and locale only. |
| EXP:338 (Localization, Open) | "The switch conflicts with AD-20 (see Open Items)" | memlog L135, L136 | Settled. The UX yields on drafts, and translation becomes ACR-01. |
| EXP:175 (Board banner) | Closed or discarded: "…the user can still take a Snapshot" | memlog L137; PCR-10 | A Snapshot of a closed board, never of a discarded one. |
| EXP:322 (Ask Lifecycle, Ended board) | "…and the user can still take a Snapshot (L52, PCR-10)" | memlog L137; PCR-10 | The same. The citation of PCR-10 now points to the opposite rule. |
| EXP:366 (Snapshots, Ended boards) | "The user can take one while a closed or discarded board's tab is open" | memlog L137 | Closed only. |
| EXP:236 (State Patterns, Settings panel) | "When it takes effect is open." | memlog L138; ACR-02 | Presentation preferences apply at once. Behavioural settings apply from the next session. |
| EXP:353 (Persistence) | "…saves it as the user-level setting, so later boards open that way" | memlog L138; PCR-20 | Incomplete: add "applies at once", and the next-session rule for asking rules, the Snapshot folder and the editor. |
| EXP:356, EXP:565 (Open, Open Item 18) | When a change takes effect is open | memlog L138 | Decided, as above. |
| EXP:166 (Reading panel) | "How the panel relates to AD-8's source view… [is] open" | memlog L140; ACR-03 | The panel frames the token-gated source view (`frame-ancestors 'self'`). How it closes is still open. |
| EXP:381 (Notices, Bring to front) | "Only when the user is not working on another board" | memlog L141; PCR-01 | The rule holds only among boards of the same Claude Code session. Across sessions the browser behaves as usual. |
| EXP:424 (UJ-1, step 2) | "…unless Luca is working on another board" | memlog L141 | Add "of the same session". |
| EXP:156, EXP:254 (Postpone, Revisions) | Undo "at any time", with no mechanism | memlog L142; ACR-05 | Incomplete. In immediate delivery, undo sends a "question reopened by the user" event. In submitted delivery it stays local until Submit. |
| EXP:175, EXP:212, EXP:323 (Connection lost) | "Connection lost, retrying… otherwise it shows the discarded banner" | memlog L139 (wording fix) | "Connection lost, retrying" covers drops within the AD-21 grace period. After the session process exits, the board shows the ask as discarded. |
| EXP:580 (Open Item 28, heading) | Conflicts "to reconcile in askboard, with PCR and SOLUTION-DESIGN §11" | memlog L134 to L143 | All nine are settled. The UX yielded on three (plus the reconnection wording), and the other six became ACR-01 to ACR-07. |
| EXP:581 (OI 28, Drafts) | Conflict open | memlog L135 | The UX yielded. |
| EXP:582 (OI 28, Translation resend) | Conflict open | memlog L136 | ACR-01 is requested. |
| EXP:583 (OI 28, Snapshot of a discarded board) | Conflict open | memlog L137 | The UX yielded. |
| EXP:584 (OI 28, Preferences) | Conflict open | memlog L138 | ACR-02 is requested. |
| EXP:585 (OI 28, Reading panel) | Conflict open | memlog L140 | ACR-03 is requested. |
| EXP:586 (OI 28, "Open in editor": "No AD covers it") | Conflict open | memlog L139 | ACR-04 is requested. |
| EXP:587 (OI 28, Bring to front) | Conflict open | memlog L141 | The UX yielded and narrowed the rule. |
| EXP:588 (OI 28, Postpone undo) | Conflict open | memlog L142 | ACR-05 is requested. |
| EXP:589 (OI 28, Contract fields) | "…fields that AD-7 does not list yet" | memlog L139 | ACR-06 and ACR-07 are requested. |
| EXP:4-10, EXP:17 (front matter, Citations) | Sources and citations name `prd-change-requests.md` only | memlog L143 | `architecture-change-requests.md` exists, but no ACR ID appears anywhere in either spine. Add it to the sources and the citation key. |
