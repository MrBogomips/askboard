# Answers and Snapshots

## Reading answers

- `collect` returns, for each ask, the events after the cursor you passed, each with the cursor that follows it. Pass the latest cursor back next time.
- An event is an answer (a decline is an answer with `declined: true`), a postpone, a reopening (the user undid a postpone or a decline), a note, a follow-up, an edit choice, a closing, or a discard.
- An answer carries only what changed: for a widget, its `changes` and the derived values, not the whole item. `fetch` returns a whole item, in pages when it is long.
- An answer marked `tooLarge` was too large to carry its `changes`, derived values or `results`: `fetch` the item to read them.
- An answer whose `rev` is earlier than the question's current one (the user kept their work over your update, as the edit choice before it says) carries no derived values: the board computes them on the current revision only; to have them, ask again on your current revision; `fetch` has none either.
- A revision names the answer it replaces. Take the latest.
- A `discarded` ask is gone and its answers will not come.
- `fetch` of an item you deleted returns the outcome `deleted`: a question, an area, an item inside one, or a molecule reference of a question you deleted. `fetch` of an ask that is gone returns `discarded`. An item a `change` dropped, or one the ask never held, is an error.

```json result
{
  "versions": {
    "result": "1.14",
    "output": "1.12"
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
