---
title: Scorciatoie configurabili dall'utente
version: 1.1.0
status: decisa dal PO (2026-11-09)
date: 2026-11-09
refs: Issue #81; OpenSpec change keyboard-shortcuts-help (branch worktree-feature-keyboard-help)
---

# Scorciatoie configurabili dall'utente

## 1. Perché

La change `keyboard-shortcuts-help` fissa un vocabolario di tasti unico per tutti i widget. Il probe dei tasti (task 0.5) li ha provati con Playwright, che li consegna alla pagina senza passare dal sistema operativo. Su un Mac o un desktop Linux veri alcune combinazioni possono essere già prese:

- macOS: Ctrl+Maiusc+↑/↓ (Mission Control, se attivo), Cmd+A;
- Linux: Alt+Maiusc (cambio layout su alcuni desktop), Ctrl+Alt+frecce (cambio desktop);
- tastiera italiana: `?` è Maiusc+apostrofo, mai provato.

Se una combinazione non arriva, oggi l'utente non ha alternative. La configurazione è la via d'uscita, e serve anche a chi ha abitudini diverse (un altro editor, un layout non QWERTY).

## 2. Cosa si configura

- **Per azione, non per widget.** Si cambia un'azione del vocabolario (`move.up`, `select.none`, `keys.open`, …) o un'azione propria di un tipo (`gantt.fit`, …). Il cambio vale in ogni widget che ha quell'azione. Così resta vero il principio della change: stessa azione, stessi tasti ovunque.
- **Sostituire o togliere.** Un'azione riceve una lista di combinazioni al posto delle sue, oppure nessuna: in quel caso resta solo il pulsante.
- **Nessun preset** nella prima versione (vedi domanda D4).

Forma nel file di configurazione utente (`~/.config/askboard/config.json`):

```json
{
  "version": "1.1",
  "keys": {
    "move.top":    ["Mod+Alt+ArrowUp"],
    "move.bottom": ["Mod+Alt+ArrowDown"],
    "keys.open":   ["F1"],
    "select.all":  []
  }
}
```

- `Mod` vale Cmd su macOS e Ctrl altrove, così lo stesso file funziona su entrambi.
- I nomi dei tasti sono quelli di `KeyboardEvent.key` (`ArrowUp`, `Enter`, `Home`, …), come nelle tabelle della change.

## 3. Regole (fail closed)

Valgono le stesse regole delle tabelle (decisione 2 della change), applicate alla tabella **effettiva**, cioè le tabelle di default con le sostituzioni applicate:

1. Una combinazione deve usare una delle forme ammesse: nessun modificatore, Maiusc, Alt+Maiusc, Mod, Mod+Maiusc, carattere. Più la nuova forma Mod+Alt (D2).
2. Nessun tasto che il browser o il sistema usa (Tab, F5, Cmd+W, Cmd+L, …): la lista dei tasti rifiutati che la change ha già.
3. Due azioni della stessa parte di un widget non possono avere la stessa combinazione dopo la sostituzione. Per esempio, se `move.top` prende `Alt+Maiusc+ArrowUp`, questo va in conflitto con `move.up`.
4. Le azioni che servono a uscire non si possono lasciare senza tasti: `edit.cancel` e la chiusura del pannello (Esc).

Se una sola regola fallisce, si ignora **tutta** la chiave `keys`: valgono i default e il pannello Impostazioni mostra il problema, con l'azione e il tasto. È la stessa logica di AD-14: un file o una chiave non validi non si applicano mai a metà.

## 4. Dove vive la configurazione (sicurezza)

- **Solo nella configurazione utente.** Una chiave `keys` nella configurazione di progetto (`.askboard/config.json`) viene ignorata, con un avviso, come già succede per `editor`. Il file di progetto può essere scritto da un agente, e un agente non deve poter cambiare cosa fanno i tasti dell'utente. Per esempio, potrebbe spostare "Conferma quest'ordine" su un tasto premuto per altro scopo. È il principio NFR-5 / AD-8: il contenuto dell'agente è un dato.
- **Nessun tasto dall'ask.** Il formato di input non riceve nulla.
- Il processo di sessione legge `keys` insieme alle altre chiavi di presentazione a ogni apertura di board (AD-14) e la manda alla pagina nel messaggio `settings` del protocollo board.

## 5. Come la cambia l'utente

**Livello 1: file.** Si modifica `config.json` e la modifica vale dalla prossima board aperta.

**Livello 2: dalla board.** Si aggiunge una sezione "Tasti" nel pannello Impostazioni, accanto a tema e densità:

```
Impostazioni ▸ Tasti                              [Ripristina tutti]
───────────────────────────────────────────────────────────────────
Cursore       Su / Giù                 ↑ ↓
Selezione     Seleziona / deseleziona  Spazio
              Deseleziona tutto        Esc                 [Cambia]
Spostamento   Sposta su                ⌥⇧↑                 [Cambia]
              In cima                  ⌥⇧Home  ⌘⇧↑   ●     [Cambia] [Ripristina]
Altro         Mostra i tasti           ?                   [Cambia]
───────────────────────────────────────────────────────────────────
● = personalizzato
```

