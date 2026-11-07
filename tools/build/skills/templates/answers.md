# Answers and Snapshots

## Reading answers

- `collect` returns, for each ask, the events after the cursor you passed, each with the cursor that follows it. Pass the latest cursor back next time.
- An event is an answer (a decline is an answer with `declined: true`), a postpone, a reopening (the user undid a postpone or a decline), a note, a follow-up, an edit choice, a closing, or a discard.
- An answer carries only what changed: for a widget, its `changes` and the derived values, not the whole item. `fetch` returns a whole item, in pages when it is long.
- An answer marked `tooLarge` was too large to carry its `changes`, derived values or `results`: `fetch` the item to read them.
- A revision names the answer it replaces. Take the latest.
- A `discarded` ask is gone and its answers will not come.

{{collectExample}}

## Snapshots

`snapshot` saves an ask's board as one self-contained HTML file and returns its path, in the Snapshot folder (`{{snapshotFolder}}` unless the user set another). The board's data is in the `<script type="application/json">` element whose ID is `{{snapshotElement}}`: read it there instead of parsing the page.
