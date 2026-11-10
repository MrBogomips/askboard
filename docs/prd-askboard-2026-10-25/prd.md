---
title: "PRD: AskBoard"
status: final
created: 2026-10-25
updated: 2026-11-10
---

# PRD: AskBoard

## 0. Document Purpose

This PRD defines what AskBoard must do in its first version and later. It is written for the product owner and for the UX, architecture and epic work that follows; the board's visual design and behaviour are in `ux-askboard-2026-10-27/` (DESIGN.md, EXPERIENCE.md). Terms are defined in the Glossary (§3); assumptions are tagged inline and listed in §11. Technical material that informs the architecture lives in `addendum.md`; the research behind this PRD is in `research-mcp-performance.md` and the `extract-*.md` files of this folder.

AskBoard is a standalone product of the AXFX family. The AXFX PRD (`prd-agentxema-2026-10-21/prd.md`, §5.10) states what AXFX requires of AskBoard, and this PRD meets those requirements and goes beyond them: FR-36 is met by FR-1 to FR-3; FR-37 by FR-8 to FR-10; FR-38 by FR-7, FR-11 and FR-15; FR-39 by FR-13 to FR-15; FR-40 by FR-18 to FR-20; FR-41 by FR-31 and the local-only requirement of §5. The cross-cutting NFRs that the AXFX PRD (§6) applies to every product of the family (licence, platforms, no telemetry, fail closed, standards) are met by NFR-6, NFR-7 and NFR-9 to NFR-11; its constraints on local web UIs and on Claude Code only (§7) are met by NFR-3 and NFR-8.

## 1. Vision

AskBoard turns the questions a Claude Code agent asks into visual, context-rich decisions. Today an agent asks through AskUserQuestion: a flat list of short text options, cryptic and full of acronyms and bare references such as D-01, FR-666 or §5.3, which the user has to look up before they can choose. With AskBoard, a complicated question opens in a browser on the user's own machine, laid out visually. The context the question needs sits beside it as an excerpt, with the source one click away, and interactive visual tools help the user understand the problem: a diagram they can correct, a Gantt chart, a WBS with estimates, a visual diff. Understanding the problem, they answer it correctly, and the agent gets back a typed answer it can act on.

AskBoard exists to lower the cognitive complexity of a problem as the user feels it. It may open for a single question, such as one that needs a UML diagram, and it must be as effective on a simple single-question board as on a large one.

AskBoard is for anyone who works in Claude Code and has to make the decisions an agent asks for: engineers first, and also power PMs and sales people who prefer Claude Code as their working environment. It works in any Claude Code project on its own. The AXFX family uses it, but it depends on nothing in AXFX.

Rich questions must stay cheap for the agent. The agent sends content and data, never markup; AskBoard renders them. The cost of the harness–AskBoard interaction is a selling point, designed in from the start and measured by the product's headline KPIs (§7).

Interactivity sets AskBoard apart from AskUserQuestion: the user works on the question itself, asks the agent follow-ups, and the agent receives the answers while it keeps working.

Why now: the need is present today, and proofs of concept have already shown how much value a tool like AskBoard brings.

## 2. Target Users

### 2.1 Users

All three work in Claude Code on their own machine and answer the questions its agents ask.

- **Engineers** build and change software with Claude Code agents and answer their design, plan and change questions.
- **Power PMs** plan and estimate PRDs and SOWs with Claude Code.
- **Power sales people** review estimates and prepare offers with Claude Code.

### 2.2 Jobs To Be Done

- **All users.** When an agent asks me something, I want the context it refers to beside the question, so that I can answer without hunting for what D-01 or FR-666 means.
- **All users.** When a question is about a structure, a plan or a change, I want to see it and work on it (a diagram, a table, a Gantt chart, a diff) rather than read about it, so that I answer correctly.
- **Engineers.** When an agent proposes a fix or a change, I want to compare it visually before I accept it.
- **PMs.** When I plan and estimate a PRD or an SOW with an agent, I want to review and adjust the work breakdown and its estimates and see the resulting plan.
- **Sales people.** When I turn an estimate into an offer, I want to review and adjust the estimate (rates, margins, scope lines) before the agent prepares the offer.
- **PMs and sales people.** When I need content to share, I want what I worked on in AskBoard saved where the agent can reuse it, so that its ideas and visuals end up in the offer, deck or document the agent builds.

### 2.3 Non-Users (v1)

- **People who don't work in Claude Code.** AskBoard opens when a Claude Code agent asks a question.
- **Remote viewers and teams.** AskBoard serves only the local machine.
- **Anyone looking for a web view of the Claude Code session, or a way to send it messages.** That is CueBoard.

### 2.4 Key User Journeys

- **UJ-1. Luca reviews a fix without hunting for context.** Luca, an engineer, has an agent fixing a failing payment retry in a worktree. The agent keeps writing tests and sends an ask with two questions: which of two fixes to keep, as a Diff review with the relevant decision record beside it as an excerpt, and whether to change the retry state machine, as a Graph. A notification and a link in the terminal bring the board up; its context header shows the project, the branch, the worktree and that the agent is still working. Luca writes a follow-up asking why the second fix touches the queue, and the agent's reply appears beside the question. Luca accepts one change, rejects another, removes a transition from the state machine and answers; in immediate delivery the agent receives only the changes and carries on. **Edge case:** Luca closes the tab by mistake; the agent is told the ask was discarded and sends it again. (FR-1, FR-8, FR-10, FR-11, FR-20, FR-21, FR-23 to FR-25)
- **UJ-2. Sara estimates an SOW on a WBS and a Gantt chart.** Sara, a power PM, asks an agent to plan an SOW from a PRD. The agent sends an ask with the WBS-with-PERT molecule linked to a Gantt plan, each work package showing an excerpt of the PRD feature it covers. Sara splits a package and adjusts three-point estimates; totals and spreads roll up, and the Gantt dates and critical path move as Sara edits, without the agent. Sara, still waiting for a colleague, postpones the question about an external integration and submits the rest. Later Sara gives the integration answer in the Claude Code terminal, and the agent marks the postponed question as answered. Sara then has the agent take a Snapshot of the plan for the client deck. **Edge case:** while the integration question is postponed, the board warns Sara that closing its tab would lose the ask; a reload brings the board back as Sara left it. (FR-4, FR-6, FR-8, FR-12, FR-15, FR-22, FR-25, FR-26)
- **UJ-3. Marco turns an estimate into an offer.** Marco, a sales person, asks an agent to prepare an offer from the SOW estimate. The agent sends the sales-estimate-review molecule (roles, effort, rates and margin, with totals computed by AskBoard, and an Approval at the end), naming Marco as the user expected to answer. Marco lowers a rate, removes an optional scope line, watches the margin update, and approves with changes, writing in the open prompt that the offer must show the optional line as an extra. The agent receives the changes with Marco's name and the time, takes a Snapshot of the board, and builds the offer from the Snapshot's data and visuals. (FR-7, FR-12, FR-15, FR-19, FR-26, FR-27)

## 3. Glossary

FRs, journeys and metrics use these terms exactly.

