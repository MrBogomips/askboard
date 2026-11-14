# Proposta di modifica: scorciatoie da tastiera, aiuto contestuale e skill `askboard-help`

- **Versione:** 1.1.0, 2026-11-08. Sostituisce la 1.0.0, che resta invariata accanto a questa.
- **Novità rispetto alla 1.0.0:** pulsanti visibili e selezione col mouse per le nuove azioni (4.1); pulsante "Tasti" e perimetro del pannello (5); alias Cmd/Ctrl+Shift+↑/↓ per in cima / in fondo (4); tasti per le azioni fuori vocabolario (4.2); test della fonte unica in entrambe le direzioni (6). Vengono dalla revisione indipendente del documento: tre decisioni del PO, una dell'agente (sezione 12).
- **Origine:** test end-to-end del PO su `main` 433b4d29, test 2.4 (Ranking). Il PO ha dovuto chiedere quali tasti usare: la board non lo dice.
- **Stato:** contenuto concordato con il PO in chat, parte per parte (sezioni 3–8). Va tradotto in una change OpenSpec con il flusso del progetto (`askboard-architect` → `openspec-propose`): questo documento è l'input, non la change.
- **Per chi la riceve:** vedi la sezione 11, "Presa in consegna".

## 1. Perché

AskBoard ha già una tastiera in quasi tutti i widget, ma l'utente non la scopre. Mancano due cose: un indizio nel widget e un posto dove chiedere. Nei widget a lista (Ranking, Kanban, Timeline) mancano inoltre gesti che l'utente si aspetta: selezionare una riga o un intervallo e spostarli su, giù, in cima o in fondo. Oggi le frecce muovono solo il cursore, e per spostare bisogna andare sui pulsanti della barra.

## 2. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- Ogni azione di modifica di ogni widget ha una scorciatoia comoda, presa da un vocabolario comune a tutti i widget.
- Le scorciatoie si scoprono nel widget: al passaggio del mouse e al focus su un comando compare il nome con il tasto; `?` apre il pannello dei tasti del widget.
- Una skill `askboard-help` risponde nel terminale alle domande dell'utente sull'uso di AskBoard.
- Tutti i widget già costruiti vengono controllati e adeguati allo standard.
- Le skill di progettazione, implementazione e revisione del progetto rendono questo passo obbligatorio per ogni widget futuro.

