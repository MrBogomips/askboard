# The answering flow: UX/UI assessment (Issue #168)

Version 1.0.0, 2026-11-14. Base: `main` at `3722202d`.

Evidence tags used throughout:

- **[UI]** observed in the running UI (session process, Chromium, 1280×800, `it-IT` unless noted); screenshots in `screenshots/current/`, focus and live-region readings in `screenshots/current/observations.json`.
- **[code]** read in code, with `file:line` (paths under `packages/view/src/` unless absolute).
- **[docs]** specified in `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (EXP) or `DESIGN.md` (DES), by section and line.

How the screenshots were made: `./setup.sh`, `bun run build`, then `screenshots/capture-current.ts`, which starts the built session process through the browser-test harness (`packages/view/test/browser/harness/session.ts`), asks a nine-question board in three areas ("Architettura", "Rilascio", "Costi"; four questions with a recommendation, one question with two text fields, one required and one with a pattern) and drives it with Playwright. No agent calls `collect` in this harness, so receipts stay at "inviata" and the agent pill stays at "Agente: al lavoro"; nothing here shows "consegnata all'agente".

## 1. Current journey as built

### 1.1 Sections, immediate delivery (the default)

1. The board opens at the top. Header row 2: title, "RICHIESTA", ask pill "In attesa", agent pill, "9 aperte", "Prossima aperta ↓", then Theme, Density, Settings. Left rail "INDICE" with each question and "Senza risposta". Bottom bar: "CONSEGNA", "Immediata | Su invio", helper "Le risposte arrivano all'agente man mano che le dai.", then "Seleziona le consigliate", "Snapshot" and a disabled "Invia le risposte" [UI 01].
2. The user picks an option: the row gets the selected look, "+ Aggiungi una nota a questa opzione" appears, "Rispondi" (outline button, bottom-right of the card) enables [UI 02].
3. "Rispondi": the answer is sent at once (`card-acts.ts:359-362`). The card stays where it is. A small green dot appears before the header chip, the text "inviata" appears left of the now-disabled "Rispondi", "Rinvia" disables, the pill turns "Risposte parziali 1/9", the count "8 aperte", the outline entry "Con risposta" [UI 03]. No scroll, no move to the next question, no message. **Focus falls to `<body>`**, because the pressed button became disabled [UI observations `afterAnswerImmediateSections`; `question-state.ts:208-217` sets `canAnswer: false` on an answered card].
4. To go on, the user scrolls, clicks an outline entry, or presses "Prossima aperta ↓". That button moves focus to the next open question's heading (`board.tsx:307-312`, `useHeadingFocus` `board.tsx:241-248`) and relies on the browser's focus scrolling. In the run, the target heading was already partly inside the viewport, under the sticky bottom bar, so **nothing scrolled** (`scrollY` 0); only the outline's current bar moved [UI 04, observations `afterNextOpenSections`].
5. "Rinvia" (Postpone) sends at once, toggles pressed with a pause marker, keeps focus on the same question's heading (`question-actions.tsx:86-90`), and adds a fixed warning to the bottom bar, which wraps to two rows [UI 07].
6. When every question is answered: pill "Con risposta" (green), "0 aperte", "Prossima aperta ↓" disabled; nothing else changes: no completion message, focus on `<body>`, "Seleziona le consigliate" still enabled, "Invia le risposte" still visible and disabled [UI 24, 25].

### 1.2 Tabs, immediate

As sections, with a tab strip "Architettura 3 aperte · Rilascio 3 aperte · Costi 3 aperte" above the cards [UI 10]. The tab strip is not sticky and scrolls away with the content [UI 12]. Answering the last open question of a tab leaves the user on that tab; the count simply disappears from its label (`board.tsx:191-193`); nothing proposes the next tab [UI 12]. "Prossima aperta ↓" activates the tab that holds the target (`board.tsx:369-370`, the active tab follows `draft.inView`).

### 1.3 One question per view, immediate

The question navigator sits above the card: "Domanda 1 di 9", a strip of nine markers, "Precedente", "Successiva", separator, "Prossima aperta →" [UI 13]. **The header still shows "Prossima aperta ↓" too** (`board.tsx:424` passes the counts to the header for every presentation but the single board) [UI 14]. After "Rispondi" the view stays on the answered question by design (EXP 241: "It never advances by itself when a question is answered"); focus falls to `<body>` [UI 14, observations `afterAnswerOnePerView`]. "Prossima aperta →" then shows the next open question and focuses its heading [UI 15]. The bottom bar floats above an empty band when the card is short [UI 14].

### 1.4 Any presentation, submitted delivery ("Su invio")

1. The bottom bar shows "Immediata | **Su invio**" and **no helper text** (`bottom-bar.tsx:215-217` renders help only for immediate) [UI 16, 17]. "Invia le risposte" is the bar's primary, disabled until something is held.
2. "Rispondi" does not send: it toggles the answer "ready" (`card-acts.ts:355-357`), shows the button pressed (`aria-pressed`, pale fill, ring-dot marker inside the button), the outline says "Pronta", the count drops, **the pill stays "In attesa"** (by design: it counts only what the agent received). Focus stays on "Rispondi" [UI 18, observations `afterAnswerSubmitted`]. Pressing "Rispondi" again silently un-marks it.
3. "Seleziona le consigliate" fills the recommended option on every eligible open question **and marks each ready** (`submit.ts:376-382`, `held: { act: "answer", byRecommended: true }`), so one more click on "Invia le risposte" sends them. No count, no message; the bar's button keeps focus [UI 19, 20].
4. "Invia le risposte" sends everything held as one command; receipts show "inviata", the pill moves; focus falls to `<body>`; the view stays where it was [UI 21, observations `afterSubmit`].
5. Switching back to "Immediata" with held work opens the modal "Passare alla consegna immediata?" (`bottom-bar.tsx:247-271`).

### 1.5 Single-question board

Read in code only: one card, no navigator, no count, no next-open jump, no switch, no Submit, "Rispondi" filled primary (`board.tsx:337-345`, `bottom-bar.tsx:116-124`, `styles.ts:30-32`). After "Rispondi" the same "inviata" receipt appears and the same focus loss applies (the button disables).

### 1.6 Special paths

| Path | What happens | Evidence |
|---|---|---|
| Validation error | Inline field error under the field ("Non è nella forma attesa."); "Rispondi" disabled, described by an `sr-only` hint ("Correggi prima {label}."); nothing visible explains the grey button | [UI 23], `question-actions.tsx:140-155` |
| Note only, "Rispondi" | Immediate: a `note` act goes, the question stays open (FR-7); the card gets no receipt, since receipts exist only for answered or declined questions. Submitted: the note is held as "ready" | `card-acts.ts:343-352`, `question-state.ts:206-207` |
| Postponed question | Stays open, counted in "N aperte", reachable by the next-open jump; bottom-bar warning while any remains | [UI 07], `board-view.ts:84-87`, `153-163` |
| Agent adds a question | "Nuova" badge on outline entry, tab and navigator marker until seen; the next-open jump reaches it first; the count rises; nothing else announces it | `attention.ts:93-107`, `board-view.ts:186-199`, `navigators.tsx:27`, `board.tsx:194` |
| Agent deletes the question in view (one per view) | Navigator moves on and says "Domanda rimossa dall'agente" | `navigators.tsx:163-167`, `document-update.ts:54` |
| Revision of an answered question | The answered card stays editable; the first edit starts a revision; "Rispondi" on a received verdict asks "Inviare una nuova risposta?" | `question-card.tsx:459-479`, `644-686` |

### 1.7 Controls involved in the flow

| Control | Where | IT label | EN label | Helper / tooltip | What it does | Visible when |
|---|---|---|---|---|---|---|
| Ask pill | Header row 2 | "In attesa", "Risposte parziali n/m", "Con risposta" | "Waiting", "Partly answered n/m", "Answered" | none | What the agent's side recorded (AD-10) | Always |
| Open count | Header row 2 | "N aperte" | "N open" | none | Unanswered + postponed on the board | 2+ questions, ask not ended |
| Next open (header) | Header row 2 | "Prossima aperta ↓" | "Next open ↓" | none | Focus the next open question's heading; unseen new ones first; wraps | 2+ questions, **all presentations incl. one per view** |
| Next open (navigator) | Question navigator, right end | "Prossima aperta →" | "Next open →" | none | Same, from the question in view | One per view |
| Previous / Next | Question navigator | "Precedente", "Successiva" | "Previous", "Next" | none | Neighbour question; stop at ends | One per view |
| Outline entry | Left rail | header chip + "Senza risposta", "Pronta", "Con risposta", "Rinviata", "Rifiutata" | "Unanswered", "Ready", "Answered", "Postponed", "Declined" | `title` = full label | Jump to question (focus heading) | Sections, tabs |
| Accept recommended | Options label row, right | "Accetta la consigliata" | "Accept recommended" | none | Selects the recommended option and acts as "Rispondi" | Question has a recommendation (also when answered) |
| Postpone | Card actions, left | "Rinvia" | "Postpone" | none | Toggle; follows delivery mode; focus to heading | Always; disabled when answered/ready |
| More | Card actions, left | "Altre azioni" | "More" | none | Menu: "Spiega"/"Explain", "Rifiuta"/"Decline" | Always |
| Receipt | Card actions, right | "non ancora inviata", "inviata", "consegnata all'agente" | "not sent yet", "sent", "delivered to the agent" | none | Delivery state of the latest answer | Answered/declined or in flight |
| Answer | Card actions, right end | "Rispondi" | "Answer" | `sr-only` hint when a field blocks | Immediate: send. Submitted: toggle ready | Always; disabled until there is something to send |
| Delivery switch | Bottom bar, left | "CONSEGNA" · "Immediata \| Su invio" | "DELIVERY" · "Immediate \| Submitted" | Immediate only: "Le risposte arrivano all'agente man mano che le dai." / "Answers go to the agent as you give them." | Switch mode; submitted→immediate with held work asks first | 2+ questions |
| Select recommended | Bottom bar, right | "Seleziona le consigliate" | "Select recommended" | none | Fills recommended options on eligible open questions; in submitted also marks them ready | Any question has a recommendation (also when nothing is left to fill) |
| Snapshot | Bottom bar, right | "Snapshot" | "Snapshot" | feedback line | Writes a Snapshot file | Always |
| Submit | Bottom bar, right end | "Invia le risposte" | "Submit" | none | Sends everything held, one command | 2+ questions; **disabled, but shown, in immediate** |
| Updates needing a choice | Bottom bar, before Submit | "N aggiornamenti richiedono una scelta" | "N updates need a choice" | none | Jump to the first blocked question | Agent changed a question with held work |

Strings: `strings/it-IT.ts:24-41, 90-148, 198-215`; `strings/en-US.ts:21-38, 84-141, 189-203`.

## 2. Divergences between documents and code

| ID | Documents say | Code does | Evidence |
|---|---|---|---|
| D-1 | In one question per view the next-open jump sits in the question navigator **instead of** the header (EXP 235, DES 919) | Both show: header "↓" and navigator "→" | `board.tsx:424`, `356-363`; [UI 13, 14] |
| D-2 | The outline "highlights the question in view" (EXP 240) | It highlights the last question **jumped to** (`draft.inView`), set only by jumps, tab activation and removals, never by scrolling or answering | `board.tsx:300-305`, `382`; `document-update.ts:54`; [UI 07] |
| D-3 | The bottom bar has helper text for both modes; "the submitted-delivery text is provisional" (DES 931) | No submitted text exists in the strings or the code | `bottom-bar.tsx:215-217`; `en-US.ts:192` |
| D-4 | Inter and JetBrains Mono, bundled (DES 839-841) | System font stacks "until the faces are adopted" | `/tools/build/tokens.ts:4-11` |
| D-5 | Sticky header and bottom bar carry `shadow-sm` (DES 892) | No shadow class on either | `board-header.tsx:83`, `bottom-bar.tsx:191`; [UI 01] |
| D-6 | Ask pill "Answered" = every question "answered or declined, **as received by the agent**" (EXP 388) | Observed "Con risposta" (green) while every card's receipt still reads "inviata", not "consegnata all'agente". The pill follows `board-host`'s recorded ask state; the receipt follows AD-3's `received`. The two meanings of "received" differ; to confirm with the architecture owner | [UI 25]; `board-view.ts:119-147`; `question-state.ts:32-36` |

Not divergences, but unspecified: what happens after "Answer" (no document records any progression, scroll or focus target), the board-level key bindings (EXP 532, Open Items 21), screen-reader announcements and reduced motion (EXP Open Items 22, DES Open Items 1 at 1091), and any completion state.

## 3. Usability findings

Severity reflects the cost to a user running an agent review session: an engineer moving fast through 10 to 30 questions, or a business manager who answers rarely and must trust that answers reached the agent.

### Progression after answering

**F-01 — High. Answering leads nowhere.** [UI 03, 11, 14, 18; code `card-acts.ts:325-364`, no navigation call after any act]. In every presentation and both modes, "Rispondi" adds an 8px dot, a grey word "inviata" and a counter in the header; the card does not move, collapse or change surface, and nothing points to the next question. In sections the next card is below the fold, so the user must decide where to go. Violates *visibility of system status* and *user control and freedom* in reverse (the system gives no forward path); in Hick/Fitts terms each answer adds a scan-and-scroll step. An engineer loses rhythm; a business manager does not know whether they are "done with this one".

**F-02 — High. Focus is lost after Answer and after Submit.** [UI observations: `active` is `body` after "Rispondi" in immediate (sections, tabs, one per view), after "Invia le risposte", and when all are answered; code `question-state.ts:208-217`, `bottom-bar.tsx:236-244`]. The pressed button disables, so focus drops to the document. A keyboard user's next Tab starts from the top of the view: header fields, nine-plus toggles, the whole outline. WCAG 2.2 **2.4.3 Focus Order**; also breaks the EXP Accessibility Floor's own pattern (it moves focus after Postpone and Decline, EXP 537, but says nothing for Answer).

**F-03 — High. "Next open" does not reliably bring the question into view.** [UI 04: focus moved to `h3#cache`, `scrollY` stayed 0, the heading sat at the bottom edge, under the sticky bottom bar; code `board.tsx:245` uses bare `focus()`; no `scroll-margin`/`scroll-padding` anywhere in `shell/` or `styles/`]. The browser scrolls a focused element only "if needed" and does not account for sticky bars, so the target can stay hidden behind the bottom bar (or the header, when jumping upward). WCAG 2.2 **2.4.11 Focus Not Obscured (Minimum)**. To the user the button appears to do nothing except move the outline's thin bar.