- **Agent** — A Claude Code agent, in the main conversation or a subagent, that asks questions through AskBoard. Several agents can ask at the same time.
- **User** — The person who answers an agent's questions in AskBoard: an engineer, a PM or a sales person.
- **Ask** — One request from an agent to AskBoard. It has an ask ID chosen by the agent and a title, carries one or more questions grouped in areas, and is shown on one board. The title labels the board's browser tab and the notification of the ask; the agent may write it, and otherwise AskBoard derives it from the first question (FR-1). An ask is open from the moment it is sent until the agent closes it, the subagent that sent it finishes, its board's tab is closed, or the Claude Code session that sent it ends. Reloading the board does not close its tab (FR-25).
- **Area** — A group of questions within an ask. The agent chooses the grouping (by topic, as a tab, as a section).
- **Question** — One thing an agent asks within an ask. It offers options, widgets, primitives or a molecule, in any combination.
- **Option** — A choice offered for a question.
- **Board** — The browser view where the user sees an ask and answers its questions.
- **Answer** — The user's response to a question, returned to the agent as typed data. It is given only by an explicit act of the user: "Answer" or "Accept recommended" on its question, or Submit in submitted delivery (FR-3, FR-22). Declining a question gives a declined answer (FR-4).
- **Plain question** — A question that AskUserQuestion could also ask: options only, with no widget, molecule or excerpt (§7).
- **Rich question** — A question that uses widgets, primitives, molecules or excerpts (§7).
- **Postponed question** — A question the user has chosen to answer later.
- **Declined question** — A question the user has chosen not to answer, with an optional reason. It closes as declined (FR-4).
- **Ask state** — Where an ask stands: waiting, partly answered, answered, closed or discarded. An ask is answered once every question that is not postponed is answered or declined and, in submitted delivery, submitted (FR-24).
- **Delivery mode** — How the answers on a board reach the agent: immediately, as each is given, or together when the user submits them (§4.6).
- **Context header** — The header that stays at the top of a board and names the agent that asked, its working context, and the state of the ask and of the agent (§4.6).
- **Item** — A question, or a piece of content an agent puts on a board (an excerpt, a widget, a primitive, a molecule, a block of text). Every item has an item ID.
- **Item ID** — The identifier an agent gives an item when it sends it. The agent uses it later to change, delete or answer that item.
- **Open prompt** — The one free-text field on every question, where the user gives the agent feedback on that question. It also holds the note on an answer and the reason for an Approval decision or for declining; it is returned with the answer (§4.1).
- **Follow-up** — A message the user writes on the board to ask the agent for more detail before answering a question (§4.2).
- **Excerpt** — The part of a source the question needs, shown beside it (§4.2).
- **Reference** — A link from a question to its source, opened in one click (§4.2).
- **Widget** — A ready-made interactive tool for one kind of content, such as a table, a tree or a Gantt chart. AskBoard computes its derived values (§4.3).
- **Derived value** — A value AskBoard computes from what is on the board, such as a total, a PERT estimate, a date or a score. The agent never computes it (§4.3).
- **Formula** — An expression that defines a derived value by referring to items on the board by their item IDs (§4.4).
- **Primitive** — A building block an agent composes when no widget fits: an atom (a single control or visual) or a layout (an arrangement of items on the board) (§4.4).
- **Molecule** — A composition of widgets, primitives and formulas for one use case, such as a WBS with PERT estimates linked to a Gantt chart. A molecule is either ready-made, shipped with AskBoard, or registered by an agent for reuse (§4.4).
- **Asking rule** — A setting by which the user overrides the agent's choice between AskBoard and AskUserQuestion, such as "always use AskBoard" (§4.8).
- **Molecule repository** — A GitHub repository where molecules are shared, so that other AskBoard installations can install them (§4.4).
- **Snapshot** — A self-contained HTML file of a whole board in its final state, with its data, styles and script inlined, saved in a project folder so that an agent can reuse its content and visuals to build something shareable (§4.7).

## 4. Features

**Contract at a glance.** What an agent can do with AskBoard, at capability level; the FRs below define each.
- Send an ask, with its ask ID, an item ID for every item and, optionally, its title and language, and keep working (FR-1, FR-5, FR-21, FR-34).
- Receive answers and their revisions, declines, follow-ups, open-prompt feedback and changes of state, each naming its ask and item (FR-4, FR-7, FR-10, FR-18 to FR-20, FR-22, FR-25).
- Collect the answers it needs when push delivery is not available (FR-21).
- Change, delete or answer an item, and close an ask (FR-6).
- Fetch the full result of an edited item while its ask is open (FR-20).
- Take a Snapshot of a board (FR-26).
- Register molecules and use them by name, export and import them (FR-16, FR-17; later versions).
- Run the benchmark (FR-32).

### 4.1 Asking

**Description:** An agent puts all the questions it needs in one ask, without the limits of AskUserQuestion. The user sees them on one board, answers what they can now, postpones the rest and declines what they choose not to answer.

#### FR-1: Many questions in one ask

An agent can put any number of questions, each with any number of options, in one ask. AskBoard shows all of them on one board. Every ask has a title: the agent may write it, and when it does not, AskBoard derives it from the first question.

**Consequences (testable):**
- An ask with 5 or more questions shows every question on one board.
- A question with 5 or more options shows every option.
- Sending several questions in one ask costs the agent fewer output tokens per question than sending them in separate asks (§7).
- An ask sent without a title gets one derived from its first question, and the board's browser tab and the ask's notification show it (FR-23, FR-24).

#### FR-2: Areas chosen by the agent

An agent can group the questions of an ask into areas of its choosing. AskBoard shows each area as a distinct part of the board. The agent chooses, per ask, whether the areas show as sections or as tabs, or, for an ask of two or more questions, one question per view, each question filling the view with a navigator to the others. In one question per view, each question still shows the area it belongs to.

**Consequences (testable):**
- An ask whose questions belong to 3 areas, sent as sections or as tabs, shows 3 distinct, labelled parts of the board.
- An ask without areas shows its questions as one group.
- An ask sent with areas as tabs shows one tab per area, and an ask sent with areas as sections shows them one after another.
- An ask of two or more questions sent one question per view shows one question at a time, and its navigator reaches every other question.
- In an ask with areas sent one question per view, each question shows the area it belongs to.

#### FR-3: Everything AskUserQuestion can ask

An agent can ask through AskBoard anything it can ask through AskUserQuestion: single choice, multiple choice, a free-text "Other" answer, an option marked as recommended, a description and a preview of an option, annotations on options, a short header chip that names the question, and a note the user adds to an answer. Option previews are content the agent sends as text or data, never markup. The user can add annotations of their own to any option. The note on an answer is the question's open prompt (FR-7), and the header chip is optional.

A recommended option is labelled as recommended and never selected for the user (NFR-10). The user can accept it on a question with one explicit act, "Accept recommended", which selects it and answers the question as "Answer" does (FR-22). On a board of two or more questions, "Select recommended" selects the recommended option, in one click, on every unanswered question where the user has chosen nothing. It never replaces a choice and sends nothing: the user still confirms each selection with its "Answer", or, in submitted delivery, all of them with Submit.

**Consequences (testable):**
- Each AskUserQuestion question type listed above can be expressed as an AskBoard question and returns the same information as an answer.
- Each option shows its description, and each question shows its header chip when the agent gives one.
- The user can annotate any option, and the answer returns the user's annotations with the options they belong to (FR-18).
- When a board opens, no option is selected, recommended or not.
- "Accept recommended" on a question selects its recommended option and answers the question; in immediate delivery the answer reaches the agent at once.
- "Select recommended" leaves every question where the user has chosen something, or that is answered, ready, postponed or declined, as it was, and none of its selections reaches the agent until the user confirms it with its "Answer" or, in submitted delivery, with Submit.

#### FR-4: Postponing and declining questions

The user can answer some questions of an ask, postpone others to answer them later, and decline those they choose not to answer, with an optional reason in the question's open prompt (FR-7). The agent receives the answers given so far, the postponed questions and the declined ones, and carries on. A postponed question stays open on the board until the user answers it, or until the agent marks it answered or deletes it (FR-6). A declined question closes as declined: the agent receives the decline with its reason, the shipped skills teach it not to ask that question again within its task, and nothing of the decline is kept beyond the ask. Postponing and declining follow the delivery mode (FR-22), and the user can undo either while the ask is open.

