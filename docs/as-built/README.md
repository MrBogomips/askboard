# As-built notes

One note per OpenSpec change, named after it: `<change-id>.md`. A note says what the change built:
where its code lives, the names and seams it added for later changes, the versions of the contract's
schema sets it bound. Agents read the notes that name the package or the seam they are about to
touch (`grep -l '<name>' docs/as-built/*.md`).

## Rules

- **Written by the change itself,** in its own branch, by its documents task, so two changes in
  flight never edit the same file. The notes from `setup-workspace` to `wbs-gantt-consistency`
  were moved here from the "In code since" paragraphs of `CLAUDE.md` unchanged.
- **No status.** No "merged", "awaiting", "in flight" or merge dates: that is in git, the pull
  requests, `openspec list` and the Issues. What a change leaves to the PO is an Issue labelled
  `needs-po`, not a line here.
- **Versions as bound.** At the rebase before its pull request, a change writes the versions it
  bound, with `main`'s SHA, in its own note; a rebind edits only that note.
- **Corrections in place.** A later change that makes a sentence of an earlier note wrong corrects
  that sentence and says so in its own note. The current behaviour is in `openspec/specs/` and in
  the code; where a note disagrees with them, they win.
