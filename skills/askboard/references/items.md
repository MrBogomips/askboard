# Item catalogue

This is what each item type is for, to choose among them; `SKILL.md` links the reference of each type.

## Context items

- `excerpt`: a passage of a project file beside the question: a pointer, which AskBoard resolves when the ask is sent, or text you wrote, never both
- `reference`: a file or a web page the user opens in one click: a pointer or an http or https URL, never both
- `image`: a screenshot or picture saved as a project file, with the text that describes it

## Widgets

- a Tree (`tree`): a work breakdown or any hierarchy the user edits: add, move, rename, remove nodes, adjust estimates
- a Gantt (`gantt`): a schedule the user adjusts: tasks, durations, dependencies, with dates and the critical path computed
- an Approval (`approval`): a decision on its question's content: approve, approve with changes or reject; put it last in the question it approves
- a Scale (`scale`): a number on a slider (the Slider), a range between two numbers, or a rating of up to 11 values
- a Ranking (`ranking`): an order of 2 to 50 items the user sets by dragging or with Move up and Move down
- a LaTeX (`latex`): one mathematical expression in LaTeX that the user reads and corrects, with a live preview
- a Kanban (`kanban`): cards the user moves between 2 to 12 columns, such as statuses, priorities or owners
- a Timeline (`timeline`): milestones and date ranges the user moves in time and across lanes, as in a roadmap
- a Chart (`chart`): a bar, line or pie chart the user reads and may highlight points on
- a Text (`text`): a passage of plain text or Markdown the user reads; it gives no answer
- a Value (`value`): a figure the user reads: a number, percentage, amount, date or duration
- a Divider (`divider`): a rule that separates the items of a question; its props are empty
- a TextField (`text-field`): a short or long free text the user types, such as a name or a comment
- a NumberField (`number-field`): a number the user types, with optional bounds, a step and a unit
- a MoneyField (`money-field`): an amount of money the user types, in one currency or one picked from a list
- a DateField (`date-field`): a calendar day the user types or picks, optionally within a range
- a Toggle (`toggle`): an on or off choice the user sets, such as a switch or a yes or no

## Molecules

- `gantt-plan`: a schedule over a work breakdown of the same question: the user adjusts durations and dependencies, with dates and the critical path computed
- `wbs-pert`: a work breakdown with three-point estimates that the user reviews and edits, with expected effort and spread computed per package and rolled up