**Consequences (testable):**
- The user can mark a question as postponed without answering it.
- The user can decline a question, with or without a reason; the question then shows as declined, and the agent receives a declined answer that carries the reason (FR-18).
- The agent can tell, for each question of an ask, whether it was answered, postponed or declined.
- A postponed question is still on the board, unanswered, after the agent has received the other answers.
- The user can undo a postpone at will. When the postpone has been sent, undoing it tells the agent that the user reopened the question.
- A decline, like an answer, can be revised or undone while the ask is open; when the decline has been sent, undoing it tells the agent that the user reopened the question.

#### FR-5: Item IDs

An agent gives every ask an ask ID, and every item an item ID, of its choosing; AskBoard identifies them by those IDs in everything it returns.

**Consequences (testable):**
- Every answer, follow-up and status AskBoard returns names the item ID it refers to.
- An item ID is unique within its ask, and AskBoard scopes each ask ID to the Claude Code session that sent it, so agents in parallel sessions cannot collide.
- AskBoard rejects an item whose ID is already in use in its ask, and says why.
- An ask sent again with the ID of an ask that is still open, for example after a dropped connection, does not open a second board.
- The ID of a closed or discarded ask cannot be reused while AskBoard keeps running for that Claude Code session: AskBoard refuses it and says why, and the agent sends the ask under a new ID.
- After AskBoard restarts within the same Claude Code session, it reports every ask sent before the restart as discarded.

#### FR-6: Changing items after sending

An agent can change, delete or answer an item it sent earlier, by its item ID, as long as its ask is open (FR-25).

**Consequences (testable):**
- An agent can mark a postponed question as answered, with the answer, when the user answered it in Claude Code outside AskBoard; the board then shows it as answered.
- An agent can change the text, options or content of an unanswered item; the board shows the change without the user reloading it.
- An agent can delete an item; it disappears from the board.
- An agent can close an ask; its board then stays readable, shows that the ask is closed and accepts no more answers, and the board's link still opens it.
- When the agent changes an item on which the user has unsent work, the board signals the change, and the user either reloads the item, losing the unsent work, or ignores the update and keeps that work. The agent is told which the user chose before it receives the answer to that item.
- When the agent reopens an answered question and changes nothing else, the board starts it from the user's previous answer and says so; otherwise it says it starts from the agent's version, and the user can start from the previous answer explicitly.

#### FR-7: Open prompt

Every question offers one open prompt, where the user can give the agent feedback on the question in free text, whether or not they also answer it. The same field holds the note the user adds to an answer (FR-3), the reason for an Approval decision (FR-11) and the reason for declining the question (FR-4).

**Consequences (testable):**
- Every question on a board, whatever its options or widget, shows an open prompt.
- Text written in the open prompt reaches the agent with the question's item ID.
- The open prompt's text reaches the agent only when the user sends it: with the question's answer, or alone through "Answer", in which case the question stays unanswered (FR-22).

### 4.2 Context

**Description:** The context a question needs sits beside it, so the user never has to look up what it refers to. A pointer to a file location costs the agent almost nothing, because AskBoard shows the excerpt itself; when the context needs the model's reasoning, the agent writes the excerpt. If that is still not enough, the user asks a follow-up.

#### FR-8: Excerpts beside the question

An agent can attach excerpts to a question, either as a pointer to a source location that AskBoard resolves and shows, or as text the agent writes. The board shows each excerpt beside its question.

**Consequences (testable):**
- An excerpt given as a pointer to a project file and a location (a heading, a line range or an ID) shows the content found there, with no excerpt text in the agent's request.
- An excerpt written by the agent shows as written.
- An excerpt whose pointer cannot be resolved shows as unresolved, with the pointer, and does not block the rest of the board.

#### FR-9: References one click away

An agent can attach references to a question; the user opens each in one click. A reference can point to a project file, a web page, GitHub content (pages, pull requests and more) or Atlassian content. A project file opens in a reading panel inside the board, from which the user can open it in the editor set in AskBoard's settings (FR-35). GitHub and Atlassian references open in the user's browser, where the user is already signed in, and the agent writes their excerpts. AskBoard holds no GitHub or Atlassian credentials.

**Consequences (testable):**
- A reference to a project file opens that file at the referenced location, in a reading panel inside the board.
- From the reading panel, one click opens the file at that line in the editor set in the settings; the editor starts only on that click.
- A reference to a web, GitHub or Atlassian URL opens it in the user's browser.

**Out of Scope:**
- Searching for sources. AskBoard never looks up a bare ID such as FR-666 or a Jira key across the project or in Jira; the agent names the file, with an anchor such as a heading or an ID, or the URL.

#### FR-10: Follow-ups through the board

The user can ask the agent for more detail about a question by writing a follow-up on the board, before answering. The agent's reply appears on the board beside the question. The follow-up reaches the agent the same way answers do, and the agent's reply is appended to the question's follow-up thread; a reply never counts as a change to the question (FR-6). AskBoard never drives the Claude Code session from outside. Follow-ups reach the agent while it works, at once in either delivery mode (§4.6).

**Consequences (testable):**
- A follow-up the user writes reaches the agent, linked to the question's item ID.
- The agent's reply shows on the board in that question's follow-up thread, and the user can then answer it.
- A question can go through several follow-up rounds before it is answered.

### 4.3 Widgets

**Description:** Widgets make a question visual: the user works on the content itself rather than reading about it. AskBoard computes the derived values as the user edits, so the agent spends no tokens on them and the numbers stay consistent.

#### FR-11: Widget catalogue

AskBoard ships the following widgets. An agent can put any of them in a question.

| Family | Widget | What the user does | Derived values |
|---|---|---|---|
| Choice and input | Choice | Picks one or several options, with option previews | — |
| | Ranking | Puts items in order by dragging them | — |
| | Scale | Sets a value or a range on a slider or a rating | — |
| | Form | Fills in typed fields: text, number, money, date, list | Field checks |
| | Approval | Approves, approves with changes or rejects, with the reason in the open prompt | — |
| Text | Document review | Comments on passages and suggests edits | — |
| | Diff review | Comments on lines and accepts or rejects each change | — |
| | LaTeX | Reads and edits a mathematical expression written in LaTeX | Rendering |
| Numbers | Table | Edits a grid with typed columns | Totals, columns declared as formulas |
| | Spreadsheet | Edits cells, including cells that hold formulas | Every cell defined by a formula |
| | Chart | Reads a chart and highlights data points | — |
| Structures | Tree | Adds, moves, renames and deletes nodes, and edits node fields | Roll-ups to parent nodes |
| | Graph | Edits nodes and edges of a DAG, a dependency network or a state machine | Checks such as cycles |
| | Diagram | Annotates and corrects a Mermaid or PlantUML (UML) diagram | Rendering of the corrected source |
| Time | Gantt | Reschedules tasks by dragging, and edits durations and dependencies | Dates, critical path |
| | Timeline | Moves milestones and ranges across lanes, as in a roadmap | — |
| | Kanban | Moves cards between columns (status, priority, owner) | — |
| Media | Image annotation | Places pins, boxes and comments on a screenshot or a mockup | — |

The "What the user does" column is each widget's first-version minimum. The widgets and molecules that the journeys reach (UJ-1 to UJ-3) have this further scope in the first version:
- **Diff review:** a split or a unified view; two alternative fixes, compared one by one and against each other, which the agent gives as two patch files that apply to the project's files as they stand, and AskBoard diffs itself; accepting or rejecting a whole file at once.
- **Graph:** comments pinned to nodes and edges; a layout that AskBoard computes when the graph opens, and again when the user asks.
- **WBS with PERT (FR-15):** branches that expand and collapse; an excerpt per work package; selecting work packages and changing the optimistic, most likely or pessimistic estimates of the selection by a percentage, with a preview and an undo; dragging a work package, with its children, to a new place, by the pointer or by explicit move actions from the keyboard.
- **Gantt plan (FR-15):** day, week and month zoom; the agent's original plan shown as a baseline; the critical path highlighted, which the user can switch off; a task column whose width the user changes; the length of a task changed by resizing its bar, as a duration the user requests, which the PERT expected effort does not overwrite.
- **Approval:** a summary of the user's changes beside the decision.
- **Sales estimate review (FR-15):** optional lines switched on and off rather than deleted; a minimum margin, with a warning below it.

