# Answering flow redesign: design brief (Issue #168)

Version 1.0.0, 2026-11-14. Input: `assessment-1.0.0.md` (findings F-01 to F-26, divergences D-1 to D-6) and
`icons-and-theming-research-1.0.0.md`. This brief fixes the behaviour both UI proposals share and the two
directions that differ. Everything here is a proposal for the PO; nothing is decided.

## 1. The behaviour both proposals share

### 1.1 One ladder of answer states, shown the same way everywhere

Card, outline, navigator markers, progress and completion all use the same four steps, each with an icon and
a text label (never colour alone). A step is shown only when it is true (fail closed, AD-10, AD-3).

| Step | IT | EN | Lucide icon | True when |
|---|---|---|---|---|
| Draft | Bozza | Draft | `pencil` | Something is chosen or typed, not confirmed |
| Held | Pronta, non inviata | Ready, not sent | `package` | Confirmed in "all together" sending, waiting for the board's send |
| Sent | Inviata | Sent | `send` | The board sent it; the agent has not collected it yet |
| Delivered | Consegnata all'agente | Delivered to the agent | `check-check` | The receipt says the agent received it |

Other states: To do (`circle`, "Da fare" / "To do"), Postponed (`clock`, "Rimandata" / "Postponed"),
Declined (`ban`, "Rifiutata" / "Declined"), New from the agent (`bell-dot`, "Nuova" / "New"),
Recommended (`sparkles`, "Consigliata" / "Recommended"), blocked by an error (`circle-alert`).

### 1.2 Wording (replaces the colliding forms of "inviare" and the unclear mode names; F-12, F-15, F-21)

| Today (IT / EN) | Proposed IT | Proposed EN | Why |
|---|---|---|---|
| CONSEGNA / DELIVERY | Invio delle risposte | Sending answers | Names what the control governs |
| Immediata / Immediate | Una alla volta | One by one | Says when, in the user's terms |
| Su invio / Submitted | Tutte insieme | All together | "Su invio" also reads "on Enter"; "Submitted" reads as a state |
| helper, immediate | Ogni risposta parte appena la confermi. | Each answer goes to the agent as soon as you confirm it. | |
| helper, submitted (missing today, D-3) | Le risposte restano qui finché non premi «Invia le risposte». | Answers stay here until you press "Send answers". | |
| Rispondi / Answer (one by one) | Invia risposta | Send answer | The verb says it leaves now |
| Rispondi / Answer (all together) | Conferma | Confirm | It does not send; the state becomes "Pronta, non inviata" |
| (pressing Rispondi again to un-mark) | Modifica | Edit | An explicit way back, not a silent toggle (F-11) |
| Invia le risposte / Submit | Invia N risposte | Send N answers | Carries the count of held answers; absent, not disabled, in "one by one" (F-13) |
| Rinvia / Postpone | Più tardi | Later | "Rinvia" also reads "send again" |
| Rinviata / Postponed | Rimandata | Postponed | |
| N aperte / N open | N da fare (di cui M rimandate) | N to do (M postponed) | "Open" hid the postponed ones |
| Prossima aperta ↓/→ | Prossima da fare | Next to do | One label, one icon (`arrow-right`), one place per presentation (F-07) |
| Seleziona le consigliate / Select recommended | Precompila le consigliate (N) | Prefill recommended (N) | Says it prepares, with how many |
| Altre azioni / More | Altro | More | Menu keeps "Spiega" and "Rifiuta" |
| Accetta la consigliata | stays, placed on the recommended option's row; absent once answered (F-18) | Accept recommended | |

### 1.3 What happens after an answer (F-01, F-02, F-03, F-04)

