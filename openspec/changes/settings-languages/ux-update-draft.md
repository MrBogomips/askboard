# UX update draft: settings-languages (E8)

Nine blocks, each for one of the proposal's open questions in group A. A block applies only if the PO accepts the choice made there; a question the PO reverses leaves its block unapplied, and the change is revised with `/opsx:update`. Each block quotes the current text exactly, then gives the replacement.

**Accepted, not applied yet.** The PO accepted every block on 2026-11-01 (decisions-5: open questions A1 and A7 to A10, as proposed); task 11.2 applies them.

**Open before 11.2** (recorded before group 0, on 2026-11-01):

- The date refusal texts in block 2's row "Number and date entry" differ from those built in task 2.4, which follow the Gantt's `gantt/model/date.ts` at 1d05f07 ("Write the date as month/day/year, as in 12/9/2026", "November 2026 has no day 31", and their Italian mirror). The PO decides; the default is the Gantt's wording, with that row amended (design decision 8).
- Block 2 needs rows for three strings the view shows on `main`, which task 7.1's catalogue holds with provisional Italian: "The board could not be loaded: {reason}" ("Impossibile caricare la board: {reason}"), "This item could not be shown." ("Impossibile mostrare questo elemento.") and "Loading" ("Caricamento").

Files: `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (blocks 1 to 8) and `docs/ux-askboard-2026-10-27/DESIGN.md` (block 9). Both win over the mockups, which are not changed: the settings mock's sample files and the missing key names are superseded by blocks 5 and 9.

How to apply: replace each quoted passage, then run `openspec validate --all --strict --no-interactive`. E5's UX draft also edits the Voice and Tone rows "Context column" and "Reading panel" (its block 4) and Open Items 20 (its block 6.2): if those are applied first, keep their English cells, set the Italian cells as below, and quote block 8's E5 variant.

## Block 1: Voice and Tone, the Italian column (open question A9)

The table keeps its rows, its English and Source cells, and its order. In each row, named by its exact "Where" cell, the Italian cell changes as follows. Every new Italian string is provisional and marked "(to review)"; the strings in angle brackets are slots, filled at run time.

| Where (unchanged) | Italian cell now | Italian cell after |
| --- | --- | --- |
| Browser tab | — | "<title> · AskBoard" (to review) |
| Who asked | — | "Agente principale · <name>", "Subagente <type> · <name>" (per esempio, "Subagente code-reviewer · Retry review"); senza nome visualizzato "Agente principale" o "Subagente <type>"; un secondo subagente dello stesso tipo "Subagente code-reviewer #2" (to review) |
| Expected answerer | — | "Per: <name>" (to review) |
| Header fields | — | "Progetto", "Cartella", "Branch", "Worktree" (to review) |
| Ask state | — | "In attesa", "Risposte parziali 1/3", "Con risposta", "Chiusa", "Scartata"; con domande rinviate o rifiutate "con risposta, 1 rinviata", "con risposta, 1 rifiutata" (to review) |
| Agent state | — | "Agente: al lavoro", "Agente: attende la tua risposta" (to review) |
| Header labels | — | "Richiesta" prima dello stato della richiesta, "Tema" prima del controllo del tema (to review) |
| Count and jump | — | "2 aperte", "Prossima aperta ↓"; nel navigatore delle domande "Prossima aperta →"; "1 nuova risposta" (to review) |
| Quick toggles | — | "Tema" ("Sistema", "Chiaro", "Scuro"), "Compatta" / "Comoda", "Impostazioni" (to review) |
| Outline | — | "Indice", "Senza risposta", "Nuova" (to review) |
| Question navigator | — | "Domanda n di m", "Precedente", "Successiva", "Domanda rimossa dall'agente" (to review) |
| Options | — | "Opzioni · scegline una", "Consigliata", "Accetta la consigliata", "+ Aggiungi una nota a questa opzione", prefisso delle annotazioni dell'agente "Agente:", "Altro…", "Mostra anteprima" (to review) |
| Question actions | — | "Rispondi"; "Altre azioni", che contiene "Spiega" (invia "Perché me lo chiedi, e cosa cambia con ciascuna opzione?") e "Rifiuta" (to review) |
| Open prompt | — | "Nota per l'agente (facoltativa)"; "Motivo delle modifiche (obbligatorio)" mentre è selezionato "Approva con modifiche" (to review) |
| Postpone | — | "Rinvia" (to review) |
| Delivery receipt | "consegnata all'agente" (for "delivered to the agent"); the others — | "non ancora inviata", "inviata" (to review), "consegnata all'agente" |
| Reopened question | — | "Riaperta dall'agente", "Parti dalla mia risposta precedente" (to review) |
| Follow-up | — | "Chiarimenti", "2 messaggi", "ancora nessun messaggio", "Chiedi un chiarimento", "Comprimi", campo di testo "Chiedi un chiarimento all'agente…", "Invia"; ora del messaggio "17:42" in it-IT (to review) |
| Context column | — | "Estratto e riferimenti", "Accanto \| In linea", "si apre in un pannello di lettura", "si apre nel browser ↗", "Apri nel pannello di lettura", etichette di tipo "FILE", "GITHUB" (to review) |
| Reading panel | — | "Apri nell'editor", "Modificato dopo la domanda dell'agente" (to review) |
| Settings panel | — | "Tema", "Densità", "Posizione del contesto", "Lingua", "Lingua predefinita", "Regole per le domande", "Cartella degli Snapshot", "Editor"; la nota "Si applica dalla prossima sessione" sopra le impostazioni di comportamento (to review) |
| Diff review | — | "Correzione A \| Correzione B \| A vs B", "Affiancata \| Unificata", "Accetta il file", "Rifiuta il file", "Accettata", "Rifiutata", "Modifica" (su un commento di riga); una sequenza compressa di righe invariate, etichettata con l'intestazione del blocco come la dà il diff ("@@ -41,8 +41,10 @@ …") (to review) |
| Graph | — | "Aggiungi stato", "Aggiungi transizione", "Elimina", "Commenta", "Disposizione automatica", "Controlli", "Modifiche rispetto all'originale dell'agente", "ancora nessuna" (to review) |
| Diagram | — | "Diagramma \| Sorgente", "Annota", "Le tue modifiche: 1 annotazione"; senza modifiche, "Modifiche rispetto all'originale dell'agente · ancora nessuna" (to review) |
| Approval | — | "Approva", "Approva con modifiche", "Respingi"; l'etichetta "Approvazione" sopra i pulsanti e il titolo del riepilogo "2 modifiche" (con il numero); l'errore del campo per un motivo obbligatorio vuoto, "Aggiungi il motivo delle modifiche." (to review) |
| Ranking and Kanban | — | "Mantieni quest'ordine", "Sposta su", "Sposta giù", "Sposta in…" (to review) |
| Sales estimate review | — | "Totale", "Margine", "inclusa" / "esclusa" per una riga facoltativa (to review) |
| WBS with PERT | — | Colonne "Pacchetto di lavoro", "Ottimistica", "Più probabile", "Pessimistica", "Stima attesa", "Scarto" (to review) |
| Gantt plan | — | Colonne "Attività", "Inizio", "Durata"; zoom "Giorno \| Settimana \| Mese" (to review) |
| Bottom action bar | — | "Consegna", "Immediata \| Su invio", "Le risposte arrivano all'agente man mano che le dai.", "Seleziona le consigliate", "Snapshot", "Invia le risposte" (to review) |
| Agent-change notice | — | "L'agente ha aggiornato questa domanda", "Le tue 17 modifiche a questa domanda" (con il numero), "Mostra la modifica dell'agente", "Ricarica, perdendo il mio lavoro", "Tieni le mie" (to review) |
| Deleted item | — | "Rimosso dall'agente" (to review) |
| Board banner | — | "Connessione persa, nuovo tentativo in corso"; "Il lavoro non inviato non è stato inviato", "Copia il mio lavoro non inviato"; "Continua qui" (to review) |
| Postponed warning (bottom action bar) | — | "Hai 1 domanda rinviata: chiudendo perdi questa richiesta", "Hai 2 domande rinviate: chiudendo perdi questa richiesta" (to review) |
| Snapshot | — | "Il lavoro non inviato non sarà nello Snapshot"; su un riferimento a un file del progetto, "non disponibile in uno Snapshot"; la riga in alto di uno Snapshot aperto, "Snapshot · creato il 28 ott 2026, 16:12 dall'agente · sola lettura" (to review) |

The paragraph above the table keeps its text, except its last sentence:

Current:

```text
The Italian column is the worksheet for the it-IT pass; "—" marks a string not yet given (Open Items 4).
```

Replacement:

```text
The Italian column holds the it-IT strings, written by the OpenSpec change `settings-languages`; those marked "(to review)" wait for a native review.
```

## Block 2: Voice and Tone, rows for strings EXPERIENCE does not record (open questions A1, A8, A9, A10)

After the row "Settings panel" (as block 1 leaves it), add these rows. The second group comes from E3, E5 and E7, whose drafts add the English strings; apply each of those rows only once its change's own draft has added the English, or add the row whole if that draft is not applied.

New rows, this change:

```text
| Settings panel states | "Settings" (the panel's title), "Close settings" (the ✕); "default"; "also in <file>: <value> (not used)"; "Set by the project: <file> · <key>"; "Not applied: <problem>", with "not valid JSON", "version <version> is not supported" or "invalid value at <pointer>"; "Unknown key ignored: <key>"; "Ignored in <file>: AskBoard takes the editor only from your user settings"; "Ignored: other users can change <file>"; "Outside the project: .askboard/snapshots/ is used instead"; "Could not save to <path>: <reason>"; "Not saved: the project sets this"; "Not saved: <path> is not applied" (to review) | "Impostazioni", "Chiudi le impostazioni"; "predefinito"; "anche in <file>: <value> (non usato)"; "Impostato dal progetto: <file> · <key>"; "Non applicato: <problem>", con "JSON non valido", "la versione <version> non è supportata" o "valore non valido in <pointer>"; "Chiave sconosciuta ignorata: <key>"; "Ignorato in <file>: AskBoard prende l'editor solo dalle tue impostazioni utente"; "Ignorato: altri utenti possono modificare <file>"; "Fuori dal progetto: si usa .askboard/snapshots/"; "Impossibile salvare in <path>: <reason>"; "Non salvato: lo imposta il progetto"; "Non salvato: <path> non è applicato" (to review) | OpenSpec change `settings-languages` (A1, A10) |
| Language indicator | "English (en-US)"; with other formats, "English (en-US) · formats it-IT" (to review) | "Italiano (it-IT)"; con altri formati, "Italiano (it-IT) · formati en-US" (to review) | DESIGN, Language indicator; OpenSpec change `settings-languages` (A10) |
| Number and date entry | "Write the number in full, without an exponent."; "\"<character>\" is not part of a number: use digits, as in 1,234.5."; "Put at most one sign, before the digits."; "Type digits, as in 1,234.5."; "Use one decimal point at most."; "Put digits on both sides of the decimal point, as in 0.5."; "Use commas only between groups of three digits, as in 1,234.5."; "The number is too large."; "Type a date as 12/9/2026 or 2026-12-09."; "There is no such day." (to review) | "Scrivi il numero per intero, senza esponente."; "\"<character>\" non fa parte di un numero: usa le cifre, come in 1.234,5."; "Metti al massimo un segno, prima delle cifre."; "Scrivi delle cifre, come in 1.234,5."; "Usa al massimo una virgola decimale."; "Metti delle cifre prima e dopo la virgola decimale, come in 0,5."; "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5."; "Il numero è troppo grande."; "Scrivi una data come 9/12/2026 o 2026-12-09."; "Questo giorno non esiste." (to review) | `tree-widget` open question 7; OpenSpec change `settings-languages` (A8) |
| Board banner, ended board | "This board moved to another tab.", "This ask was discarded. The board is read-only." (to review) | "Questa board si è spostata in un'altra scheda.", "Questa richiesta è stata scartata. La board è in sola lettura." (to review) | E1's board page; Open Items 5 |
```

New rows, strings other changes add:

```text
| Delivery mode switch (E3) | "Switch to immediate delivery?", "Your held work goes to the agent now, in the order you gave it.", "Cancel", "Send and switch"; "1 update needs a choice" (to review) | "Passare alla consegna immediata?", "Il lavoro in attesa va subito all'agente, nell'ordine in cui l'hai dato.", "Annulla", "Invia e passa"; "1 aggiornamento richiede una scelta" (to review) | OpenSpec change `ask-lifecycle`, design decision 6 |
| Outline labels and marks (E3) | "Ready", "Answered", "Postponed", "Declined"; "Previous answer"; "Options" over a multiple choice; "Agent" as a reply's author; "1 message", "Your 1 change on this question" (to review) | "Pronta", "Con risposta", "Rinviata", "Rifiutata"; "Risposta precedente"; "Opzioni"; "Agente"; "1 messaggio", "La tua 1 modifica a questa domanda" (to review) | OpenSpec change `ask-lifecycle`, design decision 6 |
| Context and reading panel (E5) | "Unresolved" with the pointer; "This file is not available"; "This file cannot be shown as text"; "This file is too large to show here"; "No editor set: `editor` in ~/.config/askboard/config.json"; "Could not start the editor"; "WEB" (to review) | "Non risolto"; "Questo file non è disponibile"; "Questo file non si può mostrare come testo"; "Questo file è troppo grande per mostrarlo qui"; "Nessun editor impostato: `editor` in ~/.config/askboard/config.json"; "Impossibile avviare l'editor"; "WEB" (to review) | OpenSpec change `excerpts`, open question A14 |
| Snapshot (E7) | "· your unsent work is not included"; "by <who>" (to review) | "· il lavoro non inviato non è incluso"; "da <who>" (to review) | OpenSpec change `snapshot`, open questions B5 and B6 |
```

## Block 3: Localization, formats and the Italian microcopy (open questions A7 and A9)

### 3.1 The "Values" bullet

Current:

```text
- **Values.** Values travel in the contract's formats: RFC 3339 dates, decimal money with an ISO 4217 code, durations in whole days. They are formatted for display only, and NumberField and MoneyField parse input with AskBoard's own parser (Primitives, Input atoms). Derived values ignore locale and time zone (AD-7, AD-13, TC §1.2, F-26). An Italian sample, after the font preview: "€ 12.480,00 · 27/10/2026 · margine 18,5% · 1.240 h".
```

Replacement:

```text
- **Values.** Values travel in the contract's formats: RFC 3339 dates, decimal money with an ISO 4217 code, durations in whole days. They are formatted for display only, and NumberField and MoneyField parse input with AskBoard's own parser (Primitives, Input atoms). Derived values ignore locale and time zone (AD-7, AD-13, TC §1.2, F-26). An Italian sample, after the font preview: "€ 12.480,00 · 27/10/2026 · margine 18,5% · 1.240 h".
- **Formats.** AskBoard formats with its own tables, the same in every browser: numbers `1,234.5` and `1.234,5`; money `€12,480.00` and `€ 12.480,00`, a currency without a symbol as its code (`CHF 12.480,00`); percentages `18.5%` and `18,5%`; dates `10/27/2026` and `27/10/2026`; long dates `Tue, Oct 27, 2026` and `mar 27 ott 2026`; times `4:12 PM` and `16:12`, in the viewer's time zone. A calendar date never shifts with the time zone.
```

### 3.2 The "Open" bullet

Current:

```text
- **Open.** The Italian microcopy: Open Items 4.
```

Replacement:

```text
- **Italian microcopy.** Written by the OpenSpec change `settings-languages` (open question A9), each string marked "(to review)" in Voice and Tone until the review.
```

## Block 4: Component Patterns, Primitives, "Input atoms" (open question A8)

Current:

```text
| **Input atoms** | TextField, NumberField, MoneyField, DateField, Choice, Toggle and Slider return the typed answers below. Each starts empty or unset; in a widget that reviews agent content (Table, Tree, a Form over agent values), it starts from the agent's value, and an untouched value is reported unchanged. Typing never answers: a value becomes an answer only through the question's "Answer" and the delivery mode. Atoms show and accept input in the ask's locale, en-US or it-IT, and return the contract's formats (AD-7). NumberField and MoneyField are text inputs with AskBoard's own parser for the ask's locale, never the browser's number input: input that is ambiguous in that locale is refused with a message, and the parsed value is echoed beside the field ("= 12.5"). | FR-13, AD-10, AD-20, L160, L168, L169, F-26 |
```

Replacement:

```text
| **Input atoms** | TextField, NumberField, MoneyField, DateField, Choice, Toggle and Slider return the typed answers below. Each starts empty or unset; in a widget that reviews agent content (Table, Tree, a Form over agent values), it starts from the agent's value, and an untouched value is reported unchanged. Typing never answers: a value becomes an answer only through the question's "Answer" and the delivery mode. Atoms show and accept input in the ask's locale, en-US or it-IT, and return the contract's formats (AD-7). NumberField and MoneyField are text inputs with AskBoard's own parser for the ask's locale, never the browser's number input: input that is ambiguous in that locale is refused with a message, and the parsed value is echoed beside the field ("= 12.5"). In en-US, `.` is the one decimal mark and `,` stands only between groups of three digits; it-IT swaps them, so `1.234,5` is 1234.5 and `1234.5` or `1.23` is refused. The echo writes the value without grouping ("= 1234,5"). DateField reads `M/D/YYYY` in en-US and `D/M/YYYY` in it-IT, and `YYYY-MM-DD` in both, and echoes the day with its weekday ("= mer 9 dic 2026"). | FR-13, AD-10, AD-20, L160, L168, L169, F-26, OpenSpec change `settings-languages` (A8) |
```

## Block 5: Component Patterns, Board chrome, "Read-only setting" and "Language indicator" (open question A10)

### 5.1 Read-only setting

Current:

```text
| **Read-only setting** | A setting the board does not write: its value, with the configuration file and key to edit, and no control. It applies from the next session (Preferences and Settings). The keys for the asking rule and the Snapshot folder are not named yet (pending ACR-02); until then those rows show the file alone. | L171, AD-14 |
```

Replacement:

```text
| **Read-only setting** | A setting the board does not write: its value in effect, with the configuration file and key that set it, and no control. A key set in neither file shows its default, marked "default", with the user file and key that would set it; a key both files set adds the other file's value, marked as not used, so both levels show (FR-35). It applies from the next session (Preferences and Settings). | L171, AD-14 |
```

### 5.2 Language indicator

Current:

```text
| **Language indicator** | The ask's current language, read-only, in the settings panel's Language row (`{components.language-indicator}`). It offers no choice: another language means a new ask (Localization). | L169, L179 |
```

Replacement:

```text
| **Language indicator** | The ask's current language, read-only, in the settings panel's Language row (`{components.language-indicator}`). It offers no choice: another language means a new ask (Localization). When the ask's formats differ from its language, it names them: "English (en-US) · formats it-IT". | L169, L179 |
```

## Block 6: Preferences and Settings, "Scopes" and "Open" (open questions A1 and A10)

### 6.1 Scopes

Current:

```text
- **Scopes.** User and project (L40). The project-level asking rule wins (FR-30), and project keys win over user keys (AD-14). The board writes only theme, density and the context-placement default, to the user scope. Every other setting, and every project-scope value, is read-only on the board, with the file and key to edit, so the board never writes a command to run (L171, pending ACR-02).
```

Replacement:

```text
- **Scopes.** User and project (L40). The project-level asking rule wins (FR-30), and project keys win over user keys (AD-14). The board writes only theme, density and the context-placement default, to the user scope; one of them set in the project file shows read-only like a behavioural setting, and its quick toggle is disabled, naming the file and key. Every other setting, and every project-scope value, is read-only on the board, with the file and key to edit, so the board never writes a command to run (L171, pending ACR-02).
```

### 6.2 Open

Current:

```text
- **Open.** Open Items 20.
```

Replacement:

```text
- **Problems.** A configuration file that fails its check is not applied, none of its keys, and the panel says so, naming the file and the problem. An unknown key, an editor set in the project file, which AskBoard never uses, and a Snapshot folder outside the project each show a warning on their row (State Patterns).
```

## Block 7: State Patterns, By surface, the settings panel (open questions A1 and A10)

Current:

```text
| Settings panel | Snapshot folder outside the project | Replaced by the default, with a warning. | AD-14 |
```

Replacement (the row stays; four rows follow it):

```text
| Settings panel | Snapshot folder outside the project | Replaced by the default, with a warning. | AD-14 |
| Settings panel | Configuration file not applied | The file's path and its problem, above the behavioural settings; none of its keys applies. | AD-14 |
| Settings panel | Editor set in the project file | The Editor row shows the user's editor, or none, with "Ignored in <file>: AskBoard takes the editor only from your user settings". | AD-8, AD-14 |
| Settings panel | Preference set in the project file | Read-only setting, with the file and key; the header's toggle for it is disabled. | AD-14 |
| Settings panel | Preference write refused | An error under its row: set by the project, or the user file not applied. | AD-14 |
```

## Block 8: Open Items 4 and 20 (open questions A9 and A10)

### 8.1 Open Items 4

Current:

```text
4. **Italian microcopy.** Every Italian string except "consegnata all'agente" is missing (Voice and Tone). It is needed before the stories, since it-IT ships in release zero (L169; validation F-85).
```

Replacement:

```text
4. **Italian microcopy.** Written by the OpenSpec change `settings-languages` (open question A9): every Italian string is in Voice and Tone, marked "(to review)" until the review.
```

### 8.2 Open Items 20

Current (as on `main`):

```text
20. **Settings panel.** The scope precedence for theme, density and context placement, and what "Open in editor" does while no editor is set. The files shown on the read-only rows in the settings mock are sample values, pending the scope rule.
```

Or, if E5's UX block 6.2 was applied first:

```text
20. **Settings panel.** The scope precedence for theme, density and context placement. The files shown on the read-only rows in the settings mock are sample values, pending the scope rule. While no editor is set, "Open in editor" is disabled and names the key (Preferences and Settings, Editor; OpenSpec change `excerpts`, open question A3).
```

Replacement:

```text
20. **Settings panel.** Decided by the OpenSpec change `settings-languages` (open question A10): project keys win and show read-only, presentation preferences included, with their quick toggles disabled, and each row names its real file and key. While no editor is set, "Open in editor" is disabled and names the key (Preferences and Settings, Editor; OpenSpec change `excerpts`, open question A3).
```

## Block 9: DESIGN.md, the settings panel, the Language indicator and Open Items 5 (open question A10)

### 9.1 Components, Board chrome, "Settings panel"

Current:

```text
| **Settings panel** | **Surface.** `settings-panel`, in the Reading panel's form (Context, Reading panel): the same side sheet, surface, width and shadow, opened by the "Settings" button at the right end of header row 2 (L204).<br>**Anatomy.** A header, with a bottom border, holds the title "Settings", semibold, and the close control, a square `button-secondary` with ✕. The body holds three groups separated by `{colors.border}` rules (L211):<br>• the presentation preferences, its only editable rows, each a label in `{typography.label}` and `{colors.muted-foreground}` beside a segmented control: Theme ("System \| Light \| Dark"), Density ("Compact \| Comfortable") and Context placement ("Beside \| Inline") (L171; pending ACR-02);<br>• the board's language (Language indicator);<br>• the behavioural settings, under the group note "Applies from the next session" in `{typography.body}` and `{colors.muted-foreground}`, each a read-only setting: default language, asking rules, Snapshot folder and editor (L171).<br>The labels and the group note are provisional (L209).<br>**States.** A failed write shows a `field-error` under its row, with the settings file's path (F-80).<br>Mock: [key-settings-panel](mockups/key-settings-panel.html); not mocked: the failed write. |
```

Replacement:

```text
| **Settings panel** | **Surface.** `settings-panel`, in the Reading panel's form (Context, Reading panel): the same side sheet, surface, width and shadow, opened by the "Settings" button at the right end of header row 2 (L204).<br>**Anatomy.** A header, with a bottom border, holds the title "Settings", semibold, and the close control, a square `button-secondary` with ✕. The body holds three groups separated by `{colors.border}` rules (L211):<br>• the presentation preferences, its only editable rows, each a label in `{typography.label}` and `{colors.muted-foreground}` beside a segmented control: Theme ("System \| Light \| Dark"), Density ("Compact \| Comfortable") and Context placement ("Beside \| Inline") (L171; pending ACR-02);<br>• the board's language (Language indicator);<br>• the behavioural settings, under the group note "Applies from the next session" in `{typography.body}` and `{colors.muted-foreground}`, each a read-only setting: default language, asking rules, Snapshot folder and editor (L171).<br>The labels and the group note are provisional (L209).<br>**States.** A failed or refused write shows a `field-error` under its row, with the settings file's path (F-80). A configuration file that is not applied shows once, above the behavioural group, as a `field-error` with the file's path and its problem. A row's warning (an unknown key, an editor set in the project file, a Snapshot folder outside the project) sits under its file line in `{typography.body}` and `{colors.muted-foreground}`. A presentation preference set in the project file shows as a read-only setting in place of its segmented control.<br>Mock: [key-settings-panel](mockups/key-settings-panel.html); not mocked: the failed write. |
```

### 9.2 Components, Board chrome, "Language indicator"

Current:

```text
| **Language indicator** | `language-indicator`: the board's current language and locale as read-only text, such as "English (en-US)" in `{typography.body}`, under a "Language" label (provisional), alone in the settings panel's second group (L211). It takes the read-only setting's look without the file line, since the agent sets the language per ask (L169, L179). No control anywhere on the board changes the language. Mock: [key-settings-panel](mockups/key-settings-panel.html). |
```

Replacement:

```text
| **Language indicator** | `language-indicator`: the board's current language and locale as read-only text, such as "English (en-US)", or "English (en-US) · formats it-IT" when the formats differ, in `{typography.body}`, under a "Language" label (provisional), alone in the settings panel's second group (L211). It takes the read-only setting's look without the file line, since the agent sets the language per ask (L169, L179). No control anywhere on the board changes the language. Mock: [key-settings-panel](mockups/key-settings-panel.html). |
```

### 9.3 Open Items 5

Current:

```text
5. **Width behaviour.** Nothing is recorded below the 1280px floor (EXPERIENCE.md, Open Items) or for a maximum content width above it; golden-1-base capped its content at 1440px with 24px gutters, as an illustration only. Header row 2 has not been checked with the Italian strings, which ship from release zero (L169, F-47).
```

Replacement:

```text
5. **Width behaviour.** Nothing is recorded below the 1280px floor (EXPERIENCE.md, Open Items) or for a maximum content width above it; golden-1-base capped its content at 1440px with 24px gutters, as an illustration only. Header row 2 is checked with the Italian strings at the 1280px floor by the browser tests of the OpenSpec change `settings-languages` (L169, F-47).
```