Every other widget, and the decision matrix, stays at its minimum, which is also its first-version ceiling, with two deliberate extensions: the Form also offers an on/off field, and the Tree and the Gantt offer on their own the editing that the WBS with PERT and the Gantt plan add to them (the selection and percentage change of number fields, dragging nodes, the critical path switch, the task column's width, and a task's requested duration). Every editable widget highlights what the user changed against what the agent sent. The details are in `ux-askboard-2026-10-27/EXPERIENCE.md` (Widget Scope, Component Patterns).

**Consequences (testable):**
- Each widget is done for the first version when the user can do what its row says, and what its further scope or extension above adds, and the answer reports it.
- Each widget in the catalogue renders from content and data alone; no widget needs HTML, CSS or script from the agent.
- Each widget returns what the user did to it as a typed answer (§4.5).
- The Diagram widget returns the corrected diagram source together with the user's annotations.
- In every editable widget, what the user changed shows apart from what the agent sent.
- An Approval answered "approve with changes" cannot be sent without a reason in the open prompt; approving or rejecting needs none.

#### FR-12: Derived values computed by AskBoard

AskBoard computes every derived value on the board and updates it as the user edits, without involving the agent. It computes all of them itself, including Gantt dates and the critical path, rather than relying on paid features of third-party components (NFR-6). For the same reason, AskBoard draws the Gantt plan's baseline of the agent's original plan itself.

**Consequences (testable):**
- When the user changes an estimate in a Tree or a Table, every total and roll-up that depends on it updates on the board within the same interaction, with no request to the agent.
- When the user moves a task in a Gantt chart, the dates of dependent tasks and the critical path update on the board.
- A Gantt plan shows the agent's original plan as a baseline under the user's edited plan, with no paid component feature.
- The answer carries the derived values as they stood when the user answered, so the agent never recomputes them. An answer to an earlier revision of its question, which the user kept over the agent's change (FR-6), carries none: the board computes them on the current revision only.

### 4.4 Primitives and molecules

**Description:** When no widget fits, the agent composes the question from primitives. Widgets, primitives and formulas combine into molecules, each serving one use case, such as estimating a PM's SOW or reviewing a sales person's offer. An agent can then reuse a molecule by name and send only data.

#### FR-13: Atoms and layouts

An agent can build a question from atoms and arrange any items on the board with layouts, when no widget fits. AskBoard organizes the board itself: a question with excerpts shows them beside it, and the agent sends no layout for this. The user can move a question's context inline, under the question, for one question or as a board-wide default saved in the settings (FR-35). A board of one question has no navigator, no "Select recommended" and no delivery mode switch, and "Answer" is its only primary action; it keeps the context header, Snapshot, postponing, declining, the open prompt and follow-ups.

**Consequences (testable):**
- A question built only from atoms and layouts renders and returns a typed answer.
- A question with at least one excerpt that resolves shows split by default (unless the user placed its context inline), with its excerpts and references beside it, although the agent's request holds no layout; a question without one takes the full width.
- The user can move the context of one question inline, and can set inline as the default, which later boards keep.
- On a board of two or more questions, the user can reach every question from a navigator and jump to the next open question, unanswered or postponed.
- A board of one question shows no navigator, no jump to the next open question, no "Select recommended" (FR-3) and no delivery mode switch, and its "Answer" sends the answer at once (FR-22); the user can still postpone or decline the question, write in its open prompt, send follow-ups and take a Snapshot.

**Notes:** The set of atoms and layouts, and how layouts organize the whole board, are designed in `ux-askboard-2026-10-27/EXPERIENCE.md` (Board anatomy, Presentations, Composition and Components).

#### FR-14: Formulas

AskBoard provides a programmable context in which a formula defines a derived value by referring to items on the board by their item IDs. AskBoard re-evaluates formulas as the user edits. Formulas are written in a declarative expression language, like spreadsheet formulas, and cannot run arbitrary code.

**Consequences (testable):**
- A formula that sums the estimate fields of a Tree's nodes updates its value when the user edits any of those fields.
- A formula can refer to items in different widgets of the same board.
- A formula that refers to a missing item ID, or that forms a cycle, is reported to the agent when the ask is sent and shows as an error on the board.

#### FR-15: Molecules, ready-made and agent-built

An agent can use ready-made molecules shipped with AskBoard, and can compose its own molecules from widgets, primitives and formulas within an ask. The ready-made molecules are the WBS with PERT estimates, the Gantt plan, the sales estimate review and the decision matrix.

**Consequences (testable):**
- A ready-made molecule renders from data alone, and the agent sends no composition.
- A WBS-with-PERT molecule computes the expected effort and its spread for every node from the user's three-point estimates.
- In a WBS-with-PERT molecule, changing the estimates of selected work packages by a percentage changes every expected effort, spread and Gantt date that depends on them within the same interaction, is previewed before it applies, can be undone once, and reaches the agent as the changed estimates only.
- A Gantt-plan molecule opens with the critical path highlighted and lets the user switch the highlighting off without changing the schedule or the answer.
- A Gantt-plan molecule lets the user set a task's duration by resizing its bar; the dependent tasks, the critical path and the plan's end move with it, and the agent receives the requested duration as a change, next to the estimates it did not touch.
- A sales-estimate-review molecule recomputes totals and margin as the user changes rates, effort or scope lines, and ends with an Approval.
- A sales-estimate-review molecule warns when the margin falls below the minimum margin, which the agent may set and which otherwise comes from the project's default; with neither, it shows no warning.
- A decision-matrix molecule recomputes each option's score as the user changes weights or ratings.

#### FR-16: Registering molecules for reuse

An agent can register a molecule it built, giving it a name; afterwards, any agent can use it by name in later asks, sending only its data.

**Consequences (testable):**
- A registered molecule is available by name in a later Claude Code session.
- Using a registered molecule by name costs the agent fewer output tokens than composing it again (§7).

#### FR-17: Exporting and sharing molecules

A user or an agent can export a molecule and import it into another AskBoard installation, and can publish molecules to, and install them from, a molecule repository on GitHub. A molecule is a declarative description of widgets, primitives and formulas. Where it needs script, for spreadsheet-like features, the script runs inside widgets bundled with AskBoard; the molecule carries no code of its own, so installing one from a repository cannot run code on the user's machine.

**Consequences (testable):**
- A molecule exported from one installation and imported into another renders and behaves the same.
- A molecule installed from a molecule repository is available by name, like a registered molecule.
- AskBoard refuses to import a molecule that contains executable code, and says why.
- Every molecule names the version of the molecule format it follows; the format follows semantic versioning, and AskBoard refuses a molecule whose format version it does not support, saying why.

### 4.5 Typed answers

**Description:** Answers are typed data in AskBoard's own format, so any framework can map them to its own terms: AXFX, for example, maps an Approval answer to a human gate's verdict. Answers stay small, because the agent re-reads them on every later turn.

#### FR-18: Answer format

AskBoard returns every answer as structured data in a documented answer format, defined per question type and per widget.