1. **Feedback first.** The card takes its answered look: the chosen option summarised, the state step with
   icon and text, and "Modifica" / "Edit". A polite status message says what happened, for example
   "Risposta inviata: Database. Prossima: Cache, 2 di 9." (in "all together": "Risposta pronta, non
   inviata…").
2. **Then the way forward.** The next question to do is found from the question just answered, in board
   order, wrapping once; a question the agent just added is offered first only with a visible reason
   ("Nuova dall'agente"). How the user gets there is where the two proposals differ (section 2).
3. **Arrival.** The target is scrolled so its heading sits clear of the sticky bars (`scroll-margin`),
   focus goes to the heading, and the arrival is marked for a moment (a ring or a tinted edge that fades).
   With `prefers-reduced-motion` the jump is instant and the mark does not animate.
4. **No advance** when the act failed or a field is invalid, when the user has already moved focus into
   another question, or when the act revises an answer given earlier.
5. **Areas and tabs.** Leaving the last question of an area says so ("Architettura completata") and moves
   to the next area or tab that has work; the tab strip stays visible.
6. **Last question.** "One by one": a completion panel. "All together": focus goes to "Invia N risposte",
   with the line "Tutte pronte: niente è stato ancora inviato"; the completion panel comes after the send.
7. **Completion panel.** Counts by true state only: "9 inviate, 7 consegnate all'agente". Postponed
   questions keep it from saying "complete": "Restano 2 rimandate" with "Vai alla prima". It never says the
   agent read anything.
8. **Blocked primary.** The card's primary button is never grey without a visible reason beside it:
   "Scegli un'opzione" / "Correggi: Email" (F-20).
9. **Questions the agent adds.** A notice that does not take focus: "L'agente ha aggiunto 1 domanda" with
   "Vai" (F-08).

### 1.4 Prefill recommended (F-16, F-17)

It fills the recommended option as a **draft** on every question still to do that has one, in both sending
modes; it never confirms, never sends, never touches a question the user already worked on. It says what it
did ("4 domande precompilate. Niente è stato inviato.") with "Annulla" / "Undo", shows the count on its
label, and is absent when nothing is left to prefill. It sits with progress and navigation, not with
Snapshot and the send. (Today, in "Su invio", it also marks them ready: making it draft-only is a behaviour
change the PO decides.)

### 1.5 Keys, screen reader, motion (F-24, F-25, F-26)

- Proposed keys, through the key tables: `N` / `Shift+N` next / previous to do (never in a text field);
  `Ctrl/Cmd+Enter` confirm or send the question in focus, only outside text fields and widgets (the
  follow-up composer already sends with it). No default key for sending all held answers:
  `Ctrl/Cmd+Shift+Enter` is already `add.child` in the key vocabulary.
- One polite live region for the flow: sent, ready, delivered count, prefill result, send result, area
  completed, all done, question added or removed. The agent pill stops announcing every change.
- Every transition is 150 to 250 ms, CSS only, and off under `prefers-reduced-motion`.

### 1.6 Themes and icons

- Icons: Lucide, one stroke style, 16 px in controls, always with text or an accessible name.
- Themes: named palettes on the existing tokens (a palette attribute beside the light/dark scheme), each
  with a light and a dark scheme, plus a high-contrast palette. The agent hue (indigo) and the change hue
  (plum) stay distinct from every accent.

## 2. The two directions

### Proposal A: "Guida" (guided session)

For: the business manager first; an engineer who wants rhythm. Idea: the board leads, one decision at a time.

- **Layout.** Left rail as a checklist of the questions by area, each with its state icon. Centre: the
  question in hand is open; answered questions fold to one line (header chip, chosen answer, state,
  "Modifica"); questions to do below are shown collapsed with their title. No header clutter: the header
  keeps title, agent pill, theme and settings.
- **Session bar** (sticky, bottom) holds the whole journey in reading order: progress
  ("3 di 9 · 6 da fare", a segmented bar, one segment per question, coloured and iconed by state),
  "Prossima da fare", "Precompila le consigliate (N)", then at the right the sending group: the mode
  ("Invio delle risposte: Una alla volta | Tutte insieme") with its helper line and, in "all together",
  "Invia N risposte". Snapshot moves to the header's tools.
- **After an answer: advances by itself.** The answered card folds (200 ms), the next one opens and scrolls
  into place, focus on its heading. A setting offers "Dopo la risposta: Vai alla prossima | Resta qui".
- **Look.** Calm and roomy: 14 to 15 px body, 8 px radii, soft surfaces, one accent, large primary button
  next to the options (not at the far right), generous line height.
- **Palettes.** "Carta" (the current Warm Paper & Petrol, refined), "Ardesia" (cool slate and blue),
  "Salvia" (soft green-grey with deep green accent), "Contrasto" (high contrast); each light and dark.

### Proposal B: "Cabina" (cockpit)

For: the engineer first; a manager who wants to see the ledger. Idea: everything in view, the user drives.

- **Layout.** Dense three-zone screen with **no bottom bar**. Header: one progress strip (segments per
  question, clickable), "N da fare", "Prossima da fare" with its key cap, "Precompila le consigliate (N)".
  Left rail: the outline on top and, pinned at its foot, the **outbox**: a small ledger "Bozze 1 · Pronte 3
  · Inviate 2 · Consegnate 1", the sending mode with its helper, and "Invia N risposte". The answer's
  journey to the agent is visible in one place. Centre: all cards of the area, open, in a dense list, each
  with a state stripe on its left edge.
- **After an answer: the user continues.** The card shows its state and a footer line
  "Inviata · Prossima: Cache" with a focused "Continua" button (Enter goes on); the outbox count ticks with
  a short pulse. Nothing scrolls until the user continues. The same setting exists, default "Resta qui".
- **Look.** Compact and technical: 13 px body, 4 px radii, hairline borders, monospace for IDs, key caps and
  counts, key hints visible on the main controls.
- **Palettes.** "Grafite" (graphite with teal accent, dark first), "Inchiostro" (monochrome ink on white),
  "Nordico" (blue-grey), "Contrasto" (high contrast); each light and dark.

## 3. What each mockup must show

One self-contained HTML file per proposal (no network, system fonts, inline SVG icons taken from Lucide,
CSS variables for every colour), on the same sample board the assessment used: "Servizio ordini: decisioni
di lancio", nine questions in three areas (Architettura: Database, Cache, Coda; Rilascio: Catalogo, Rollout,
Flag; Costi: Budget, Monitoraggio, Regione), four with a recommended option, one with two text fields (one
required, one with a pattern), realistic option texts. It must work, not only look:

- answer a question and see the transition to the next, in both sending modes;
- held answers, then the send; the completion panel; a postponed question keeping completion open;
- a validation error with the visible reason on the primary button;
- prefill recommended with its count, message and undo;
- a simulated receipt: "Inviata" becomes "Consegnata all'agente" a few seconds later, and a button
  "Simula: l'agente aggiunge una domanda";
- switches in a clearly separate "mockup controls" strip: palette (four), scheme (light, dark), language
  (IT, EN), sending mode, presentation (sections, one question per view), annotations on or off;
- annotations: numbered callouts on the controls, each citing the findings it answers (F-xx);
- keyboard: the proposed keys work; focus is always visible; a polite live region speaks the flow;
  `prefers-reduced-motion` respected.