- **[Cambia]** apre la cattura: "Premi i nuovi tasti… (Esc annulla)". Il primo tasto valido diventa la combinazione. Una combinazione già usata mostra "Già usata da 'Sposta su': sostituire?". Una combinazione rifiutata (regola 2) mostra il motivo.
- **Esc** annulla la cattura, quindi dalla UI non si può assegnare Esc a un'azione: si fa dal file.
- La scrittura passa dal messaggio `setting` già esistente, con la chiave `keys` in più. Il processo di sessione ricontrolla le regole prima di scrivere (come per `theme`) e non scrive mai una tabella che le viola.
- Il pannello dei tasti del widget (il "?") mostra i tasti effettivi, con ● su quelli personalizzati, e un link "Cambia in Impostazioni".
- Le cifre del pannello, i tooltip e `aria-keyshortcuts` mostrano sempre i tasti effettivi.

## 6. Effetti sul resto

| Area | Effetto |
|---|---|
| `contract` | `effectiveKeys(table, overrides)` puro; `keyOverridesProblems(overrides)` sulle regole 1–4 contro tutte le tabelle registrate; schema configurazione 1.0 → **1.1** (chiave `keys`); protocollo board 1.9 → **1.10** (`keys` in `settings` e `setting`) |
| `core` / `server` | lettura di `keys` solo dalla configurazione utente; avviso se nel file di progetto; scrittura via `setting` con ricontrollo |
| `view` | matcher, `KeyHint`, pannello dei tasti e `aria-keyshortcuts` leggono la tabella effettiva; sezione "Tasti" nelle Impostazioni con cattura |
| Skill | `askboard-help` e le sezioni Keys di `askboard` riportano i **default** e dicono che il pannello "?" della board mostra i tasti in vigore e che si cambiano in Impostazioni ▸ Tasti |
| Snapshot | nessun effetto (una Snapshot non riceve tasti) |
| Sicurezza | revisione di sicurezza sul percorso di scrittura (board-host, ask-core), come per `theme` |

## 7. Come inserirlo nel piano

| Opzione | Cosa | Pro | Contro |
|---|---|---|---|
| **A** | Tutto in `keyboard-shortcuts-help`, come gruppi in più | Una sola PR; la funzione esce subito | La change, già grande, cresce di circa un terzo; versioni dello schema che si muovono (la decisione 12 diceva "nessuna"); revisione di sicurezza in più |
| **B (consigliata)** | In questa change solo il **seam**: matcher, etichette, pannello e skill passano da `effectiveKeys(table, overrides)` con override vuoti; nessuna versione si muove. Poi una change `keyboard-customize` (nuovo Issue) con il file, la sezione Impostazioni e le versioni, in parallelo ai due retrofit | I retrofit nascono già sulla tabella effettiva; questa change resta nei suoi confini; la configurazione ha il suo design e la sua revisione di sicurezza | Due PR; la configurazione arriva dopo |
| **C** | Tutto in una change successiva, senza seam ora | Questa change non cambia | Le chiamate al matcher dei retrofit vanno poi ritoccate |

## 8. Domande per il PO

- **D1 – Piano.** A, B o C? *Default*: B.
- **D2 – Forme in più.** Si ammette Mod+Alt (e Ctrl+Alt su macOS) per le sostituzioni? Serve proprio a chi ha Alt+Maiusc occupato. *Default*: sì, solo nelle sostituzioni, non nelle tabelle di default.
- **D3 – Livello 2 subito?** Nella prima versione di `keyboard-customize`, file e sezione Impostazioni insieme, oppure prima solo il file? *Default*: insieme, perché il solo file è poco scopribile.
- **D4 – Preset.** Un preset pronto (per esempio "macOS senza Alt+Maiusc") oltre alle sostituzioni singole? *Default*: no; si valuta dopo il collaudo su macOS e Linux (task 7.5).
- **D5 – Ambito.** Si possono cambiare anche le azioni proprie dei tipi (`gantt.fit`, …) o solo il vocabolario? *Default*: entrambe, con le stesse regole.

## 9. Fuori ambito

- Tasti diversi per widget diversi (rompe il vocabolario unico).
- Sequenze di tasti (accordi tipo "g poi t").
- Sincronizzazione delle preferenze tra macchine.

## 10. Decisioni del PO (2026-11-09)

- **D1 – Piano: A.** Tutto in `keyboard-shortcuts-help`, come gruppi in più; la decisione 12 ("nessuna versione si muove") viene emendata.
- **D2 – Mod+Alt:** sì, solo nelle sostituzioni, non nelle tabelle di default.
- **D3 – Solo il file.** Niente sezione "Tasti" nelle Impostazioni né cattura dei tasti dalla board: sarebbe sovradimensionato. La configurazione la assiste la skill `askboard-help`, che spiega il formato, elenca le azioni e i loro tasti di default, e aiuta l'utente a scrivere la chiave `keys` nel file utente. Il §5 "Livello 2" è quindi fuori ambito; restano il pannello "?" e i tooltip con i tasti effettivi.
- **D4 – Preset:** no; si valuta dopo il collaudo su macOS e Linux.
- **D5 – Ambito:** si possono cambiare sia le azioni del vocabolario sia quelle proprie dei tipi, con le stesse regole.