**Consequences (testable):**
- Every answer names its ask ID and item ID.
- A Choice answer lists the chosen options, with the annotations the user added to options; an Approval answer carries the decision (approve, approve with changes, reject) and the reason.
- The question's open-prompt text travels in its answer as one field, which is also the note on the answer and the reason for an Approval decision or a decline (FR-7).
- A declined question returns a declined answer, which carries the user's reason when they gave one (FR-4).
- A revised answer names the answer it replaces, and the latest answer to a question is the one that holds (FR-22).
- The answer format contains no term that belongs to AXFX or to another framework.
- The answer format follows semantic versioning, and every answer names the version it follows.

#### FR-19: Who answered and when

An agent can name, in an ask, the user expected to answer it. Every answer records who gave it and when, and whether it was given on the board or recorded by the agent (FR-6). When the agent names no one, "who" is the git user name, or, in a project with no git user name, the operating system's login name, so that the rule holds in any project (FR-31).

**Consequences (testable):**
- Every answer carries the answering user's identity and a timestamp.
- An answer recorded by the agent for a question answered in Claude Code is marked as such.
- The identity is declared, by the agent or by the machine; AskBoard does not verify it.
- In a project with no git user name, an ask that names no one gets answers whose "who" is the operating system's login name.
- The board shows the user the agent named only when that user differs from the machine's git user (FR-24).

#### FR-20: Only what changed

For a widget the user edits, the answer carries only what changed from what the agent sent, together with the derived values. The agent can fetch the full result by ask ID and item ID when it needs it. When what changed, the widgets' results and the derived values would not fit in one tool result, the answer says so and carries none of them, and the agent fetches them.

**Consequences (testable):**
- In a 200-node WBS where the user changed 3 nodes, the answer describes the 3 changes, not the 200 nodes.
- The agent can fetch the full edited structure of any answered item while its ask is open; after a revision, it fetches the latest answer's (FR-22).
- No single answer AskBoard returns exceeds Claude Code's limit on the size of a tool result.
- When the user changes every node of a 500-node WBS, the answer says that its changes are too large to carry, and the agent fetches the edited WBS and its derived values.

### 4.6 Question lifecycle

**Description:** Asking never stops the agent: it keeps working on whatever does not need the answers while the user works on the board. Several agents can ask at once, so each ask announces itself and opens in its own tab, where the context header tells the user which agent asked and where it works.

#### FR-21: Non-blocking asks

An agent can send an ask and keep working; it waits only when it needs an answer that has not arrived yet.

**Consequences (testable):**
- Sending an ask returns control to the agent at once.
- An agent can wait for the answer to a given item, and the wait ends when that answer arrives.
- An ask that stays open longer than Claude Code's limits on a waiting tool call does not fail; its answers still reach the agent.
- Where Claude Code allows it, answers and follow-ups reach the agent while it works, without the agent asking AskBoard for them. The architecture pushes them through a Claude Code mod, which reaches a running subagent too (`architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`, AD-4); the risk that the mod fails or is disabled is R1 in §9.
- Where it does not, the agent collects the answers and follow-ups when it reaches a point where it needs them.

**Notes:** The last two consequences are the first-version fallback agreed with the product owner. Without push delivery (R1), interactivity is reduced, not lost, and the board shows the user which answers have reached the agent (FR-22).

#### FR-22: Delivery mode

The user chooses, for each board, whether answers go to the agent immediately as each is given, or together when the user submits them. An answer is given only by an explicit act of the user: "Answer" or "Accept recommended" on its question (FR-3), or Submit in submitted delivery. Choosing an option, editing a widget or writing a note only prepares it. In immediate delivery, "Answer" sends the question's answer at once; in submitted delivery, it marks the answer ready, and Submit sends together every ready answer and the recommended options that "Select recommended" selected and the user left in place (FR-3). Postpones and declines follow the same mode (FR-4). While the ask is open, the user can revise an answer already sent; the revision reaches the agent as the delivery mode says, marked as replacing the earlier answer (FR-18).

**Consequences (testable):**
- In immediate delivery, an answer reaches the agent when the user gives it with "Answer" or "Accept recommended", without the user submitting anything.
- In submitted delivery, no answer reaches the agent until the user submits; then every ready answer, and the recommended options that "Select recommended" selected and the user left in place, reach it together.
- Choosing an option, editing a widget or writing a note sends nothing, and moving through the options with the arrow keys selects nothing; editing a ready question makes it not ready again.
- The user can switch the delivery mode of a board while answering.
- Switching from submitted to immediate delivery while ready answers, postpones, declines or notes are held asks the user to confirm sending them now.
- A new board of two or more questions starts in the delivery mode the agent requests, or in immediate delivery if it requests none.
- A board of one question works as in immediate delivery, whatever mode the agent requests, and has no delivery mode switch (FR-13).
- The user can revise an answer the agent has already received, in either delivery mode, and the agent receives the revision as replacing the earlier answer.
- Each answer the user has sent shows as sent, then as delivered to the agent once the agent has received it; the board never claims that the agent has read it.

#### FR-23: Notice of a new ask

When an ask arrives, AskBoard brings its board to the front in the browser and shows a system notification, and the agent's Claude Code terminal shows a link to the board. AskBoard neither opens the board nor brings it to the front while the user is working on another board of the same Claude Code session, meaning that a board of that session has focus and has had input from the user in the last 60 seconds; the terminal link then opens it, and so does the notification where the operating system lets a notification open a link (on macOS it only announces the ask). The notification names who asked, as the agent's type and name (FR-24), where it works (project, branch and worktree), the ask's title (FR-1) and its number of questions. Where AskBoard's push path runs (R1), the terminal notice also lists the pending asks.

**Consequences (testable):**
- On the user's machine, outside a container, a new ask produces all three notices, unless the user is working on another board of the same session. A subagent's ask shows its terminal link only where AskBoard's push path runs (R1); without it, the browser and system notices still appear.
- While the user is working on a board of a Claude Code session, a new ask from that session produces the notification and the terminal link, and its board neither opens nor comes to the front; a new ask from another session is not held back.
- The notification shows who asked, the project, branch and worktree, the ask's title and its number of questions.
- When Claude Code runs in a devcontainer, the link in the terminal is the notice that always works, for a subagent's ask where AskBoard's push path runs; the browser and system notices appear where the host allows them.
- The link in the terminal opens the board of that ask, and on Linux so does the notification.
- Where the push path runs, the terminal notice lists each pending ask on one line: its title, who asked, the number of questions still open and the link to its board.

#### FR-24: One tab per ask, with a context header

Each ask opens in its own browser tab, labelled with the ask's title: "<title> · AskBoard". A context header stays at the top of the board while the user scrolls; it names the agent that asked, as its type (the main agent, or a subagent and its type) and the display name the agent gives, if any, and its working context: project, directory, git branch and worktree. It names the user the agent expects to answer (FR-19) only when that user differs from the machine's git user. It also shows the state of the ask (waiting, partly answered, answered, closed, discarded) and of the agent (working, or waiting for an answer). An ask is partly answered once its first answer, postpone or decline has been sent, and answered once every question that is not postponed is answered or declined and, in submitted delivery, submitted; the header then shows how many questions are postponed or declined beside the state.

**Consequences (testable):**
- Two asks open at the same time show in two tabs, each labelled with its ask's title.
- Two asks from agents working in different worktrees of the same project can be told apart from their context headers alone.
- The context header names who asked as type and name, for example a subagent's type with the display name its agent gave, and as the type alone when the agent gave no name.
- The context header stays visible however far the user scrolls.
- When the agent starts waiting for an answer on the board, the context header shows the agent as waiting within the same interaction.
- An ask whose questions are all answered except one postponed shows as answered, with one postponed question; in submitted delivery, it shows so only after Submit.
- When the user undoes a postpone or a decline on an answered ask, the ask shows as partly answered again once the undo is sent.

#### FR-25: Transient asks

