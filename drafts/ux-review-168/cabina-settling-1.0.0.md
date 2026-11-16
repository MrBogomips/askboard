# Direction B "Cabina": settling the open points (Issue #168, #213)

Version 1.0.0, 2026-11-15. Base: `main` at `583a0161`. Draft (Working documents: `drafts/`): it never overrides `docs/` or `openspec/`.

Input to the design of `answering-flow-visual` (change 6 of #168). It works from `ux-review-report-1.1.0.md` §6.4 and the PO's answer on #213 (option 1, point 8), and keeps every decision the PO already took (report §1; direction B; "Dopo la risposta" defaulting to "Vai alla prossima"; prefill drafts only; "Invia N risposte" absent in "Una alla volta"; `N` / `Shift+N`, `Mod+Enter`; Lucide; Carta, Nordico, Grafite, Contrasto; postpone as today; no "close the tab"; the jump in the header; counts from receipts only).

- Mockup: [`proposals/proposal-b-cabina-1.1.0.html`](proposals/proposal-b-cabina-1.1.0.html) (1.0.0 is unchanged beside it). It opens in Carta, light, it-IT, with every point set to the recommended option. The second row of the mockup strip ("Da decidere") switches each point to its alternatives; `*` marks the recommended option. The strip also simulates the agent adding, removing and updating a question, and the agent not collecting ("Ricevute: L'agente non raccoglie") with "Simula: l'agente raccoglie".
- Screenshots: [`proposals/screenshots/b-1.1.0/`](proposals/screenshots/b-1.1.0/), 1280×800, it-IT, light and dark (`-light`, `-dark`), Chromium by script; file names below are given without the scheme suffix where both exist.

## Summary

| # | Point | Recommendation | Who decides (report) | Frames |
|---|---|---|---|---|
| 1 | Carta on B's layout | Ship B in Carta as drawn; no token change needed | The `palettes` change checks it (§7) | 01, 02, 05, 28-* |
| 2 | One question per view | Keep the rail with outline and outbox | The change (§6.4.1); the PO sees it in validation task 9 | 06, 07, 08 |
| 3 | Single-question board | No rail, no outbox, no progress row; the card's state is the receipt | Settled by §3.4; drawn here | 09 to 12 |
| 4 | Rail width | 256 px, ledger in four columns | The change (§6.4.2) | 04-*, 05 |
| 5 | Postponed warning | Header, first row, after the agent pill | The change (§6.4.3); deviates from §3.3.5 | 13, 14, 15, 12 |
| 6 | "N aggiornamenti richiedono una scelta" | In the outbox, under the blocked "Invia N risposte" | The change (§6.4.3) | 16 |
| 7 | Short question numbers | Fixed at first display, never reused | The change (§6.4.6) | 17, 18, 19 |
| 8 | #213: answered and received | **Decided by the PO: option 1.** The ask pill says what the user answered (AD-10, today's code); delivery only in the receipts, the ledger and the completion line; the two never share a word, an icon or a count | Decided (PO, 2026-11-15) | 20 to 23 |
| 9 | Strings not in report §4 | The wordings drawn, listed below | **The PO** (§4, last note) | all |

## 1. Carta on B's layout

**Options.** (a) B's layout in Carta's tokens as they are in `DESIGN.md`; (b) Carta with B-specific adjustments (for example a darker `border` for the hairlines).

**Recommendation: (a).** Every pair B's layout uses passes with Carta's tokens unchanged, light and dark:

| Pair (what uses it in B) | Need | Light | Dark |
|---|---|---|---|
| `muted-foreground` / `muted` (to-do segments, labels on the sunken mode switch) | 4.5 | 5.02 | 6.62 |
| `primary-text` / `primary-subtle` (Bozza, Pronta badges, segment icons) | 4.5 | 5.83 | 6.69 |
| `success-text` / `success-subtle` (Inviata, Consegnata, the "Resta qui" footer) | 4.5 | 6.22 | 8.19 |
| `success-text` / `card` (ledger counts) | 4.5 | 6.95 | 8.98 |
| `info-text` / `info-subtle` ("Nuova") | 4.5 | 5.83 | 7.25 |
| `agent-text` / `agent-subtle` (Consigliata, agent pill, agent-change notice) | 4.5 | 7.20 | 7.84 |
| `primary` / `card`, `success` / `card` (state stripes, dashed and solid) | 3 | 5.82, 5.12 | 6.79, 6.67 |
| `primary` / `primary-subtle`, `success` / `success-subtle` (segment underlines) | 3 | 5.07, 4.59 | 5.83, 6.08 |
| `border-strong` / `muted` (to-do segment underline, key caps on the sunken switch) | 3 | **3.01** | 3.88 |
| `ring` / `card`, `ring` / `background` (focus, arrival mark) | 3 | 3.97, 3.71 | 8.45, 9.14 |
| `border` / `card` (hairlines: card edge, ledger cells, to-do stripe) | none | 1.33 | 1.34 |

A scan of every rendered text element on twelve frames (1,151 elements per palette and scheme, disabled controls excluded) found no text under its threshold in any of the four palettes; the lowest was 5.02 in Carta light, 5.01 in Carta dark, 4.75 in Nordico dark.

Things the change should know:

- `border-strong` on `muted` is 3.01 in Carta light: it passes, with no margin. A to-do segment's underline and a key cap on the sunken switch rely on it; nothing relies on it alone (the segment has its icon and its label).
- The hairlines (`border`, about 1.3:1 in every palette but Contrasto) carry no meaning: the state is the stripe, its icon and its label. The to-do stripe is the hairline, so "Da fare" rests on icon and text, as in 1.0.0.
- In Carta `info` is the accent (DESIGN.md, Colors), so the "Nuova" badge and the Bozza/Pronta badges share a hue; they differ by icon (`bell-dot`, `pencil`, `package`) and text.
- `success-foreground` is not in DESIGN.md. B uses it nowhere visible; the mockup sets it as Carta sets `destructive-foreground` (white on light, the dark background on dark). The `palettes` change adds it or drops its use.
- Carta dark's `muted` is darker than `card` (a sunken fill), the opposite of B's three other palettes; the mode switch and the to-do segments read as recessed. Nothing fails, and it is today's look.

Frames: `01-carta-initial`, `02-carta-after-answer-go-next`, `05-rail-256-full-board`; the other palettes on one frame: `28-palette-nordico`, `28-palette-grafite`, `28-palette-contrasto`.

## 2. One question per view

**Options.** (a) The rail with outline and outbox, as B's 1.0.0 mockup drew it; (b) the rail with the outbox only, no outline (today's presentation has no outline, EXP 92 and 240); (c) no rail, the outbox somewhere else (the header or the question navigator).

