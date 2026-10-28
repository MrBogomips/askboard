---
title: AskBoard PRD change requests from the UX run
source_run: ux-askboard-2026-10-27 (.memlog.md, entries up to 2026-10-28, run final)
target: prd-askboard-2026-10-25/ (prd.md, addendum.md) as at commit 73d5cb6, now owned by the askboard repository (docs/)
applied_with: architecture-askboard-2026-10-27/SOLUTION-DESIGN.md §11 (the architecture's PRD-CHANGE requests), in one pass in askboard
status: final
created: 2026-10-27
updated: 2026-10-28
---

# AskBoard PRD change requests from the UX run

The AskBoard PRD is final, and the architecture and the epics read it as their source. On 2026-10-27 it moved, together with the architecture, to the askboard repository, which owns it from then on. It lives under the askboard repository's `docs/` with the same folder name; agentxema_prd removed its copy on 2026-10-28 and keeps the original in git history (commit 73d5cb6).

The UX run made decisions that change **behaviour** the PRD specifies, or add behaviour it does not have. This file lists them so that they can be applied in askboard in one pass, together with the architecture's PRD-CHANGE requests (SOLUTION-DESIGN.md §11). It is an input to that pass, not a PRD edit: wording, numbering and placement are that pass's call. Every requirement ID and quotation refers to `prd-askboard-2026-10-25/prd.md` and `addendum.md` as they stood at commit 73d5cb6.

Each request names the decision (as logged in the UX `.memlog.md`), the PRD places it touches, and what the PRD needs to say. Section D lists UX-owned decisions that need no PRD change. Section E lists notes for architecture.

**AXFX contract check.** None of the requests touches what AXFX requires of AskBoard (AXFX PRD §5.10, FR-36 to FR-41). No contract-change request toward the AXFX PRD follows from them.

## A. Behaviour changes to existing requirements

| ID | Decision (UX run) | PRD places | What the PRD needs |
|---|---|---|---|
| PCR-01 | A new ask comes to the front only when the user is not working on another board of the same Claude Code session, meaning that a board of that session has focus and has had a user input in the last 60 seconds. Otherwise AskBoard does not open the new board, and the system notification and the terminal link open it (architecture change ACR-12). Across sessions the browser behaves normally (architecture AD-2: one process per session). | FR-23 | Qualify "brings its board to the front", and add a testable consequence for the busy case within a session. |
| PCR-02 | The notification shows who asked (agent or subagent, type + name), where (project, branch, worktree), the ask's title and the number of questions. | FR-23 | State the notification's content. Depends on PCR-03. |
| PCR-03 | An ask has a **title**, which labels the browser tab ("<title> · AskBoard") and the notification. The agent may write it; when it doesn't, AskBoard derives it from the first question, which keeps a plain ask cheap (NFR-1). | Glossary (Ask), FR-1 or FR-5, FR-24 | Add an optional ask title, with its default, to the ask model. FR-24's "told apart from their context headers alone" can lean on it. |
| PCR-04 | One free-text field per question serves as the FR-7 open prompt, the FR-3 "note the user adds to an answer" and the Approval "reason". "Approve with changes" requires text in it, and rejecting does not. | FR-3, FR-7, FR-11 (Approval row), FR-18 | Merge the three into one field. Define how the answer format reports it, e.g. Approval's reason is that field. |
| PCR-05 | An answer already delivered, at once or with Submit, can be changed while the ask is open. The revised answer reaches the agent marked as superseding the earlier one, and the latest answer wins. | FR-18, FR-20, FR-22 | Add answer revision and a revision marker in the answer format. |
| PCR-06 | A postpone can be undone at will. | FR-4 | Add the consequence. |
| PCR-07 | The ask state is **answered** once every non-postponed question is answered or declined (PCR-29) (and, in submitted delivery, submitted). The header shows the postponed count beside the state ("answered, 1 postponed"). | FR-24, Glossary | Define the partly answered → answered transition and the place of postponed questions in it. |
| PCR-08 | In submitted delivery, switching to immediate with answers given but not submitted asks the user to confirm sending them now. | FR-22 | Add the consequence for a mode switch with unsent answers. |
| PCR-09 | A reload (F5) is not a tab close: the same board comes back in its state. Closing the tab triggers the browser's leave-page prompt when there is unsent work, or when postponed questions are still open, since closing would lose them (UJ-2). While postponed questions remain open, the board also shows a fixed warning ("You have 1 postponed question: closing loses this ask"), since the browser's prompt cannot carry its own text. | FR-25, UJ-2 | Distinguish reload from close. The board's working state must survive a reload, which the architecture holds outside browser storage (E-2). |
| PCR-10 | A closed or discarded board, while its tab is open, stays readable, locked, with a banner explaining which. The user can take a Snapshot of a closed board, not of a discarded one (architecture AD-21 drops a discarded ask's data). | FR-6, FR-25, FR-26 | State what an ended board shows, and that Snapshots are available only while the ask is open or closed. This keeps FR-25's "discards the ask and everything the user did on it". |
| PCR-11 | If AskBoard restarts or the connection drops, the board shows "Connection lost, retrying". It resumes if the ask is still open, otherwise it shows the discarded banner. | NFR-10, FR-25 | Add the user-facing side of NFR-10. |
| PCR-12 | There is no home or index view. A bare, stale, invalid or discarded-ask URL shows a short page saying why and what to do. | FR-25 ("Reopening AskBoard"), NFR-4 | Resolve "Reopening AskBoard" and state what a refused request shows. |
| PCR-13 | The recommended option shows a "Recommended" badge and nothing is preselected. Each question offers "Accept recommended", an explicit act on that question that counts as "Answer" (PCR-34): it selects the recommended option and answers. The board offers "Select recommended": it preselects the recommended options on unanswered questions where the user has chosen nothing, never replaces a choice, and sends nothing, so each is still confirmed with "Answer" (PCR-34), or all together with Submit in submitted delivery. NFR-10 and the architecture's AD-10 hold. | FR-3, NFR-10, addendum ("not in the first version": question-card "Accept recommended", "one click for every recommended option") | Bring "Accept recommended" and the selection-only "Select recommended" into v1, and update the addendum's deferred list. |
| PCR-14 | A project-file reference opens a reading panel in the board at the referenced location, with an "Open in editor" action that opens the file at that line in the editor set in the settings. | FR-9 | Say where "opens that file at the referenced location" happens, and add the editor setting. |
| PCR-15 | A Snapshot includes the context header, the follow-up threads and the postponed questions (marked). Offline it is interactive for viewing (expand, zoom, switch views) but never answerable. The file must not contain the board's token. | FR-26, FR-27 | State the Snapshot's content and offline behaviour, and add the no-token consequence. |
| PCR-16 | The context header names who asked as type + name ("Subagent code-reviewer · Retry review"). It shows the expected answerer ("For: Marco") only when that person differs from the machine's git user. | FR-24, FR-19 | Settle extract gaps 6 and 7 in the PRD's terms. |

## B. New or extended capabilities

| ID | Decision (UX run) | PRD places | What the PRD needs |
|---|---|---|---|
| PCR-17 | **Languages and locales.** The board's UI is available in English (en-US) and Italian (it-IT) from the first release, each with its money, date and number formats. The agent sets the language per ask, passing the user's preferred language. When it passes none, the board uses the language in the configuration (project, then user), then en-US. The board has no language toggle, and AskBoard translates nothing: for another language, the agent closes the ask and opens a new one in that language. | New FR (§4.x), NFR | A requirement for the two UI languages and their locale formats, the per-ask language with its fallback, and the "new ask for a new language" rule. |
| PCR-18 | *Withdrawn.* The language-switch event and translation updates were removed by the user's decision (see PCR-17). | — | — |
| PCR-19 | *Withdrawn.* The UX-originated journey UJ-4 (a mid-board language switch) was removed together with the feature. | — | — |
| PCR-20 | **Settings panel and preferences.** Every board has a settings panel with user and project scopes. Theme, density and context placement are editable there: switching them on a board saves them as the user-level setting, and they apply at once (architecture change ACR-02). The behavioural settings (default language, asking rules per FR-30, Snapshot folder per FR-27, editor per PCR-14) are shown read-only, with the configuration file and key to edit, and they apply from the next session (AD-14). | FR-27, FR-30, new FR | Say where FR-30 rules and the FR-27 folder are set and how they are seen on the board, add persistence of presentation preferences, and say when each kind of setting takes effect. Settings live in AskBoard's configuration files, not browser storage. |
| PCR-21 | **AskUserQuestion parity.** Options carry a description. A question carries a short header chip. Options carry annotations, written by the agent and also added by the user to any option. | FR-3, FR-18 | Extend FR-3's list, and add user annotations to the answer format. |
| PCR-22 | **Layouts and board organisation.** A question with excerpts renders split, with the context column beside it, and the agent sends no layout for this. The user can move the context inline, as a board-wide default saved in settings or per question. The agent picks per ask whether areas render as tabs or as sections. It can also present an ask of two or more questions one question per view, each question filling the view, with a navigator to the next. Large boards get an outline navigator and a jump to the next open question (unanswered or postponed). A single-question board slims down: no outline, no next-open jump, no "Select recommended", and the delivery switch is hidden ("Answer" is its only primary action). | FR-2, FR-13 | Record the default split rule, the user's placement switch, the one-question-per-view presentation and the slim single-question board. FR-13's note handed the layout set to UX: point to EXPERIENCE.md for the rest. |
| PCR-23 | **Widget scope (R4 mitigation).** Widgets and molecules reached by journeys get scope beyond their FR-11 minimum:<br>• **Diff review:** split/unified view, a fix A vs fix B comparison, accept or reject per file.<br>• **Graph:** comments pinned to nodes and edges, auto-layout.<br>• **WBS with PERT:** expand and collapse, an excerpt per work package.<br>• **Gantt plan:** day, week and month zoom, the agent's original plan as a baseline, the critical path always highlighted.<br>• **Approval:** a summary of the user's changes beside the buttons.<br>• **Sales estimate review:** optional lines switched on and off, a minimum margin set by the agent with a warning below it.<br>Diff review's two alternatives arrive as two patch files under the ask's root, with the base named in the item, which AskBoard diffs itself, and the minimum margin falls back to a project default (architecture change ACR-07). Every editable widget highlights what the user changed against what the agent sent. The 15 widgets and the decision matrix outside the journeys stay at their minimum, which is also their v1 ceiling. | FR-11, FR-12, FR-15, R4 | Update FR-11's "until the UX work defines it" and R4's mitigation. Add the minimum-margin datum to the sales estimate review. Note that Gantt baselines, like the critical path, are drawn by AskBoard (NFR-6, R6). |
| PCR-24 | **Platform and accessibility.**<br>• Desktop and laptop only, with a laptop-width floor of about 1280px.<br>• Light and dark themes following the system, plus a toggle.<br>• Compact density by default, with a comfortable switch.<br>• Accessibility is best effort with a keyboard core: answering, submitting, postponing and follow-ups work from the keyboard. | NFR-7, new NFR | State the viewport floor and the keyboard core. Theme and density can stay UX-owned. |
| PCR-29 | **Decline.** The user can decline a question. It closes as declined, with an optional reason in the question's free-text field. A decline follows the delivery mode and can be revised or undone like an answer; the ask is answered once every question that is not postponed is answered or declined. The agent learns not to ask it again within its task: the declined answer carries the reason, and nothing is kept beyond the ask. | FR-4, FR-18, FR-24, addendum (question-card "skip" listed as not in v1) | Add declining beside postponing, with its own answer kind and question state, and remove "skip" from the addendum's deferred list. Architecture change ACR-08. |
| PCR-30 | **Delivery receipt.** Each delivered answer shows "sent", then "delivered to the agent" once the agent has received it. This makes R1's "interactivity is reduced, not lost" visible to the user. The receipt claims delivery only, never that the agent read the answer. | FR-21, FR-22, R1 | Add the consequence: the user can tell whether a delivered answer has reached the agent. Architecture change ACR-09. |
| PCR-31 | **Pending asks in the terminal.** The terminal notice (architecture AD-4's mod) lists each pending ask on one line: title, who asked, the number of questions still open, and the board link. | FR-23 | Add the pending-asks list to the notices. |
| PCR-32 | **Optional AskBoard-only fields.** The ask title, the agent's display name, the header chip, the declared language and the minimum margin are all optional, and AskBoard supplies defaults. This keeps a plain single-question ask within the +25% target. | NFR-1, SM-1, FR-3, FR-15 | State that every field beyond AskUserQuestion's is optional, with a default. |
| PCR-33 | **Not in v1, confirmed.** The Claude Desktop Browser pane; intercepting or redrawing AskUserQuestion's dialog and terminal diagram previews (AD-16's hook refusal stays); LaTeX annotation and LaTeX documents. | §6 Non-goals, §8.2 | Optionally record these with the other non-goals or out-of-scope items, so they aren't reopened. |
| PCR-34 | **The answer act.** Every question has an explicit "Answer" action. Choosing an option, editing a widget or writing a note only fills the draft. In immediate delivery, "Answer" sends that question's answer at once; in submitted delivery it marks the answer ready, and Submit sends every ready answer. Editing a ready question makes it not ready again. "Accept recommended" counts as "Answer" (PCR-13). "Answer" with only the free-text field filled sends it as open-prompt feedback (FR-7), and the question stays unanswered. Moving through options with the arrow keys never answers. | FR-22, FR-3, FR-7, NFR-10 | Say what makes an answer "given" in each delivery mode, so that FR-22's "as each is given" is testable. |
| PCR-25 | **Design principle.** AskBoard exists to lower the felt cognitive complexity of a problem. It may open for a single question, such as one that needs a UML diagram, and must be as effective on a simple, single-question board as on a large one. | §1 (vision) or §7 | State the principle. Optionally add a simple single-question journey or success measure, since every current journey is multi-item. |

## C. Inconsistencies to resolve in the PRD

| ID | Inconsistency | Status |
|---|---|---|
| PCR-26 | FR-4 says postponed questions stay open "until the user answers them or the agent closes them (FR-6)", but FR-6 lets the agent close only whole asks (it can mark a postponed question answered). | Open. Either FR-6 gains "close a question" or FR-4 drops "closes them". The UX run has not decided. |
| PCR-27 | FR-25's "Reopening AskBoard" implied a home view. | Resolved by PCR-12 (no home). |
| PCR-28 | FR-3's recommended option against NFR-10. | Resolved by PCR-13 (badge, no preselection, explicit accept). |

## D. UX-owned decisions that need no PRD change

These go into DESIGN.md and EXPERIENCE.md only. They are listed so the PRD run doesn't take them for gaps:
- **Visual and identity:**
  - shared AXFX family visual identity;
  - shadcn/ui (Radix + Tailwind) as the UI system;
  - layered colour and font tokens meant to be swapped later;
  - minimal motion;
  - the visual direction from Stitch.
- **Board layout:**
  - the two-row context header;
  - the sticky left outline rail;
  - the context column at about a third of the question;
  - the sticky bottom action bar with delivery mode, Submit, Snapshot and "Select recommended", where Submit is disabled in immediate delivery;
  - the question-card element order;
  - the follow-up thread inline under the question.
- **Agent-change signal (FR-6):** an inline notice on the item, also flagged in the outline and the header. That a deleted item turns read-only with "Removed by the agent" is still an assumption, and it departs from FR-6's "disappears".
- **Presentation of FR-3 features:** "Other…" is a row at the end of the options with its own field. An option preview opens below its option, one at a time.
- **"Explain" button:** sends a ready-made follow-up ("Why are you asking, and what changes with each option?"), so it uses FR-10 as it stands.
- **Component choices:** atoms, layouts, the component per widget and the form library are in EXPERIENCE.md and `.working/technical-choices-proposal.md`. They bind the architecture's renderer spike, not the PRD.
- **Audience:** the run's "internal" stakes set the polish level only. The PRD's audience is unchanged.

## E. Notes for architecture (not PRD wording)

- **E-1. Open in editor:** AskBoard launches a local process on a board click. Only an explicit user click may do it. The command comes from the settings, never from agent content (NFR-5).
- **E-2. Working state:** the board's state survives a reload, and preferences persist, without browser storage. AskBoard holds both.
- **E-3. UI system:** shadcn/ui narrows Open Question 4 for the board chrome. Widget components stay open.
- **E-4. Fonts:** fonts and icons must be bundled under open licences (NFR-9, offline Snapshots).
- **E-5. Delivery path (R1):** answer revisions, declines and "question reopened" events travel on the same agent-bound path as follow-ups.