Asks are transient. Closing a board's tab, or the end of the Claude Code session that sent the ask, discards the ask and everything the user did on it; nothing is restored. A reload is not a close: the board comes back as the user left it. An ask sent by a subagent closes when that subagent finishes, once AskBoard has delivered to it every event it has not yet received. If the agent still needs the answers, it sends the ask again and the user starts fresh. Registered molecules (FR-16) and Snapshots (§4.7) are not asks and persist.

**Consequences (testable):**
- When the user closes a board's tab, the agent is told that its ask was discarded, so that it can decide whether to send the ask again; answers already delivered are unaffected.
- An answer the user has sent is kept for the agent once AskBoard has recorded it, even before the agent has received it: when an ask is discarded, the agent still receives every event of that ask it had not yet received, with the discard last.
- Reloading a board brings back the same board with the user's unsent work, and the ask stays open.
- While the board holds unsent work, or postponed questions are still open, closing its tab first raises the browser's prompt to leave the page; while postponed questions are open, the board also shows a warning that closing loses the ask.
- When the subagent that sent an ask finishes, it first receives every event of that ask it has not yet received; the ask then closes, and its board shows the ask as closed and accepts no more answers.
- When the Claude Code session that sent an ask ends, its open boards stay readable, show that the ask was discarded and accept no more answers.
- When the board loses its connection to AskBoard, it says so and keeps retrying; it resumes if the ask is still open, and otherwise shows the ask as discarded (NFR-10).
- AskBoard has no home view. Once an ask is discarded, opening its board's link shows only that the ask was discarded, with none of its content (NFR-4).

**Out of Scope:**
- Restoring a board, or work not yet sent, after its tab is closed or its session ends.

### 4.7 Snapshots

**Description:** A Snapshot carries a board's final state into other work: the offer, deck or document the agent builds and the user shares. Either the agent or the user can take one.

#### FR-26: Taking a Snapshot

An agent can take a Snapshot of a board, and the user can take one from the board, while its ask is open or closed; once the ask is discarded, no Snapshot can be taken, since AskBoard has dropped its data. A Snapshot always covers the whole board, with its context header, its follow-up threads and its postponed questions, marked as postponed.

**Consequences (testable):**
- An agent's request for a Snapshot returns the path of the saved file, not its content.
- A Snapshot the user takes from the board is saved without any request from the agent, and the agent can find it in the Snapshot folder.
- A Snapshot of a closed ask can be taken by the agent or from the board; a request for a Snapshot of a discarded ask is refused, saying that the ask was discarded.
- A Snapshot shows the context header (who asked, the working context and the ask state) as it stood when it was taken, every follow-up thread, and each postponed question marked as postponed.

#### FR-27: Self-contained HTML in the project

A Snapshot is one HTML file with the board's data, styles and script inlined, saved in a Snapshot folder in the project. The folder is `.askboard/snapshots/` by default, and the user can change it in AskBoard's configuration (FR-35). Opened offline, a Snapshot is interactive for viewing but never answerable.

**Consequences (testable):**
- A Snapshot opens in a browser with no network connection and with AskBoard not running, and shows the board in its final state.
- In an opened Snapshot, the user can expand, zoom and switch views, and nothing can be answered or sent.
- A Snapshot file contains no board token.
- The data embedded in a Snapshot can be read by an agent without rendering the page.
- A Snapshot outlives the ask it was taken from.
- The Snapshot folder is ignored by git by default; the user can choose to commit it.

### 4.8 Setup and independence

**Description:** AskBoard ships skills that teach agents when a question deserves a board. The agent keeps simple questions in AskUserQuestion and sends complicated ones to AskBoard; the user can override that choice with an asking rule.

#### FR-28: User-level or project-level installation

A user can install AskBoard at user level, so that it works in every project, or at project level, so that it works in one project.

**Consequences (testable):**
- After a user-level installation, AskBoard works in a project opened for the first time, with no further setup.
- After a project-level installation, AskBoard works in that project and in no other.
- One installation brings the MCP tools, the skills and any shipped agents together.

#### FR-29: Skills and agents that teach AskBoard

AskBoard ships skills, and agents where a task needs one of its own, that teach Claude Code agents when to use AskBoard rather than AskUserQuestion, which widget or molecule fits a question, how to build and register a molecule, and how to keep asks cheap (several questions per ask, excerpts by pointer, molecules by name).

**Consequences (testable):**
- The shipped skills define which questions go to AskBoard and which to AskUserQuestion: for example, a question with references, a widget or more than four options goes to AskBoard, and a yes/no question without references goes to AskUserQuestion.
- In a session where AskBoard is installed, with no asking rule set and no instruction from the user about how to ask, an agent follows that definition.
- An agent that follows the shipped skills puts several questions in one ask rather than sending one ask per question.
- A subagent, which cannot use AskUserQuestion, asks every question through AskBoard.
- When AskBoard refuses a subagent's ask because it cannot show a board (NFR-8), the subagent ends its turn and returns the question to the agent that started it.
- An agent that follows the shipped skills does not ask again, within the same task, a question the user declined (FR-4).
- A skill, `askboard-help`, answers the user's questions about using the board (the keys and gestures of each widget, Answer, Postpone, Snapshots, how to change a key) from the same tables the board reads, so its answers match what the board does, and never calls AskBoard's tools or opens a board.

#### FR-30: Beside AskUserQuestion, with asking rules

AskBoard does not replace AskUserQuestion. The agent in the main conversation chooses between them for each question, and the user can set an asking rule that overrides that choice; subagents, which cannot use AskUserQuestion, always use AskBoard. Asking rules can be set at user level and at project level, like the installation; the project-level rule wins. They are set in AskBoard's configuration files, and every board's settings panel shows them read-only (FR-35).

**Consequences (testable):**
- With no asking rule, both AskBoard and AskUserQuestion remain available to the agent.
- With the rule "always use AskBoard", every question the agent asks goes through AskBoard.
- With the rule "only for questions with references", a question without references goes through AskUserQuestion.

#### FR-31: Independence

AskBoard works in any Claude Code project and depends on nothing in AXFX.

**Consequences (testable):**
- AskBoard installs and works in a project that contains no AXFX file.
- Nothing in AskBoard's tools, answer format or skills requires AXFX or uses its vocabulary; the documentation may name AXFX as one of AskBoard's users.
- AXFX uses AskBoard through the same tools and answer format as any other project.

### 4.9 Performance measurement

**Description:** The cost of the harness–AskBoard interaction is a selling point (§1), so AskBoard proves it: any user can run its benchmark on their own setup and compare AskBoard with AskUserQuestion on the same questions.

#### FR-32: Shipped benchmark

AskBoard ships a benchmark that a user can run on the same set of questions for AskBoard and for AskUserQuestion. It measures the agent's output tokens per question, its thinking tokens per question and the time to put a question up, and estimates the cost of 100 questions.

**Consequences (testable):**
- Running the benchmark after installation produces a report with the three KPIs and the cost of 100 questions, for AskBoard and AskUserQuestion side by side.
- The report states the model, the effort level, the Claude Code version and the prompt-cache settings it ran with, and the user can set each of them.
- A scripted user answers every question, so the benchmark runs without anyone at the keyboard.
- The benchmark runs each case 5 times and compares medians, reporting the spread across runs as well.
- The report states the counting rules and the cost model it applies, as set out in the addendum ("Benchmark baselines, measurement protocol and cost model"), and gives the cost of 100 questions for the model and cache setting of the run.
- The question set covers plain choice questions, which AskUserQuestion can also ask, and questions with widgets, molecules and excerpts, for which the report shows AskBoard's cost alone.

#### FR-33: Time to put a question up

During a benchmark run, AskBoard records the moment each question becomes visible on its board, so that the time to put a question up can be measured from the moment the agent starts the request that asks it.

**Consequences (testable):**
- In a benchmark report, every AskBoard question has a time to put it up, measured to the moment it became visible on the board.