**Recommendation: (a).** The outbox stays where it is in sections and tabs, so the user finds the send in the same place whatever the presentation (validation task 9: "finds the send without a bottom bar"); the outline costs nothing more once the rail exists, and it is the only place that names every question with its state in words. (b) leaves a tall empty rail for a 300 px box; (c) needs a second design of the outbox. The header's progress strip replaces the question navigator's strip of markers, so the navigator keeps "Domanda n di m", Precedente and Successiva only (P0-6, #184), and "Prossima da fare" stays in the header.

With "Vai alla prossima" (the PO's default), answering in one question per view changes the view to the next question to do, focus on its heading (`08-one-per-view-after-answer-go-next`); this amends EXP 241 and the spec "One question per view" ("answering SHALL NOT advance"), as the report says.

What it amends: spec "Presentations", "One question per view", "Outline navigator"; EXP Presentations table, Outline navigator ("absent … in one question per view"), Question navigator (the strip and the jump leave it); DES Layout ("in the one-question-per-view presentation there is no rail").

Frames: `06-one-per-view-outline-and-outbox` (recommended), `07-one-per-view-outbox-only`, `08-one-per-view-after-answer-go-next`.

## 3. The single-question board

**Options.** (a) As report §3.4: one header row (title, ask ID, ask pill, agent pill, tools with Snapshot), no rail, no outbox, no progress row (no strip, count, jump or prefill), no mode switch, the card at full width, its state and receipt the only summary; after the send, "Risposta inviata." in the live region and focus on the card heading, no "Continua", no completion panel. (b) Keep a rail with the outbox for consistency with the other boards.

**Recommendation: (a).** The board has no mode and nothing to hold (EXP 93), so an outbox would show a ledger of one and no control. The card already shows every rung of the ladder: "Inviata", then "Consegnata all'agente" when the receipt says received (`10`, `11`). Two things the frames settle beyond §3.4:

- The short number (D1) is not shown: with one question it says nothing.
- The postponed warning has a home here too (point 5): the header's first row (`12-single-question-postponed`). This is why point 5 recommends the header and not the outbox.

Frames: `09-single-question-initial`, `10-single-question-sent`, `11-single-question-delivered`, `12-single-question-postponed`.

## 4. The rail width

**Options**, measured at 1280×800 in Chromium with the system font, in "Tutte insieme" with three ready answers, Italian and English:

| Rail | Ledger | Result | Content area at 1280 |
|---|---|---|---|
| 212 (token today) | four columns | The ledger needs 215 px inside a 185 px box: "Consegnate" clipped; the mode switch needs 200 px: "Tutte insieme" sticks out | 1,068 px |
| 212 | 2×2 | Ledger fits; the mode switch still sticks out; outbox 46 px taller | 1,068 px |
| 240 | four columns | Ledger 2 px over its box (Italian) | 1,040 px |
| 240 | 2×2 | Fits; outbox 46 px taller, the outline loses that height | 1,040 px |
| **256** | **four columns** | **Fits, Italian and English, with about 14 px to spare in the ledger** | **1,024 px** |
| 268 (1.0.0) | four columns | Fits | 1,012 px |

**Recommendation: 256 px, ledger in four columns.** It is the narrowest width where the ledger keeps its left-to-right reading (Bozze → Pronte → Inviate → Consegnate, the answer's journey) and the mode switch fits on one line. The product's content column has no maximum width (`board.tsx`), so every pixel of rail comes off the questions: 256 takes 44 px from today's content at the 1280 floor, 12 px less than 1.0.0's 268; a question with excerpts keeps a question column of about 600 px beside the 360 px context column. The mockup drops 1.0.0's 300 px rail above 1600 px: nothing in the rail needs it.

The product bundles Inter, a little wider than the system font measured here: the change re-measures the longest Italian labels ("Consegnate", "Tutte insieme", "Invia 3 risposte") in the build at 1280 px and in "Comoda", and records the token as `outline-rail: 256px` in DESIGN.md.

Frames: `04-rail-212-ledger-4col`, `04-rail-212-ledger-2x2`, `04-rail-240-ledger-4col`, `04-rail-240-ledger-2x2`, `04-rail-256-ledger-4col` (light and dark), `04-rail-268-ledger-4col` (crops of the rail's foot); `05-rail-256-full-board`.

## 5. The home of the postponed warning

Today it is a fixed line in the bottom bar, which B removes (EXP 244; DES Bottom action bar: the `question-marker-postponed` shape, "Hai 1 domanda rinviata: chiudendo perdi questa richiesta", no fill, no warning colour, no dismiss).

**Options.** (a) The header's first row, after the agent pill, in a slot that does not shrink while the title ellipsizes; (b) the header's second row, at the right end of the progress row (report §3.3.5: "the progress area as a fixed-height line"); (c) the outbox, under the ledger.

**Recommendation: (a).** It is the only home present on every board, the single-question board included, which has no progress row and no outbox (point 3); the line is about closing the ask, a fact about the whole board, and the first row is the ask's identity row. Nothing reflows: the row's height is fixed and the title gives up width. (b) fits at 1280 px only while the progress row is short: with two postponed questions and "Precompila le consigliate (4)", the count "9 da fare (di cui 2 rimandate)" is overlapped by "Prossima da fare" (`14-postponed-warning-progress-row-crowded`), and it has no place on the single-question board. (c) is beside the send, which suits "Tutte insieme", but it hides at the rail's foot and does not exist on the single-question board. The count stays in the progress row ("8 da fare (di cui 1 rimandata)"), and the completion panel keeps its own line ("Resta 1 rimandata. Chiudendo perdi questa richiesta.", §3.3.4).

The warning's string, with §4's "rimandata" for "rinviata": "Hai 1 domanda rimandata: chiudendo perdi questa richiesta" / "Hai 2 domande rimandate: …"; EN unchanged ("You have 1 postponed question: closing loses this ask").

This differs from §3.3.5's "progress area": the change records the home it takes in EXP and DES (the Bottom action bar rows are rewritten anyway, §6.4.3).

Frames: `13-postponed-warning-header` (recommended) and `13-postponed-warning-header-crowded`, `14-postponed-warning-progress-row` and `14-postponed-warning-progress-row-crowded`, `15-postponed-warning-outbox`, `12-single-question-postponed`.

## 6. The home of "N aggiornamenti richiedono una scelta"

Today, in "Tutte insieme", while an agent-change notice sits on a question with held work, Submit is disabled and the bottom bar says how many updates need a choice, with a jump to the first (EXP Submit; DES Bottom action bar; `bar.updates`).

**Options.** (a) In the outbox, under "Invia N risposte", which stays blocked (dashed, `aria-disabled`, its description the same text); the line is a link that goes to the first question to decide; (b) the header; (c) a toast.

**Recommendation: (a)**, as report §6.4.3 already places it: the line explains why the button beside it does nothing, the same pattern as the blocked "Invia risposta" with its reason (P0-7). It replaces the "{k} risposte pronte: niente è stato ancora inviato." line while it shows, so the outbox does not grow by two lines. The outline flags the question ("Aggiornata dall'agente", `header.agentUpdated`), and the notice sits on the card with today's strings ("L'agente ha aggiornato questa domanda", "Mostra la modifica dell'agente", "Ricarica, perdendo il mio lavoro", "Tieni le mie"). The mode-switch dialog stays blocked as today.

The mockup adds one line under the notice's title, "La tua risposta pronta resta qui finché non scegli." / "Your ready answer stays here until you choose.", not in EXP: drop it or adopt it (strings, below).

Frame: `16-updates-need-a-choice` (mockup control "Simula: l'agente aggiorna una domanda pronta", in "Tutte insieme" with a ready answer).

## 7. Stable short question numbers

**Options.** (a) Fixed at first display: a question keeps its number for the life of the ask; a question the agent adds takes the next free number; a removed one leaves its number unused, and the outline shows where it was ("D3 rimossa dall'agente"); (b) by board position (1.0.0): an added or removed question renumbers those after it, under the user; (c) no numbers: the chip alone names a question.

**Recommendation: (a).** It is the fail-closed choice: a number the user has read never changes meaning, so "Prossima: Staging D10" and an answer the user remembers as "D5" stay true. The cost is that numbers can be out of board order (D10 between D6 and D7) and can have a gap. (b) is the defect §6.4.6 names: in `18-numbers-by-position`, after the agent added Staging and removed Coda, Catalogo, read as D4, is D3 and Staging is D6. (c) loses the shorthand the strip's tooltips, the outline and the "Prossima" footer use, and the chips the agent writes are not unique. Numbers are a view's labels, not IDs the agent sees; in the build they are kept in the board's session state so a reload keeps them.

Frames: `17-numbers-fixed` (recommended), `18-numbers-by-position`, `19-numbers-none`; each after "Simula: l'agente aggiunge una domanda" and "Simula: l'agente toglie una domanda", in "Resta qui" so the footer names the next question.

## 8. #213: what the user answered, and what the agent received (decided)

**Decided by the PO, 2026-11-15: option 1 of #213.** The ask pill says what the user has answered, as AD-10 and today's code define it; delivery shows only in the receipts, and the ledger and the completion panel count from them. The forms that put both on one control (a pill with a delivery suffix, a delivery count in the header) are dropped.

So B keeps the ask pill, which its 1.0.0 mockup had removed: it sits in the header's first row, before the agent pill, with today's words: "In attesa", "Risposte parziali {a}/{m}", "Con risposta" (", {p} rimandate" when some are postponed). A ready answer does not move it; the send does (spec scenario "A ready answer does not move the pill" stands).

How the mockup keeps the pill and the delivery counts from reading as the same claim:

| | The ask pill (answered) | The receipts, the ledger, the completion line (received) |
|---|---|---|
| Words | Speak of answers only: "In attesa", "Risposte parziali 5/9", "Con risposta"; its accessible name and tooltip say whose state it is: "Richiesta: Con risposta" | Speak of the trip only: "Inviata", "Consegnata all'agente"; the ledger "Inviate", "Consegnate" under "Invio delle risposte"; "9 inviate, 2 consegnate all'agente." |
| Icons | `circle`, `circle-dashed`, `check` | `send`, `check-check`; the pill never uses them |
| Counts | Answered over total only; never a delivery count | Delivery counts only, from the receipts (AD-3 `received`); never "con risposta" |
| Place | Header, first row, beside the ask's title | The cards, the outbox at the rail's foot, the completion panel's second line |
| When it moves | When an answer is sent (one by one) or the held ones are sent ("Tutte insieme") | When a receipt says received |

The answered pill keeps DESIGN.md's `state-pill-ask-answered` look (`success-subtle`, `success-text`), the green the cards use for "Inviata" and "Consegnata all'agente". That is consistent: the pill reaches "Con risposta" only once every answer has left the board, so everything it covers is at least "Inviata"; what tells "received" apart is the double check and the word "Consegnata", which the pill never shows. The completion panel says both, each in its own sentence: the title "Tutte le domande hanno una risposta." (answered), the line "9 inviate, 2 consegnate all'agente." (received).

The frame with the agent not collecting shows the two side by side: the pill "Con risposta", the ledger "Inviate 9 · Consegnate 2", seven cards "Inviata" (`21`).

On a crowded first row (the pill, the agent pill and the postponed warning together), the ask title gives up width and ends in an ellipsis, full on hover (EXP Agent-written labels): `13-postponed-warning-header-crowded`.

The ledger in 1.1.0 counts cumulatively: "Inviate" is every answer the board has sent, delivered ones included, and "Consegnate" those whose receipt says received, so "Inviate 9 · Consegnate 2" reads as "2 of 9" (1.0.0 counted each answer in one cell only, so "Inviate" fell back to 0 as receipts came in). Declines stay out of the ledger; the completion panel adds them ("1 rifiutata.").

What it changes (option 1 of #213: records only): EXP State pill ("as the agent has received it") and Ask states say "answered on the board"; spec "Counts and the next-open jump" ("The ask pill SHALL show only what the agent has received") says what the user has answered; the comment on `askPillOf` the same. The pill's words stay.

Frames: `20-ask-pill-midway` (5 answered, 3 delivered), `21-ask-pill-answered-agent-not-collected` (all answered, 2 delivered), `22-ask-pill-answered-all-delivered`, `23-ask-pill-ready-not-sent` ("Tutte insieme", three ready: the pill stays at "Risposte parziali 2/9", the ledger shows "Pronte 3").

## 9. Strings the mockup uses that report §4 does not hold

Report §4 says the change settles these with the PO. The mockup uses (IT / EN):

| Where | String drawn | Note |
|---|---|---|
| "Resta qui" footer | "Continua" / "Continue" | From 1.0.0 |
| Outbox ledger | "Bozze · Pronte · Inviate · Consegnate" / "Drafts · Ready · Sent · Delivered" | From 1.0.0; "Pronte" shows "–" in "Una alla volta" |
| Rail, header | "Indice" (today's `outline.label`), "Avanzamento" / "Progress" | "Avanzamento" is new |
| Blocked primary with nothing chosen | "Scegli un'opzione" / "Choose an option" | §4 covers only field reasons |
| Postponed warning | "Hai 1 domanda rimandata: chiudendo perdi questa richiesta" | Today's EXP string with "rimandata" |
| Agent-change notice | "La tua risposta pronta resta qui finché non scegli." | New in 1.1.0; optional |
| Outline, after a removal | "D3 rimossa dall'agente" / "Q3 removed by the agent" | New in 1.1.0 |
| Live region | "Domanda rimossa dall'agente: {title}." / "Question removed by the agent: {title}." | EXP has "Question removed by the agent" |
| Outbox, "Tutte insieme" | Helper "Le risposte restano qui finché non premi «Invia le risposte»." beside the button "Invia 3 risposte" | Accepted text, but it names a button that now carries a count (§4); a neutral form: "Le risposte restano qui finché non le invii." / "Answers stay here until you send them." |

The mockup applies §4 everywhere it applies: "Ogni risposta parte appena la invii.", "Correggi prima {label}." / "Completa prima {label}.", the completion line, "Invia la modifica" on a revision in "Una alla volta", "Rimandata. Prossima: {title}.", and today's agent pill strings ("Agente: al lavoro", "Agente: attende la tua risposta").

## Other changes in the 1.1.0 mockup

- "Dopo la risposta" defaults to "Vai alla prossima" (PO, 2026-11-14); "Resta qui" and its "Continua" footer are one click away in the strip and in Settings (`03-carta-after-answer-stay-here`).
- "Prossima da fare" is hidden, not disabled, when nothing is left (§6.4, last note).
- The outline's highlight follows the question in view: 1.0.0 picked the topmost of the cards whose visibility had just changed, which could skip a card (F-04, D-2); 1.1.0 keeps the set of cards in view and picks the topmost one.
- The ask pill is back in the header (point 8); the agent pill reads "attende la tua risposta" while something is to do or held, "al lavoro" otherwise.
- "Inchiostro" is gone from the palette switch (report §7: not shipped).
- Not drawn: the note-only primary "Invia la nota" (§3.3.8), tabs, "Comoda" density, connection loss ("Non ancora inviata").

## Checks run

On the mockup, by script (Playwright 1.65):

- Chromium: 63 frames, no console error, no network request, no horizontal page overflow and no overflow of either header row at 1280×800 (the script measures the rows, not items crowding each other inside them: the overlap in `14-postponed-warning-progress-row-crowded` was found by eye); focus and live-region text checked after each act (for example, after "Invia risposta" on D1: focus on D2's heading, "Risposta inviata: PostgreSQL. Prossima: Cache, 2 di 9.").
- Contrast: the token pairs of point 1 for all four palettes, light and dark (only the decorative `border` / `card` falls under 3:1, in all but Contrasto), and the scan of rendered text described there.
- Firefox 159 and WebKit 27.2: one pass each (answer D1 with `Meta+Enter`, advance to D2): same state and focus, no error, no overflow (`31-firefox-after-answer-go-next-light.png`, `31-webkit-after-answer-go-next-light.png`). In the WebKit frame the focused heading shows no ring: programmatic focus after a key press does not match `:focus-visible` there, so the build's arrival mark must not rely on the focus ring alone.

## Not checked

- Firefox and WebKit beyond that one pass: no frame of the points above was taken there.
- A real screen reader (only the live-region text was read), the Ctrl key on Linux, forced colours, `prefers-contrast: more`.
- Inter, the product's font: everything was measured with the system font (point 4).
- "Comoda" density on B's layout, and the tabs presentation.
- The 1600 px and 1920 px viewports in 1.1.0.

## For the PO

Decided: #213, option 1 (PO, 2026-11-15; point 8).

Decision the report leaves to the PO:

1. **The strings of section 9: adopt them as drawn?** Each can be accepted or reworded; **proposed default: as drawn**, with the submitted helper changed to "Le risposte restano qui finché non le invii." / "Answers stay here until you send them.", so it no longer names a button whose label changed.

Decided by the change, unless the PO objects (each changes what the user sees):

2. One question per view keeps the rail with outline and outbox (amends EXP and DES "no rail"); alternative: outbox only.
3. The postponed warning moves to the header's first row, not the progress row the report proposed; alternatives: progress row, outbox.
4. Short question numbers are fixed at first display, with gaps after a removal; alternatives: by position, none.
5. The rail is 256 px (token `outline-rail` from 212 px), ledger in four columns; alternatives: 240 px with a 2×2 ledger, 268 px.