**F-04 — Medium. The next-open anchor is stale.** [code `board.tsx:300-312`, `board-view.ts:186-199`; D-2]. "Next open" searches from the last jumped-to question, not from the question just answered or the one on screen. After scrolling and answering question 5, "Prossima aperta" may go back to question 2, or to the first open question from the top. The outline's "current" bar shows the same stale anchor [UI 07: bar on "Cache" after the user worked elsewhere]. *Match between system and the real world*; *consistency*.

**F-05 — Medium. No completion state.** [UI 25]. With nothing open the board shows "0 aperte", a disabled jump, a green pill, and otherwise looks identical; "Seleziona le consigliate" is still enabled; "Invia le risposte" is still shown, disabled. Nothing says "All questions answered", how many reached the agent, whether postponed ones remain, or that the tab may be closed (or must not be, while postponed questions exist). *Visibility of system status*, *closure* (Shneiderman's "design dialogs to yield closure"). The business manager does not know whether the job is finished.

**F-06 — Medium. Tabs give no hand-off between areas.** [UI 12; code `board.tsx:173-211`]. Finishing a tab only removes "N aperte" from its label; the strip is not sticky, so after scrolling it is off-screen; nothing proposes the next area. *Visibility*, *recognition over recall* (the user must remember that other tabs still hold work).

**F-07 — Medium. Two "Next open" buttons in one question per view.** [D-1; UI 13, 14]. Different arrows (↓ and →) for the same action in two places 50px apart. *Consistency and standards*.

**F-08 — Medium. Questions the agent adds are silent.** [code `attention.ts:93-107`, `board-view.ts:186-199`]. A "Nuova" badge appears on an outline entry (possibly off-screen in a long rail), the count rises, and the next-open jump is silently redirected to the new question first, so a user pressing "Prossima aperta" lands somewhere unexpected without being told why. No status message. *Visibility of system status*; WCAG **4.1.3 Status Messages**.

**F-09 — Medium. A note-only "Answer" leaves no trace.** [code `card-acts.ts:343-352`; `question-state.ts:206-207`]. In immediate delivery the note goes and the question stays "Senza risposta" with no receipt; the user cannot see that the note was delivered, and the same button that "answers" elsewhere here only comments. *Visibility*; fail-closed is respected (no false "answered"), but the user gets no confirmation either.

### Delivery ("Consegna")

**F-10 — High. The delivery model is not explained where the user acts.** [UI 01, 16, 17; code `bottom-bar.tsx:192-217`; D-3]. The mode lives in the bottom-left corner under an 11px uppercase label "CONSEGNA", far from "Rispondi" (bottom-right of each card). In "Su invio" there is no helper text at all, so the user learns only by trial that "Rispondi" did not send. The agent picks the mode, so a user can meet "Su invio" on their first board. *Visibility*, *recognition over recall*, *proximity* (Gestalt).

**F-11 — High. In "Su invio", "Rispondi" means "mark ready", and its toggle is silent.** [UI 18; code `card-acts.ts:355-357`, `question-actions.tsx:140-150`]. The same verb sends in one mode and marks in the other; pressing it again un-marks with no message; the only cue is a pale fill and an 8px ring-dot. Meanwhile the open count drops (the question no longer counts as open) while the pill stays "In attesa": two header signals that disagree in the user's eyes. Fail-closed is intact (nothing is sent), but the user's model "I answered" is wrong until Submit. *Match with the real world*, *consistency*; risk of a user closing the tab believing answers went (the leave-page prompt is the only guard).

**F-12 — Medium. The mode names do not say "when".** [strings `it-IT.ts:198-201`, `en-US.ts:189-192`]. Italian: "Su invio" is ambiguous, since "Invio" is also the name of the Enter key on Italian keyboards ("on Enter"?), and it does not name the button it refers to ("Invia le risposte"). "Consegna" is a noun with several readings (hand-over, deadline). English: "Submitted" is a past participle and reads as a state ("already submitted") rather than a mode ("send when I submit"); "Immediate" is fine. Neither language links the mode to the receipt words ("inviata", "consegnata all'agente").

**F-13 — Medium. "Invia le risposte" / "Submit" is shown, disabled, in immediate delivery.** [UI 01, 06]. A disabled primary labelled "send the answers" suggests answers still need sending, contradicting the helper text beside it. The Italian plural reinforces it. *Consistency*; disabled-primary anti-pattern (the user cannot learn why it is disabled; no tooltip).

**F-14 — Medium. Two status counters with different meanings, none labelled as delivery.** [UI 03, 18]. "Risposte parziali 1/9" (what the agent's side recorded) next to "8 aperte" (what is left on the board). In "Su invio" they diverge further ("In attesa" with "5 aperte"). D-6 adds a third meaning: the pill can say "Con risposta" while each receipt says only "inviata". The user cannot tell "sent", "delivered" and "left to do" apart at a glance. *Visibility*; the fail-closed constraint makes this important: no redesign may let "answered" read as "the agent has it" unless AD-3's `received` holds.

### "Prossima aperta" (Next open)

**F-15 — Medium. Wording, placement and mechanism.** [UI 01, 05, 13; strings `it-IT.ts:31`, `116`]. "Prossima aperta" is elliptical (feminine adjective without its noun, "domanda"), and "aperta" (open) also covers postponed questions, which users call "rinviate", not "aperte". It sits in the header among status items, styled like the toggles, about 600px from where the user just answered; the arrow "↓" is wrong when it wraps upward or switches tabs. It is a second step the user must remember after every answer, instead of the natural continuation of "Rispondi". *Recognition over recall*, *Fitts's law* (distance from the last click), *consistency* (↓ vs →).

### "Seleziona le consigliate" (Select recommended)

**F-16 — Medium. Placement and grouping.** [UI 01, 17]. It sits in the bottom bar between the delivery switch and "Snapshot", grouped with export and send. It is a bulk *draft-filling* action that acts on questions the user may not have read, yet it has the same weight as Snapshot and no description of its scope. Its natural neighbours are the open count and "Prossima aperta" (board-level progress), or a pre-review step at the top of the board. *Proximity*, *match*.

**F-17 — Medium. Its effect differs by mode and gives no feedback.** [UI 19, 22; code `submit.ts:316-386`; the returned count is ignored at `board.tsx:444-451`]. In "Immediata" it fills drafts only, so the user must still visit each question and press "Rispondi" (on a nine-question board, four trips). In "Su invio" it also marks each one ready, one click from "Invia le risposte". Neither mode says how many questions it touched, which ones, or how to undo; focus stays on the button; it remains enabled when nothing is left to fill [UI 25]. The behaviour respects AD-10 (nothing sent, nothing replaced), but the user cannot predict it. *Visibility*, *user control and freedom* (no undo), WCAG **4.1.3**.

**F-18 — Low. "Accetta la consigliata" stays on answered questions.** [UI 03, 25; code `question-card.tsx:296-305`, `506`]. On an answered card it starts a revision and a confirmation dialog; on a card where the user chose another option it still invites them to switch. It sits at the far right of the options label, away from the recommended option it acts on. *Proximity*, *error prevention*.

### Coherence of actions

**F-19 — Medium. The card's primary action is far from the choice and from its siblings.** [UI 01-03]. Options span the full card width; "Rispondi" sits at the right end of the actions row, about 1000px from "Rinvia" and "Altre azioni" at 1280px, and below the note field. After answering, "Rinvia" and "Rispondi" both turn grey without saying why or how to revise (revision starts silently on the first edit). *Proximity*, *Fitts's law*, *visibility*.

**F-20 — Medium. Disabled "Rispondi" hides the reason.** [UI 23; code `question-actions.tsx:140-155`]. With a field error, the reason is announced to screen readers through an `sr-only` description but never shown next to the button; a sighted user sees a grey "Rispondi" and must find the error in the form above. Same when nothing is chosen yet. WCAG **3.3.1 Error Identification** is met at the field, but the button gives no visible cue; disabled-button anti-pattern.

**F-21 — Medium. Italian verbs collide.** [strings `it-IT.ts:117-148`, `198-215`]. "Rinvia" (postpone) also reads as "send again" (rinviare = to resend), next to "Invia", "inviata", "Invia le risposte", "Invia e passa", and the mode "Su invio": five forms of *inviare* with three meanings on one screen. "Altre azioni" hides "Rifiuta", a decision-level act, behind a generic label. "Con risposta" works as an outline state but is weak as the ask's final state. English is clearer but inconsistent across levels: "Answer" (card) vs "Submit" (board) do not say that Submit sends the answers marked with Answer; "Ready" appears only in the outline, never on the button that sets it.

**F-22 — Low. The answered state on the card is weak.** [UI 03, 21]. The only card-level marks are an 8px dot before the header chip and the word "inviata" in 11.5px muted text. The selected option keeps the same look as before answering, so answered and merely-selected cards look alike. *Visibility*; WCAG **1.4.1** is met in the outline (text labels) but not on the card itself, where the dot has no text.

**F-23 — Low. The bottom bar reflows.** [UI 07, 14]. The postponed warning pushes the bar's right group onto a second row (the primary moves while the user may be aiming at it); on short pages the sticky bar floats above an empty band.

### Keyboard, screen reader, motion

**F-24 — High. No status messages for the flow.** [UI observations: the only live regions are the agent pill (`agent-pill.tsx:32`, `role="status"`) and an empty status; code search finds no `aria-live` in `shell/` besides size lines and the Snapshot feedback]. Not announced: "sent", "ready", "delivered", Select recommended's result, Submit's result, all answered, a new question, a removed question (the navigator line is plain text). Meanwhile the agent pill announces every "al lavoro" change, which is noise during answering. WCAG **4.1.3 Status Messages**.

**F-25 — Low. No board-level keys.** [code: `packages/contract/src/keys/vocabulary.ts:107-136` covers widget actions only; the shell handles keys only in the keys frame, segmented controls and the composer]. "Next open", "Answer", "Postpone" and Submit have no shortcuts (EXP 532, Open Items 21). Acceptable for the floor, but a flow redesign should decide them through the key-table seam rather than ad hoc handlers.

**F-26 — Low. Reduced motion is unaddressed.** [code: no `prefers-reduced-motion` in `styles/` or `shell/`; `board-page/reading-panel.ts:69` uses `animate-pulse` ungated]. Nothing in the flow animates today, so nothing breaks; any transition a redesign adds (scroll, collapse, highlight) needs a reduced-motion path from the start (DES 660 "minimal motion", DES Open Items 1).

## 4. Constraints a redesign must respect

- **Fail closed** (NFR-10, AD-10, AD-3). Never suggest an answer reached the agent when it was only held or only sent: "ready" is not "sent", "sent" is not "delivered to the agent", and "delivered" never means "read" (EXP 271, Voice and Tone "Not adopted": "read by the agent"). Any completion message counts from the receipts' `received`, and says so; in submitted delivery it must say that nothing has gone until Submit. Auto-advance must never answer, select or mark anything.
- **Explicit acts only** (EXP 490-495). No preselection, no answer on navigation or blur; Select recommended keeps "selects only" in immediate delivery. A redesign that changes what it does in submitted delivery (today it also marks ready) is a behaviour change to the "Select recommended" and "Submit" requirements in `openspec/specs/view-and-widgets/spec.md` and to EXP 245-247.
- **Agent content is data** (NFR-5, AD-8). Titles, headers, question texts and option labels render as text only, in the sandboxed view; a "next question" preview or completion summary that quotes them must use the same text rendering and the agent-written labels' truncation and bidi isolation (EXP 233).
- **Keyboard seams** (`keyboard-shortcuts-help`, `docs/as-built/keyboard-shortcuts-help.md`). Keys live in key tables that feed the handlers, the tooltips (`aria-keyshortcuts`, key caps), the keys panel and the `askboard-help` skill; a board-level key for Next open, Answer or Submit goes through a table and the vocabulary in `packages/contract/src/keys/vocabulary.ts`, needs a modifier when it answers or sends, and never fires in a text field (EXP 533). A newly opened board ignores keys until clicked (EXP 427).
- **Focus rules** (EXP 535-543). Existing moves stay: navigation and Postpone/Decline to the heading, reasons to the prompt, panels back to their opener. A notice never takes focus. Any new move after Answer must not steal focus from a user who is still typing in another card's field.
- **Chunk budget.** `bun run build:view` fails when a chunk grows more than 10% over `packages/view/chunk-sizes.json`; the shell chunk is 221,700 bytes, so about 22 KB of headroom. No animation or icon library fits casually; prefer CSS and inline SVG.
- **Tokens and themes.** Components read only layer-3 CSS variables; light and dark through the `.dark` class, density through `.comfortable` (both on the view root, `theme.ts`). New colours become DESIGN.md YAML tokens, generated by `tools/build/tokens.ts`; no colour literals in components. Colour roles: accent for interactive and selected, info for unseen news, success for answered, no warning colour outside thresholds (DES 750-773). Every state keeps a shape plus text (DES 764-773).
- **Motion.** Minimal, only where it helps (DES 660); gate every transition behind `prefers-reduced-motion`, and keep scroll jumps instant under it.
- **i18n.** Every string lives in `strings/en-US.ts` and `strings/it-IT.ts` under a key in `strings/keys.ts`, with plural forms; Italian strings marked "(to review)" in EXP Voice and Tone wait for a native review. Board strings only; agent text is never translated.
- **Presentations.** The agent chooses the presentation and the user cannot switch it (EXP 95). One question per view "never advances by itself" today (EXP 241): changing that is a PRD/UX decision, not an implementation detail.
- **Single-question board.** Its rules (no count, jump, switch, Select recommended or Submit) stay (EXP 93); the golden case is the design's yardstick (DES 656).
- **No browser storage, nothing from the network** (EXP 508-511): no remembered "don't show again" in localStorage; fonts and icons bundled.

## 5. Facts for designers

**Tokens and theme mechanism.** DESIGN.md's YAML front matter is the source; `tools/build/tokens.ts` turns it into CSS variables (`--background`, `--card`, `--muted`, `--popover`, `--border`, `--border-strong`, `--foreground`, `--foreground-secondary`, `--muted-foreground`, `--primary`, `--primary-hover`, `--primary-subtle`, `--primary-text`, `--primary-foreground`, `--ring`, `--change*`, `--agent*`, `--success*`, `--destructive*`, `--warning*`, `--info*`, `--ask-*`, `--recommended*`, diff, Gantt, chart and syntax tokens) and a Tailwind 4 `@theme inline` mapping, so utilities such as `bg-card`, `text-primary-text`, `text-badge`, `h-control-height`, `p-lg` read the variables. The palette is "Warm Paper & Petrol" (DES 684-748). Dark is a `.dark` class, comfortable density a `.comfortable` class, both on the view root (`theme.ts:28-30`, `62-66`). Shared class strings: `shell/styles.ts` (`BUTTON_SECONDARY`, `BUTTON_LINK`, `BUTTON_ANSWER`, `BUTTON_PRIMARY`, `BUTTON_ANSWER_PRIMARY`, `CHIP`, `SECTION_LABEL`, `INFO_BADGE`, `SEPARATOR`, `TEXT_FIELD`, `DIALOG`, `FIELD_ERROR`, `FOCUS_RING`). Hand-written CSS: `styles/base.css` (13px base size, line height 1.4), `styles/hover.css`, `styles/segment.css` (segmented control). Theme options: System, Light, Dark.

**Type ramp** (compact; comfortable in brackets): question 20px/600 (22), body-lg 14px (15), body 13px (14), control 12px/500 (13), badge 11.5px/500, label 11px/600 uppercase 0.06em, code 12px (13). Faces: specified Inter and JetBrains Mono; built with system stacks (D-4).

**Spacing and sizes.** 8px grid: xs 4, sm 8 (12), md 12 (16), lg 16 (24), xl 24 (32); control height 28 (32), header row 32 (40), toolbar row 32 (36), bottom bar 48 (56); outline rail 212px; context column 360px; side sheet 560px. Radii: 4px controls, 6px cards. **Breakpoints: none.** Desktop only, viewport floor 1280px; the shell uses no responsive prefixes, only `flex-wrap`.

**Shell component inventory** (`packages/view/src/shell/`):

| Component | File | Notes |
|---|---|---|
| Board frame, presentations | `board.tsx` | Sections, `TabsBody` (Radix Tabs, `forceMount`), `OneQuestionBody`, single board; focus requests |
| Context header | `board-header.tsx`, `who-and-where.tsx`, `agent-pill.tsx`, `quick-toggles.tsx`, `segmented.tsx` | Sticky, two rows; row 2 holds title, "Ask" label, pills, counts, next open, unread replies, agent-change flag, toggles, Settings |
| Outline navigator, question navigator | `navigators.tsx` | Outline: sticky rail, `aria-current` bar; navigator: position, marker strip, Previous/Next, Next open |
| Question card | `question-card.tsx` | Notices, marker + header chip, heading (`tabIndex=-1`, focus target), options label + Accept recommended, items, open prompt, actions row, thread, revision dialog |
| Question actions | `question-actions.tsx` | Postpone toggle, More (Radix DropdownMenu: Explain, Decline checkbox item), receipt, Answer |
| Card state and acts | `question-state.ts`, `card-acts.ts`, `answer-acts.ts`, `submit.ts` | Pure logic: what the card shows and sends, Submit and Select recommended |
| Board view logic | `board-view.ts` | Presentation, groups, marks, counts, ask pill, postponed warning, next-open order |
| Attention | `attention.ts` | New and unread marks via IntersectionObserver |
| Bottom bar | `bottom-bar.tsx`, `snapshot-button.tsx` | Delivery switch, helper, postponed warning, Select recommended, Snapshot, updates link, Submit, two Alert Dialogs |
| Markers and pills | `markers.tsx` | CSS-drawn shapes (ring, half dot, dot, dot-in-ring, pause bars, slashed ring, square, bar), `aria-hidden`, text always beside |
| Notices | `change-notice.tsx`, `size-lines.tsx`, `replaced-questions.tsx` | Agent change, reopened question, size limits |
| Thread | `thread.tsx` | Follow-ups ("Chiarimenti"/"Follow-up"), composer with Ctrl/Cmd+Enter |

**Icons today.** No icon library and almost no SVG: one inline SVG in the date field (`catalog/date-field/index.tsx:60`). State shapes are CSS boxes (`markers.tsx`). Glyphs are Unicode text in strings and JSX: ↓ and → (next open), ↩ (unread replies, `navigators.tsx:30`), ↻ (agent changed, `navigators.tsx:35`), ✕ (close), ✓ (approval), ↗ (external reference), ↑/← (widget moves), × (one widget). They inherit the text colour and font, render differently per platform font, and are read aloud by screen readers unless wrapped `aria-hidden`.

**Sticky layers.** Header `sticky top-0 z-10` (64px compact); outline `sticky top-16`; bottom bar `sticky bottom-0`. No `scroll-margin`/`scroll-padding`, so focus and `scrollIntoView` ignore both bars (F-03).

**Live regions today.** `agent-pill.tsx:32` (`role="status"`), `size-lines.tsx:24,29`, `snapshot-button.tsx:48`, `renderer.tsx:83` (`role="alert"` for item errors), `pick-field` no-match, and a polite region on the board page (`board-page/page-chrome.ts:121`) for banners.

**Specs a change would cite** (`openspec/specs/view-and-widgets/spec.md`): Presentations (551), Tabs, One question per view, Outline navigator (576), Counts and the next-open jump (583), Open prompt, Recommended option (608), Select recommended (615), Postpone (636), Decline, Delivery mode (671), Submit (678), Mode-switch confirmation, Revising an answer (696), Answer sends at once (120), Delivery receipt on the board (127), Hover and focus feedback (1689), A common key vocabulary (3640); `openspec/specs/core/spec.md`: Answers only from an explicit user action (44), A note without an answer (187); `openspec/specs/board-host/spec.md`: Delivery receipt (100).

## 6. Screenshots

`screenshots/current/`, all 1280×800, Italian unless marked `en`:

| File | Shows |
|---|---|
| `01-sections-immediate-initial-it-light.png` | Initial board, sections, immediate |
| `02-sections-immediate-option-chosen-it-light.png` | Option chosen, Answer enabled |
| `03-sections-immediate-just-answered-it-light.png` | Just after "Rispondi": nothing moves |
| `04-sections-after-next-open-it-light.png` | After "Prossima aperta ↓": no scroll, target under the bottom bar |
| `05-header-row2-it-light.png` | Header crop |
| `06-bottom-bar-immediate-it-light.png` | Bottom bar, immediate |
| `07-sections-postponed-warning-it-light.png` | Postponed question, bar wraps to two rows |
| `08-sections-immediate-initial-it-dark.png`, `09-…-just-answered-it-dark.png` | Dark theme |
| `10-tabs-immediate-initial-it-light.png`, `11-…-just-answered…`, `12-tabs-area-completed-it-light.png` | Tabs; area finished, strip scrolled away |
| `13-one-per-view-immediate-initial-it-light.png`, `14-…-just-answered…`, `15-…-after-next-open…` | One per view; two "Next open" buttons |
| `16-sections-submitted-initial-it-light.png`, `17-bottom-bar-submitted-it-light.png` | "Su invio" without helper text |
| `18-sections-submitted-one-ready-it-light.png` | Answer marked ready |
| `19-…-after-select-recommended…`, `20-…-recommended-held-card…` | Select recommended marks three ready, silently |
| `21-sections-submitted-after-submit-it-light.png` | After "Invia le risposte" |
| `22-sections-immediate-after-select-recommended-it-light.png` | Select recommended in immediate (drafts only) |
| `23-validation-error-it-light.png` | Field error, Answer disabled |
| `24-all-answered-immediate-it-light.png`, `25-all-answered-top-it-light.png` | Nothing open: no completion state |
| `26-sections-immediate-initial-en-light.png` | English labels |
| `27-one-per-view-submitted-ready-it-dark.png` | One per view, submitted, dark |