**Out of Scope:**
- Measuring tokens, time or cost of real asks outside the benchmark.

### 4.10 Languages and settings

**Description:** The board speaks the user's language, chosen by the agent for each ask, and every board shows AskBoard's settings. The user changes presentation preferences on the board, where they apply at once; behavioural settings live in AskBoard's configuration files and apply from the next session.

#### FR-34: Board languages

The board's interface is available in English (en-US) and Italian (it-IT) from the first release, each with its own formats for money, dates and numbers. The agent sets the language of each ask, passing the user's preferred language; when it sets none, the board uses the default language in AskBoard's configuration, the project's before the user's, and otherwise en-US. The agent may also declare the ask's formats for money, dates and numbers, en-US or it-IT, apart from its language; by default the formats follow the language. The language holds for the whole ask. The board has no language switch, and AskBoard translates nothing: for another language, the agent closes the ask and opens a new one in that language.

**Consequences (testable):**
- An ask sent in it-IT shows the board's interface in Italian, with money, dates and numbers in Italian formats; an ask sent in en-US shows them in English and US formats.
- An ask sent without a language opens in the project's configured default language, else the user's, else en-US.
- An ask sent in en-US with it-IT formats shows the interface in English and money, dates and numbers in Italian formats; an ask that declares no formats shows those of its language.
- No board offers a control that changes its language, and the agent's content shows as the agent sent it.
- When the user asks for another language, the agent closes the ask and sends a new one in that language; the old board shows the ask as closed, and its unsent work is not carried over.
- Answers carry values in the answer format's own formats whatever the ask's language; the language changes only how values are shown and typed on the board.

#### FR-35: Settings on the board

Every board has a settings panel that shows AskBoard's settings at user level and at project level. The presentation preferences (theme, density and the default placement of a question's context, FR-13) can be changed there: a change applies at once and is saved as the user-level setting, so later boards open the same way. The behavioural settings (the default language, FR-34; the asking rules, FR-30; the Snapshot folder, FR-27; the editor that opens project files, FR-9) are shown read-only, each with the configuration file and key that set it, and a change to them applies from the next Claude Code session. Settings live in AskBoard's configuration files, never in the browser's storage.

**Consequences (testable):**
- Every board gives access to a settings panel that shows the user-level and project-level settings.
- Switching the theme, the density or the default context placement on a board applies it at once and saves it as the user-level setting; a board opened later opens with it.
- The default language, the asking rules, the Snapshot folder and the editor show read-only, each with its file and key; a change made in that file applies from the next session.
- Clearing the browser's storage changes no setting.
- The user's own keys for a widget's actions are read from the user-level configuration file only, shown read-only in the settings panel, and applied to boards opened afterwards; a project-level file's keys are ignored with a warning, and a board never writes them.

**Notes:** The settings' values and defaults, and the panel itself, are designed in `ux-askboard-2026-10-27/EXPERIENCE.md` (Preferences and Settings).

## 5. Cross-Cutting NFRs

- **NFR-1. Cheap asking.** The agent's cost of asking through AskBoard stays within the targets of §7, measured by the benchmark (FR-32). The benchmark reports how much AskBoard's tools, skills and agents add to an agent's context before its first ask. The fields AskBoard adds for its own features are optional (the ask title, the agent's display name, the header chip, the language, the formats and the minimum margin), and AskBoard supplies a default for each one the agent omits: the title derived from the first question (FR-1), the agent's type in place of its name (FR-24), no header chip (FR-3), the configured language (FR-34), the formats of the ask's language (FR-34) and the project's minimum margin (FR-15). This keeps a plain single-question ask within the plain-question target of SM-1.
- **NFR-2. Parallel agents.** Several agents, in one or several Claude Code sessions, can use AskBoard at the same time. With 3 agents in 3 worktrees asking at once, every answer and follow-up reaches the agent whose ask it belongs to, and no board shows another ask's items.
- **NFR-3. Local machine only.** AskBoard listens only on the local machine; no other machine can reach it. When Claude Code runs in a devcontainer on that machine, AskBoard listens on the container's interface only when the user opts in, the port is published only to the host's loopback interface, and the board opens in the host's browser through that port; that counts as the local machine.
- **NFR-4. Nothing opens without its token.** Each board opens only through the link AskBoard gives for it, which carries a secret token, and every other AskBoard endpoint likewise refuses a request without the right token. No other web page on the same machine can read a board or answer it. A link that opens no board (without its token, stale, invalid, or the link of a discarded ask) shows a short page that says why and what to do, and no board content.
- **NFR-5. Agent content is data.** Everything an agent sends (text, data, excerpts, compositions, formulas) is shown as data and never run as code; script runs only inside the widgets bundled with AskBoard. Agent content is shown in an isolated view that cannot reach other boards or AskBoard itself. A molecule that contains code is refused (FR-17).
- **NFR-6. Licence.** AskBoard is open source under the MIT licence. Every component it adopts has a licence compatible with MIT and meets the adoption rule in the addendum (quality, GitHub stars, recent activity); AskBoard depends on no paid or licence-key feature of a component. The only licence exceptions are those the addendum lists, under the conditions it states. Among them are the LGPL runtime components that the Bun executable links unmodified, granted subject to the AXFX NFR-1 contract change: until AXFX NFR-1 admits them, AskBoard ships as the plain JavaScript bundle on Node. AskBoard's own code stays MIT, and every release also publishes the plain JavaScript bundle.
- **NFR-7. Platforms.** AskBoard runs on macOS and Linux, including Linux devcontainers and CI runners; on Windows, only through WSL.
- **NFR-8. Claude Code CLI.** The first version supports Claude Code in the CLI. When AskBoard cannot show a board, for example because no browser on the machine can reach it, it refuses the ask and says why, so that the agent can ask another way; a subagent returns the question to the agent that started it (FR-29). Claude Code running on a remote host, over SSH or in Codespaces, is outside the first version, and there AskBoard refuses every ask the same way.
- **NFR-9. No telemetry.** AskBoard sends no telemetry. Nothing leaves the user's machine except what Claude Code itself sends to its model provider; benchmark results stay on the machine.
- **NFR-10. Fail closed.** AskBoard never returns an answer the user did not give: no default, recommended or pre-filled value comes back as an answer. An answer is given only by an explicit act of the user: "Answer" or "Accept recommended" on its question, or Submit in submitted delivery (FR-3, FR-22). When AskBoard fails, restarts or discards an ask, it tells the agent, so that a missing answer is never taken as given, and the board tells the user: while its connection is lost it says so and retries, and it resumes only if the ask is still open (FR-25).
- **NFR-11. Standards.** AskBoard's MCP server follows an MCP specification version that Claude Code supports, and its skills conform to the Agent Skills specification.
- **NFR-12. Desktop board and keyboard core.** The board is built for desktop and laptop screens, down to a viewport about 1280 pixels wide; it has no tablet or phone layout. Accessibility is best effort, with a keyboard core: every action that answers, postpones or declines a question, or chooses how to handle the agent's change to an item (FR-6), works from the keyboard, and so do submitting and follow-ups. The keys a widget whose key table the board registers takes are shown in the widget, in tooltips and a keys panel, as the platform names them, and the user can change them in the user configuration file; the other widgets get them with their retrofits.

## 6. Non-Goals

AskBoard is not:
- a web shell of the Claude Code session, or a way to send the session anything but answers and follow-ups (that is CueBoard);
- a remote or team-shared web application: it serves only the user's machine;
- a replacement for AskUserQuestion: it sits beside it;
- a planning or estimation tool in its own right: its widgets serve questions, and asks are transient;
- a publishing tool: Snapshots are material for the agent to reuse, not finished deliverables;
- a source finder: it never searches for documents or issues, and holds no GitHub or Atlassian credentials;
- a usage monitor: it measures nothing outside the benchmark;
- a product for harnesses other than Claude Code, or for Claude Code surfaces other than the CLI, in its first version.

