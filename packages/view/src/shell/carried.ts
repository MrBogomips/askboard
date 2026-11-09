// The work an act carried, which goes from the draft once the board page settles it as done
// (ask-lifecycle, design decision 6; AD-20). An answer or a decline names the revision the card
// showed, which after "Keep mine" is an earlier one than the document's: the items that revision
// held, a removed item among them, are cleared with the others, so no work outlives the act that
// sent it (document-review, design decision 15; review S-2 of 6.14).

import { questionsOf, type ViewDocument } from "../view-document.ts";
import { type KeptChoices, type Revisions, workingQuestion } from "./agent-change.ts";
import type { Flight } from "./answer-acts.ts";
import { type BoardDraft, itemIdsOf, type QuestionWork, resultIdsOf } from "./board-draft.ts";
import { clearCellEntries } from "./cell-entries.ts";
import type { DraftStore } from "./draft-store.ts";
import { entryIdsOf } from "./entries.ts";
import type { Store } from "./store.ts";

// An answer, a decline or a note takes with it the undo it was held over.
const CARRIED: Readonly<Partial<Record<string, readonly (keyof QuestionWork)[]>>> = {
  answer: ["other", "optionNotes", "note", "held", "undo"],
  decline: ["other", "optionNotes", "note", "held", "undo"],
  postpone: ["held"],
  reopen: ["held"],
  note: ["note", "held", "undo"],
};

/**
 * Takes from the draft what the settled acts of a flight carried. The items cleared are those of
 * the question and of the revision the card showed when the work was made (`workingQuestion`, by
 * the revisions the view has seen), the question's work still held at this point.
 */
export const clearCarried = (
  flight: Flight,
  document: ViewDocument,
  draft: DraftStore,
  results: DraftStore,
  entries: DraftStore,
  cellEntries: DraftStore,
  board: BoardDraft,
  kept: Store<KeptChoices>,
  revisions: Revisions,
): void => {
  for (const act of flight.acts) {
    const question = questionsOf(document).find((each) => each.id === act.itemId);
    if (question === undefined) continue;
    if (act.type === "edit-choice") {
      // "Keep mine" settles the notice for the revision it was about (task 6.7).
      if (act.edit === "ignore") {
        kept.set(new Map(kept.get()).set(act.itemId, { rev: act.rev, keptRev: act.keptRev }));
      }
      continue;
    }
    if (act.type === "follow-up") {
      // The composer's text went; Explain's follow-up leaves it.
      if (board.work(question.id)?.composer === act.text) board.clear(question.id, ["composer"]);
      continue;
    }
    const fields = CARRIED[act.type];
    if (fields === undefined) continue;
    if (act.type === "answer" || act.type === "decline") {
      const shown = workingQuestion(question, board.work(question.id), revisions);
      const items = new Set([...itemIdsOf(question), ...itemIdsOf(shown)]);
      for (const itemId of items) draft.set(itemId, undefined);
      for (const itemId of new Set([...resultIdsOf(question), ...resultIdsOf(shown)])) {
        results.set(itemId, undefined);
      }
      for (const itemId of new Set([...entryIdsOf(question), ...entryIdsOf(shown)])) {
        entries.set(itemId, undefined);
      }
      clearCellEntries(question, cellEntries);
      clearCellEntries(shown, cellEntries);
    }
    board.clear(question.id, fields);
  }
};