**Non obiettivi**
- Nessun obiettivo WCAG formale: resta valida la decisione registrata "best effort + nucleo tastiera" (`docs/ux-askboard-2026-10-27/.memlog.md`, NFR-12).
- Scorciatoie globali della board (passare da una domanda all'altra, inviare tutto): fuori da questa proposta, salvo che il costruttore le trovi necessarie per il pannello `?`.
- Personalizzare i tasti.

**Anti-obiettivi** (fallimento anche se "funziona")
- I tasti descritti nel tooltip, nel pannello, nella skill e nei riferimenti divergono da quelli che il widget esegue.
- Una scorciatoia ruba un tasto al browser o al sistema (cronologia, scorrimento, selezione per parola nei campi).
- Widget diversi usano tasti diversi per la stessa azione.

## 3. Stato attuale (inventario del 2026-11-08, su 433b4d29)

| Widget | Tastiera oggi | Lacune | Tasti visibili |
|---|---|---|---|
| Tree | completa (`packages/widgets/src/tree/model/keys.ts`): frecce, Home/End, Spazio seleziona, Shift+↑/↓ estende, Alt+Shift+↑/↓ sposta, Alt+Shift+←/→ indenta/disindenta, Canc/Backspace elimina, Invio/F2 modifica, Esc annulla, Ctrl/Cmd+Z annulla | manca in cima / in fondo | parziale: tooltip "Etichetta (tasti)" e `aria-keyshortcuts` sulla barra (`tree/toolbar.tsx:57`, `:257`) |
| Gantt | parziale: griglia (`gantt/model/keys.ts`, `grid-keys.ts`), zoom, ridimensionamento colonna | trascinamento delle barre solo col mouse (la griglia inizio/durata fa da percorso da tastiera) | no |
| Molecole `gantt-plan`, `wbs-pert` | ereditata da Tree e Gantt | da verificare | no |
| Approval | completa (Radix) | — | no |
| Scale | completa, anche dallo stato "non impostato" | — | no |
| Ranking | frecce e Home/End muovono il cursore (`ranking/keys.ts`); lo spostamento passa solo dai pulsanti della barra | nessuno spostamento diretto, nessuna selezione multipla, niente in cima / in fondo | no |
| Kanban | frecce muovono il cursore (`kanban/keys.ts`); lo spostamento passa dal menu "Move to…" | nessuno spostamento diretto | no |
| Timeline | ↑/↓/Home/End muovono il cursore (`timeline/keys.ts`); lo spostamento passa dai pulsanti | nessuno spostamento diretto | no |
| Chart | completa: frecce, Spazio/Invio (`chart/widget.tsx:145`) | — | solo per screen reader (`chart.hint`, `sr-only`) |
| LaTeX | textarea nativa | nessun requisito di tastiera nelle specifiche | no |
| Campi (text, number, money, date, toggle, pick), Tabs, choice | nativi o Radix | calendario del DateField da verificare | no |

Oggi in nessun widget esiste un pannello di aiuto. Nelle specifiche (`openspec/specs/view-and-widgets/spec.md`) ogni widget ha un requisito "at the keyboard", ma nessun requisito dice come l'utente scopre i tasti. Le skill `askboard-architect`, `askboard-implementation` e `askboard-review-protocol` non nominano mai la tastiera.

## 4. Il vocabolario comune dei tasti (deciso dal PO: "estendere il vocabolario del Tree")

Il Tree è il riferimento: i suoi tasti diventano lo standard di tutti i widget a lista, e a questo si aggiunge "in cima / in fondo".

| Azione | Tasti | Note |
|---|---|---|
| Spostare il cursore | ↑ / ↓ (← / → dove c'è un secondo asse) | invariato |
| Primo / ultimo elemento | Home / End | invariato |
| Selezionare / deselezionare la riga corrente | Spazio | dal Tree |
| Estendere la selezione (intervallo) | Shift+↑ / Shift+↓ | dal Tree |
| Spostare la selezione su / giù | Alt+Shift+↑ / Alt+Shift+↓ | dal Tree; su Mac Option+Shift |
| Spostare la selezione in cima / in fondo | Alt+Shift+Home / Alt+Shift+End, e l'alias **Cmd/Ctrl+Shift+↑ / ↓** | **nuovo**; l'alias vale su tutte le piattaforme, perché sui MacBook Home/End richiedono Fn (deciso dal PO) |
| Modificare / confermare / annullare | Invio o F2 / Invio / Esc | dal Tree, dove c'è testo da modificare |
| Eliminare | Canc / Backspace | solo dove l'azione esiste |
| Annullare | Ctrl/Cmd+Z | solo dove l'azione esiste |
| Aprire il pannello dei tasti | `?` (fuori dai campi di testo), oppure il pulsante "Tasti" | **nuovo**; Esc lo chiude |

Regole:
- Le frecce con Alt+Shift seguono l'asse del widget. Nel Kanban Alt+Shift+←/→ porta la card nella colonna accanto. Nella Timeline ←/→ spostano prima o dopo nel tempo e ↑/↓ cambiano corsia. Il dettaglio per widget è una scelta del costruttore (sezione 9).
- Una scorciatoia agisce sulla selezione se c'è, altrimenti sulla riga corrente.
- Restano validi i vincoli già nel codice del Tree: un tasto con modificatori diversi non è del widget (Alt+←/→ è la cronologia del browser), Backspace non deve far tornare indietro WebKit, durante la composizione IME i tasti non sono del widget, e in un campo Alt+Shift+freccia resta la selezione per parola.
- Ogni pulsante della barra resta: la scorciatoia è un'aggiunta, non un sostituto.

### 4.1 Controlli visibili per le nuove azioni (deciso dal PO)

- Ranking, Kanban e Timeline ricevono nella barra i pulsanti **"In cima"** e **"In fondo"** (nella Timeline: prima e ultima corsia, o inizio e fine, secondo l'asse), con tooltip e `aria-keyshortcuts` come gli altri comandi.
- Ranking, Kanban e Timeline ricevono la **selezione col mouse**, come nel Tree: un clic seleziona, Shift+clic estende l'intervallo. I pulsanti di spostamento agiscono sulla selezione.
- Le stringhe nuove vanno in `en-US` e `it-IT`. Se la barra si affolla, si usa un menu "Altro" come quello che il Tree ha già.

### 4.2 Azioni fuori dal vocabolario (scelta dell'agente)

Alcune azioni esistenti non hanno un tasto nella tabella sopra:
- Tree: "Add after", "Add child", "Select all", "Select none", aggiustamento percentuale;
- Ranking: "Keep this order";
- Approval: le tre decisioni;
- Gantt: interruttore del percorso critico e zoom.

L'architetto propone i loro tasti estendendo la tabella con le stesse regole: stesso tasto per la stessa azione in tutti i widget, nessun tasto rubato al browser (per esempio Ctrl+A nei campi; su Mac non c'è il tasto Ins). La tabella estesa va tra le "Open questions for the PO" della change: il PO la approva prima che si scrivano le specifiche.

## 5. Aiuto contestuale nel widget (deciso dal PO)

- **Tooltip** al passaggio del mouse **e** al focus su ogni comando: nome dell'azione e tasti, come fa oggi il Tree.
- **`aria-keyshortcuts`** su ogni comando che ha una scorciatoia, così anche lo screen reader le annuncia.
- **Pannello dei tasti**: un piccolo pannello con tutti i tasti del widget, raggruppati per azione. Esc lo chiude e il focus torna dov'era.
  - **Come si apre (deciso dal PO):** con un piccolo pulsante **"Tasti"** visibile nel widget, e con `?` quando il focus è nel widget ma non in un campo di testo (dentro un campo `?` scrive un carattere: textarea del LaTeX, campi, modalità di modifica del Tree).
  - **Quali widget (deciso dal PO):** quelli con tasti propri, cioè Ranking, Kanban, Timeline, Tree, Gantt (e le molecole), Chart e LaTeX. I campi e gli atomi con tasti nativi o Radix (Approval, Scale, campi, Toggle, PickField, Tabs, choice) non hanno il pannello: li copre `askboard-help`. Se l'Approval riceve tasti propri con la 4.2, riceve anche il pannello.
- Etichette dei tasti per piattaforma (⌥⇧↑ su Mac, Alt+Shift+↑ altrove): scelta del costruttore.
- Stringhe in `en-US` e `it-IT`; quelle italiane nascono marcate "provisional, to review", come da convenzione.

## 6. Fonte unica dei tasti (deciso dal PO)

Ogni widget ha **una** tabella dei tasti, come dato. Da quella derivano:
1. il gestore dei tasti del widget;
2. tooltip, `aria-keyshortcuts` e pannello `?`;
3. la sezione tasti di `skills/askboard/references/widgets/<type>.md`;
4. il contenuto di `askboard-help`.

Il controllo di deriva (`check:skills`) copre anche i punti 3 e 4. Un test verifica le due direzioni: ogni azione della barra ha la sua voce nella tabella, e ogni voce della tabella ha un'azione visibile (pulsante, menu o gesto del mouse), tranne la pura navigazione del cursore e l'apertura del pannello.

## 7. Skill `askboard-help` (deciso dal PO)

- **Quando:** l'utente chiede aiuto sull'uso di AskBoard nella sessione di Claude Code ("come sposto una card?", "che tasti ha il Gantt?", "cosa vuol dire Keep mine?").
- **Dove:** sempre nel terminale (TUI). **Non usa mai AskBoard**: non chiama `ask`, `update`, `collect`, `fetch` né `snapshot`, e non apre la board.
- **Cosa sa:**
  - per ogni widget: a cosa serve, come si modifica con il mouse e con la tastiera, cosa riceve l'agente;
  - i concetti della board: rimandare, rifiutare, domanda di chiarimento, avviso "Keep mine / Reload", Snapshot, lingua, aggiornamenti dal vivo.
- **Distribuzione:** nel plugin, accanto ad `askboard` (`askboard:askboard-help`), generata come `skills/askboard` da `tools/build/skills/` e coperta dal controllo di deriva.
- **Lingua:** risponde nella lingua dell'utente.
- Va aggiornata la skill `askboard`: rimanda ad `askboard-help` quando l'utente chiede come si usa la board.

## 8. Revisione dell'esistente e skill di progetto (deciso dal PO)

**Revisione.** Si controllano tutti i widget, le molecole e gli atomi già costruiti rispetto alle sezioni 4–6, e si produce una tabella delle lacune per widget (parte dalla sezione 3). Le correzioni fanno parte di questa proposta. L'architetto può dividerle in gruppi o in più change.

**Skill e regole di progetto.** Si aggiunge il passo "tastiera e scopribilità" in:
- `openspec/config.yaml`:
  - `rules.design`: ogni change che introduce o modifica un widget con editing dichiara la sua tabella dei tasti e l'aiuto contestuale;
  - `rules.tasks`: test dei tasti, del tooltip e del pannello scritti prima del codice, con una clausola Verify;
- `.claude/agents/askboard-architect.md`: voce nella checklist di progettazione;
- `.claude/skills/askboard-implementation/SKILL.md`: una regola "Keyboard" in "Rules by area" e i test dei tasti al passo 2 del flusso per gruppo;
- `.claude/skills/askboard-review-protocol/SKILL.md` e `askboard-spec-reviewer`: controllo che tabella, gestore, tooltip, pannello, riferimenti e `askboard-help` coincidano;
- `CLAUDE.md` del progetto: una riga nella tabella delle modifiche dell'"Agent harness".

`.claude/skills/openspec-*` e `.claude/commands/opsx/` sono generati: non vanno toccati a mano.

**Specifiche.** Un requisito comune, per esempio "Keyboard shortcuts are discoverable", con scenari per tooltip, `aria-keyshortcuts` e pannello `?`. Si aggiornano i requisiti "at the keyboard" di Ranking, Kanban, Timeline e Tree, e si aggiunge un requisito di tastiera per LaTeX.

## 9. Lasciato al costruttore

- La mappatura esatta di Alt+Shift+frecce per Kanban, Timeline e Gantt, nel rispetto della regola dell'asse (sezione 4); la proposta dei tasti per le azioni fuori vocabolario (4.2), che però torna al PO.
- Come si sposta una selezione non contigua: diventa un blocco oppure si accetta solo un intervallo contiguo.
- Se il Gantt riceve il riordino delle righe o resta com'è: si estende alle sole azioni che il widget ha già.
- Le etichette dei tasti per piattaforma e l'aspetto del pannello `?` (nessun markup dall'agente: è la board a disegnarlo).
- La divisione in gruppi o in change e l'ordine dei widget nel retrofit.
- Il nome esatto dei requisiti e la versione del contratto (la minor successiva a quella di `main`, come da regola di progetto).

## 10. Punti d'incontro con il lavoro in corso

- **Table** (PR aperta, `feature-table`): nasce già con lo standard, oppure entra nel retrofit appena fusa.
- **Correzione "Keep mine dopo il ricaricamento"** (PR aperta): nessuna sovrapposizione prevista; da verificare.
- **Change in volo** in `openspec/changes/` (`form-widget`, `early-benchmark`, gli spike): l'architetto li elenca come merge point, come da regola.
- **Widget non ancora costruiti** (Graph, Diff review, Diagram, Spreadsheet, Image annotation, Document review): nascono con lo standard grazie alle skill aggiornate.

## 11. Presa in consegna (per la sessione di implementazione)

1. Registrare subito questo documento nel progetto, dove la tabella "Working documents" del `CLAUDE.md` mette le bozze (`drafts/`, versionata), con commit. Questo file vive fuori dal repository (`/Users/mr/askboard-e2e/`) e si può perdere.
2. Aprire la change OpenSpec con `askboard-architect`, usando questo documento come input, e collegare la bozza alla change.
3. Riferire al PO il nome della change e le domande aperte, nella sezione "Open questions for the PO" della proposta.

Report del test in corso, che contiene altri esiti da prendere in consegna: `/Users/mr/askboard-e2e/report-2026-11-08.md`.

## 12. Decisioni della revisione (2026-11-08)

Un revisore indipendente ha letto la 1.0.0 come chi dovesse pianificarla senza poter parlare con l'autore, e ha posto quattro domande.

| Domanda | Decisione | Di chi |
|---|---|---|
| Le nuove azioni hanno anche controlli visibili? | Sì: pulsanti "In cima" / "In fondo" e selezione col mouse (clic, Shift+clic) in Ranking, Kanban, Timeline (4.1) | PO |
| Come si scopre il pannello, e in quali widget? | Pulsante "Tasti" più `?` fuori dai campi; solo nei widget con tasti propri (5) | PO |
| Alias per in cima / in fondo sui MacBook? | Cmd/Ctrl+Shift+↑/↓ su tutte le piattaforme, accanto ad Alt+Shift+Home/End (4) | PO |
| Tasti per le azioni fuori vocabolario? | Li propone l'architetto con le stesse regole e li approva il PO tra le domande aperte della change (4.2) | agente, da confermare con il PO |

Il revisore ha verificato anche quanto segue, senza trovare domande da porre:
- `askboard-help` sta nel budget della skill sempre caricata (6.152 su 8.400 caratteri);
- la regola del controllo delle skill che ammette il solo nome `askboard` va aggiornata, come la decisione archiviata "una skill, non più d'una": il PO ha già deciso per la seconda skill;
- le regole sugli import non impediscono al generatore delle skill di leggere le tabelle dei tasti nel pacchetto dei widget.