## 7. Success Metrics

*Each metric is measured by the shipped benchmark (FR-32) on the same question set for AskBoard and AskUserQuestion, for plain questions and rich questions (§3).*

**Primary**
- **SM-1. Agent output tokens per question.** Plain questions, which need none of AskBoard's optional fields (NFR-1): within +25% of AskUserQuestion. Rich questions: within 2× a plain AskUserQuestion question. Validates FR-1, FR-8, FR-11, FR-15, FR-29.
- **SM-2. Agent thinking tokens per question.** Same targets as SM-1. Validates FR-11, FR-12, FR-29.
- **SM-3. Time to put a question up.** Measured from the start of the agent's request to the question being visible on the board. Same targets as SM-1. Validates FR-21, FR-33.

**Secondary**
- **SM-4. Cost of 100 questions.** Computed by the benchmark with its stated cost model, for plain and rich questions, for the model and cache setting of the run. Same targets as SM-1. Validates FR-32.
- **SM-5. Answered on the board.** In the product owner's own use, complicated questions are answered on the board without going back to the terminal or the sources to look things up. Checked qualitatively, without telemetry (NFR-9). Validates FR-8, FR-9, FR-11, FR-15.

**Counter-metrics (do not optimize)**
- **SM-C1. Context kept.** Rich questions in the benchmark keep their excerpts and references; dropping context to save tokens defeats the product. Counterbalances SM-1.
- **SM-C2. Whole question visible.** SM-3 ends only when the whole question, with its widgets and excerpts, is visible; showing a partial board early does not count. Counterbalances SM-3.

## 8. MVP Scope

AskBoard may arrive after AXFX's Day 1, and possibly after the phase in which AXFX expects it (a contract-change request is logged for the AXFX PRD). Until it arrives, AXFX systems ask through AskUserQuestion.

### 8.1 In Scope
- Asking, context, typed answers, question lifecycle, Snapshots, setup and independence, and languages and settings (§4.10): FR-1 to FR-15, FR-18 to FR-31, FR-34, FR-35.
- The full widget catalogue (FR-11) and the four ready-made molecules (FR-15).
- A light benchmark (FR-32, FR-33): a small fixed question set, AskBoard and AskUserQuestion side by side, 5 runs per case compared on medians, the three KPIs and the cost of 100 questions, with the settings it ran with reported.

**Releases before the first version.** AskBoard is released as 0.x versions before the first version, 1.0.0, which holds the whole of §8.1. Each 0.x release ships the capabilities merged at its release time: 0.1.0 ships asking, context, typed answers, the question lifecycle with push delivery, Snapshots, languages and settings, setup and independence, the Choice, Tree, Gantt, Approval, Scale, Ranking, LaTeX, Kanban, Timeline and Chart widgets and the two ready molecules (the WBS with PERT and the Gantt plan), and any further widgets merged before it; the remaining widgets of FR-11, the other molecules of FR-15 and the light benchmark come in later 0.x releases.

### 8.2 Out of Scope for MVP
Deferred to a later version:
- Registering molecules for reuse (FR-16).
- Exporting molecules and the molecule repository on GitHub (FR-17).
- The full benchmark: settings the user can choose (part of FR-32).

Outside the first version, as confirmed in the UX work, so that they are not reopened:
- Boards in the Claude Desktop Browser pane: the first version serves the Claude Code CLI (NFR-8).
- Intercepting or redrawing AskUserQuestion's dialog, and diagram previews in the terminal. Asking rules are still enforced by refusing AskUserQuestion when a rule sends the question to AskBoard (FR-30).
- LaTeX annotation and LaTeX documents: the LaTeX widget reads and edits one expression (FR-11).

## 9. Risks

- **R1. The push path may be disabled or change.** The architecture pushes answers and follow-ups to a working agent through a Claude Code mod: mods have been on by default since Claude Code 2.1.287, and the delivery spike showed the mod reaching the main conversation and running subagents, foreground and background, in every permission mode tested (addendum). An organization can disable mods, and part of what the mod relies on is observed rather than documented: one of the push calls Claude Code offers mods is already refused under auto mode. Either takes push delivery away, and with it part of the interactivity of FR-10, FR-21 and FR-22. Mitigation: every capability also works by pull, so the agent waits for or collects the answers and follow-ups at the point it needs them, and the board shows the user which answers have reached the agent (FR-22); CI runs against the minimum, `stable` and `latest` Claude Code.
- **R2. Claude Code evolves.** It may render MCP Apps, extend AskUserQuestion, or change the limits AskBoard relies on: call timeouts, tool search, result size. Mitigation: keep the data contract independent of how a board is rendered, and track Claude Code releases; rendering inside Claude Code as an MCP App, which the CLI does not support today, would be an upside, not a prerequisite.
- **R3. Plannotator closes the gap.** The closest competitor releases daily and already has follow-up threads and question cards; Document review and Diff review overlap with it. If it adds planning widgets or MCP App delivery, AskBoard's edge narrows. Mitigation: differentiate on planning widgets, molecules, typed answers and measured cost.
- **R4. Widget scope grows.** All 18 widgets and four molecules are in the first version, and the research's "review-first" limit (show, annotate, approve, light edits) was not kept, so widgets could grow into planning tools in their own right. Mitigation: the UX work scoped each widget and molecule that the journeys (UJ-1 to UJ-3) reach to what they need, and kept every other widget and the decision matrix at its minimum, which is also its first-version ceiling (FR-11). After the product owner's tests of the Tree and the Gantt, five editing features were added to them and to the two molecules, and the list in FR-11 is the new ceiling for those widgets.
- **R5. The plain-question target is at risk.** AskBoard's tool definitions, loaded at the start of every session, and the tool search before a session's first ask add cost and time that AskUserQuestion does not pay. The research puts the +25% cost target out of reach if those definitions exceed about 2,100 tokens. No budget is set. Mitigation: run the benchmark early and act on its results.
- **R6. Component licences.** Features AskBoard needs, such as the Gantt critical path and automatic rescheduling, are paid features in the shortlisted components. Mitigation: AskBoard computes them itself (FR-12, NFR-6).

## 10. Open Questions

1. How do answers and follow-ups reach an agent while it works, including from subagents? Settled by the architecture: by pull, which always works, and by push through a Claude Code mod where it runs; the delivery spike confirms the mod (`architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`, AD-4; FR-21, R1).
2. How quickly must an answer reach a working agent to feel interactive? Settled by the product owner on 2026-10-30, from the mod delivery spike's measurements: an idle main conversation receives an answer within 2 s; a working agent, main conversation or subagent, at its next model request after the answer, plus at most the mod's poll interval. The early benchmark checks it (FR-21, FR-22).
3. Which questions make up the benchmark's fixed set, and in what mix of plain and rich questions (FR-32)?
4. Which formula language? Architecture decision, informed by the research (FR-14). The widget components are chosen in `ux-askboard-2026-10-27/EXPERIENCE.md` (Composition and Components), subject to the renderer spike (FR-11).
5. Is A2UI compatibility (an agent emitting A2UI can drive a board) a product requirement or only an architecture preference (addendum, "Technical references")?

## 11. Assumptions Index

No assumption remains open: the architecture (`architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`) settled the two this PRD held, answering Open Question 1.

- §4.2 FR-10 — Follow-ups reach the agent as events, the same way answers do, and the agent's reply is appended to the question's follow-up thread; AskBoard never drives the Claude Code session (AD-4, AD-20).
- §4.6 FR-21 — Answers and follow-ups reach a working agent by pull, which always works, and by push through a Claude Code mod where it runs (AD-4, R1).
