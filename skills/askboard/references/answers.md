# Answers and Snapshots

## Reading answers

- `collect` returns, for each ask, the events after the cursor you passed, each with the cursor that follows it. Pass the latest cursor back next time.
- An event is an answer (a decline is an answer with `declined: true`), a postpone, a reopening (the user undid a postpone or a decline), a note, a follow-up, an edit choice, a closing, or a discard.
- An answer carries only what changed: for a widget, its `changes` and the derived values, not the whole item. `fetch` returns a whole item, in pages when it is long.
- A revision names the answer it replaces. Take the latest.
- A `discarded` ask is gone and its answers will not come.

```json result
{
  "versions": {
    "result": "1.5",
    "output": "1.5"
  },
  "epoch": "k3x9",
  "asks": [
    {
      "askId": "checkout-plan-p8r3",
      "state": "partly-answered",
      "cursor": "k3x9.1",
      "events": [
        {
          "cursor": "k3x9.1",
          "type": "answer",
          "itemId": "region",
          "rev": 1,
          "who": "Sara Conti",
          "when": "2026-10-31T14:05:00Z",
          "choice": [
            "EU",
            "US"
          ],
          "optionNotes": {
            "US": "East coast only, at first."
          }
        }
      ]
    }
  ]
}
```

## Snapshots

`snapshot` saves an ask's board as one self-contained HTML file and returns its path, in the Snapshot folder (`.askboard/snapshots` unless the user set another). The board's data is in the `<script type="application/json">` element whose ID is `askboard-data`: read it there instead of parsing the page.
