## ADDED Requirements

### Requirement: The shared Markdown renderer
The view SHALL render Markdown through one renderer module, shipped in a library chunk that a board or a Snapshot inlines only when an item it holds may render Markdown: a Text, whatever its format, an option with a Markdown preview, or a Document review. The Text, the option previews and the Document review SHALL render through it, and no component chunk SHALL bundle markdown-it or DOMPurify (AD-9).

#### Scenario: A board without Markdown
- **WHEN** a board holds only a Choice question and a Chart
- **THEN** its view inlines no Markdown library chunk

#### Scenario: A board with a plain Text
- **WHEN** a board holds only a Text whose `format` is `plain` and a Text with no `format`
- **THEN** its view inlines the Markdown library chunk once

#### Scenario: A board with a Text and a Document review
- **WHEN** a board holds a Markdown Text and a Document review
- **THEN** its view inlines the Markdown library chunk once, and both render through it

### Requirement: A Document review's document
A Document review SHALL show its `title` as text and its document through the shared Markdown renderer, by the Text's rules for HTML, links, images, controls and bounds, in the `body-lg` type. Every element that shows agent or user text in it (title, document, quotes, comments, replacements) SHALL wrap a word longer than its line (NFR-5, AD-8; DESIGN, Document review).

#### Scenario: Markup in the document
- **WHEN** a Document review's document holds `<script>alert(1)</script>` and `[x](javascript:alert(1))`
- **THEN** the board shows the first as text and the second's text with no link, and nothing runs

#### Scenario: A long unspaced word
- **WHEN** a title of 120 characters with no space, and a document word, a comment and a replacement of 200 characters with no space, are shown on a board 1,280 pixels wide
- **THEN** each wraps inside the widget frame, and the board scrolls no wider than the frame

### Requirement: Commenting on a passage
With a passage of the document selected, "Comment" SHALL open an empty comment card for it. The comment SHALL enter the draft as the user types, and the passage SHALL be marked with a numbered pin; "Done", Escape or the close control SHALL close the card. A card whose text is emptied SHALL leave no annotation (FR-11, AD-9, AD-10; EXPERIENCE, Comment card).

#### Scenario: A comment written
- **WHEN** the user selects "remembers", presses "Comment" and types "Say how long."
- **THEN** the draft holds one annotation quoting "remembers" with that text, the passage is marked, and its pin reads 1

#### Scenario: A comment emptied
- **WHEN** the user clears a comment's text and closes its card
- **THEN** the draft holds no annotation for it and the mark is gone

### Requirement: Suggesting an edit
"Suggest edit" SHALL open a card whose replacement field starts with the passage's text, with an optional note. While the replacement differs from the passage, the draft SHALL hold a suggested edit with the note, if any, shown as the passage struck through followed by the replacement; an empty replacement SHALL suggest deleting the passage. While it equals the passage, a written note SHALL be held as a comment (FR-11, AD-10; DESIGN, Document review).

#### Scenario: A word replaced
- **WHEN** the user selects "drafts", presses "Suggest edit" and changes the field to "unsent answers"
- **THEN** the draft holds a suggested edit with that replacement, shown as "drafts" struck through and "unsent answers" after it

#### Scenario: A deletion
- **WHEN** the user empties the replacement field
- **THEN** the draft holds a suggested edit with an empty replacement, shown as the passage struck through

#### Scenario: Nothing changed
- **WHEN** the replacement equals the passage and no note is written
- **THEN** the draft holds no annotation for it

#### Scenario: Only a note written
- **WHEN** the user selects "drafts", presses "Suggest edit", leaves the field as "drafts" and writes the note "Say which drafts."
- **THEN** the draft holds a comment on "drafts" with that text and no replacement, marked as a comment, and "Answer" sends it

### Requirement: Passages the board does not anchor
The board SHALL anchor an annotation only to the passage the user selected. It SHALL refuse a passage that is blank, longer than 2,000 characters, outside the document, one of several selected ranges, overlapping an annotation, or repeated in the document with 200 characters of context, and any passage while the item holds 100 annotations, and SHALL say why beside the toolbar, never only in the console (NFR-10, AD-10).

#### Scenario: An overlapping passage
- **WHEN** the user selects text that overlaps comment 2 and presses "Comment"
- **THEN** no card opens, and the toolbar's message says the passage overlaps comment 2

#### Scenario: A repeated passage
- **WHEN** the user selects a sentence the document repeats with the same context and presses "Suggest edit"
- **THEN** no card opens, and the message asks for a longer passage

#### Scenario: The 101st annotation
- **WHEN** a Document review holds 100 annotations and the user selects another passage and presses "Comment"
- **THEN** no card opens, the draft is unchanged, and the toolbar's message says the document holds the most comments it takes

### Requirement: Editing and deleting annotations
A pin SHALL open its annotation's card by click, or by Enter on the current pin. On the live board the card SHALL offer "Edit" and "Delete"; "Delete" SHALL remove the annotation, its mark and its pin. When a card closes, focus SHALL return to its pin, or to the document when the pin is gone (FR-11; EXPERIENCE, Comment card, Focus).

#### Scenario: A comment deleted
- **WHEN** the user opens pin 1's card and presses "Delete"
- **THEN** the draft no longer holds the annotation, its mark and pin are gone, the other pins are renumbered, and focus is on the document

### Requirement: A Document review's result
A Document review SHALL hold its annotations as the item's result in the draft record, in the order the user made them, and no result while it holds none. An answer SHALL carry them under the item's ID, and a reload SHALL restore them with their marks; an untouched Document review SHALL give no result (FR-18, AD-10, AD-20).

#### Scenario: Restored after a reload
- **WHEN** the user writes a comment and a suggested edit, then reloads the board
- **THEN** both annotations, their marks and their pins are back, and "Answer" sends them as the item's result

#### Scenario: Untouched
- **WHEN** the user answers a question holding a Document review and an Approval, without annotating
- **THEN** the answer carries the Approval's result and none for the Document review

### Requirement: Detached annotations
A held annotation whose quote has no single place in the document of the revision the card shows, or whose place overlaps an earlier one, SHALL be listed under the document as detached, with its quote, its text and "Delete", never moved or dropped. While one is listed, "Answer", "Accept recommended", "Select recommended" and Submit SHALL not send it, and the hint SHALL say why, except on a revision the board cannot show (AD-10, NFR-10).

#### Scenario: A comment put back on a rewritten sentence
- **WHEN** the user answered with a comment on "remembers", the agent reopens the question with a revision that replaces that word, and the user presses "Start from my previous answer"
- **THEN** the comment is listed as detached, "Answer" sends nothing, and the hint says to delete the detached comments first, also after a reload

#### Scenario: Kept work on its own revision
- **WHEN** the user has commented on "remembers" in revision 1, the agent's revision replaces that word, and the user chooses "Keep mine" with no reload
- **THEN** the card shows revision 1 with the comment marked, nothing is listed as detached, no hint shows, and "Answer" sends the comment naming revision 1

#### Scenario: The detached comment deleted
- **WHEN** the user deletes the detached comment
- **THEN** the hint is gone and "Answer" sends the remaining annotations

#### Scenario: A passage the revision kept
- **WHEN** annotations are put back on a revision that changed another paragraph only
- **THEN** each annotation keeps its place, mark and pin

#### Scenario: Inside a hidden tab
- **WHEN** a Document review with a detached annotation sits in a Tabs layout's tab that is not selected
- **THEN** that tab shows its mark

### Requirement: A Document review at the keyboard
The document SHALL be one Tab stop, apart from the links it holds, whose Up, Down, Home and End move the current block (a paragraph, heading, list item, table cell or code block), and whose Left and Right move between the current block's pins; Enter opens the current pin's card. With no text selected, "Comment" and "Suggest edit" SHALL anchor the current block's text. The toolbar SHALL be another Tab stop (EXPERIENCE, Accessibility Floor).

#### Scenario: A comment from the keyboard
- **WHEN** the user tabs into the document, presses Down twice, then tabs to the toolbar and presses "Comment"
- **THEN** the card opens for the third block's text, and typing writes the comment

#### Scenario: A block too long to quote
- **WHEN** the current block holds 2,500 characters and the user presses "Comment" with no text selected
- **THEN** no card opens, and the message asks for a shorter passage selected with the pointer

### Requirement: Links in a Document review
A link in a Document review SHALL open as a Markdown Text's link does, on a click of the link alone; a pin or a suggested replacement after link text SHALL never open it. The board page SHALL open it only when the URL passes the contract's link check and the item the message names is a Document review of the board document, at any depth of its question's layouts. In a Snapshot it SHALL open in a new tab with no opener and no referrer (AD-8).

#### Scenario: A link clicked
- **WHEN** the user clicks an `https:` link in a Document review on the live board
- **THEN** the board page opens it in a new tab

#### Scenario: A pin at the end of a link
- **WHEN** a comment's passage ends inside the text of the link "docs", and the user clicks its pin or presses Enter on it
- **THEN** its card opens, no link opens, and the link's accessible name is still exactly "docs"

#### Scenario: A message naming another item
- **WHEN** an open-link message names a Chart's item ID
- **THEN** the board page opens nothing and logs the refusal with no agent text

### Requirement: A Document review read-only and in Snapshots
Once its ask is closed or the board is locked, or in a Snapshot, a Document review SHALL show its annotations' marks and pins and open their cards read-only, with no toolbar, "Edit" or "Delete". An annotation that has no place in the shown revision SHALL be listed as detached, without actions (AD-15, FR-26).

#### Scenario: A Snapshot of an answered review
- **WHEN** a Snapshot of a board with an answered Document review is opened from `file://`
- **THEN** the marks and pins show, a pin opens its card read-only, and a link opens in a new tab

### Requirement: A Document review on a revision the board cannot show
While a card shows a revision other than the one its answer names, as after a reload or a takeover, a Document review SHALL be read-only with the line the edit widgets show then: its held annotations stay shown and are sent as before, one the shown text does not place is listed as detached without blocking "Answer", and none is added, edited or deleted. "Reload, losing my work" SHALL make it editable again (NFR-10, AD-10, AD-20).

#### Scenario: A reload after the agent changed the document
- **WHEN** the user comments on "remembers" in revision 1, the agent's `update` changes another paragraph, the tab reloads and the user chooses "Keep mine"
- **THEN** the Document review shows the comment read-only with the line, a selection offers no "Comment" or "Suggest edit", and "Answer" sends the comment naming revision 1

#### Scenario: A held comment the shown text does not place
- **WHEN** the agent's `update` had rewritten "remembers" before the reload
- **THEN** the comment is listed as detached without "Delete", no hint asks to delete it, and "Answer" sends it naming revision 1

#### Scenario: Reload makes it editable
- **WHEN** the user then chooses "Reload, losing my work"
- **THEN** the line goes, the comment is gone, and a selection can be commented on the current revision

### Requirement: The answer gates read the revision the card shows
"Answer", "Accept recommended", "Select recommended", Submit and a tab's correction mark SHALL read a question's fields, entries and reasons at the revision its card shows, which is the revision the answer names, as the card's state and hint do: after "Keep mine", while the card shows the kept revision, a field passes or fails by that revision's props, and a press never refuses what the card shows as ready (NFR-10, AD-10, AD-20).

#### Scenario: Keep mine across a stricter revision
- **WHEN** the user has chosen an option of a question that also holds an empty TextField, the agent's revision makes that field required, and the user chooses "Keep mine" with no reload
- **THEN** the card shows the earlier revision with no hint, and "Answer" sends the answer naming that revision

#### Scenario: Submit after Keep mine
- **WHEN** in submitted delivery the user marks such an answer ready, the agent's revision makes the empty field required, the user chooses "Keep mine" with no reload and presses Submit
- **THEN** Submit sends the held answer naming the earlier revision

### Requirement: An answer carries what the card shows
After "Keep mine", while the card shows the kept revision, "Answer", "Accept recommended", "Select recommended" and Submit SHALL send the values and results of the items that revision holds and the options it recommends, as the card shows them, even for an item a later revision removed; the answer names the kept revision, against which `ask-core` checks it (NFR-10, AD-10, AD-20).

#### Scenario: A result on an item the agent removed
- **WHEN** the user has set results on items `a` and `b`, the agent's revision removes `b`, and the user chooses "Keep mine" with no reload and presses "Answer"
- **THEN** the answer names the earlier revision and carries the results of `a` and `b`

#### Scenario: Select recommended after Keep mine
- **WHEN** revision 1 recommends "Yes", the agent's revision 2 recommends a new option "Maybe", and the user chooses "Keep mine" with no reload, presses "Select recommended", then Submit
- **THEN** the answer names revision 1 and chooses "Yes", as the card shows

### Requirement: The revision confirmation reads the revision the card shows
The confirmation asked before an answer replaces one the agent has received SHALL be asked, or not, by the items of the revision the card shows and the answer names: after "Keep mine", an Approval a later revision removed still asks, and one it added does not (NFR-10, AD-10).

#### Scenario: Keep mine across a removed Approval
- **WHEN** the user holds a verdict on an Approval, the agent's revision removes the Approval, the user chooses "Keep mine" with no reload, the agent then records an answer for the question (its `update` action `answer`), and the user changes the verdict and presses "Answer"
- **THEN** the board asks to confirm the replacement before it sends the answer naming the earlier revision

### Requirement: The draft follows the revision the card shows
After "Keep mine", while the card shows the revision the work was made on and the page has not reloaded, the draft SHALL keep, write, compare, mirror and clear the user's work by that revision's items as well as the current one's: work held only on an item a later revision removed, an entry or a cell entry included, stays held across updates, is mirrored, counts as unsent work, blocks as on that revision and keeps the card on it; an edit of it releases the ready mark (NFR-10, AD-20, AD-21).

#### Scenario: Work only on a removed item
- **WHEN** the user's only work on a question is on item `b`, the agent's revision removes `b`, and the user chooses "Keep mine" with no reload and edits `b`
- **THEN** the card still shows the earlier revision with the edit, the draft mirrors it, and the leave-page prompt and "Copy my unsent work" count it

#### Scenario: A ready mark after Keep mine
- **WHEN** in submitted delivery the user's answer is marked ready, the agent's revision removes item `b`, the user chooses "Keep mine" with no reload and edits `b`
- **THEN** the ready mark is released, as for an edit of any other item

#### Scenario: An entry on a removed item
- **WHEN** the user holds a result on item `a` and the text "12x" in the NumberField `c`, the agent's revision removes `c`, and the user chooses "Keep mine" with no reload
- **THEN** `c` still shows "12x", the draft mirrors it under the earlier revision, and "Answer" stays disabled until the user corrects or clears it

#### Scenario: The too-large line after an edit of a removed item
- **WHEN** after "Keep mine" an answer naming the earlier revision was not sent as too large, and the user edits the item the agent's revision removed
- **THEN** the line saying the answer was too large goes

#### Scenario: A reload drops work only a removed item held
- **WHEN** the user's only work on a question is a result on item `b`, the agent's revision removes `b`, and the page reloads
- **THEN** the card shows the current revision, no work is restored on `b`, and the draft record keeps no entry for the question

### Requirement: The items follow the revision the card shows
While a card shows an earlier revision after "Keep mine", with no reload, the board each of its items reads (the items, each question's items, the values and answers they show, the compute graph and linked plans) and the ready state of its question SHALL follow that revision: an item only it holds renders, reports ready or fails the question, a linked edit writes only items it holds, and an item only the current revision holds is not awaited (AD-9, AD-10, AD-20).

#### Scenario: A work breakdown the agent removed
- **WHEN** the user has edited a Tree and its linked Gantt, the agent's revision removes both, and the user chooses "Keep mine" with no reload and adds a package by name
- **THEN** both items render, the package and its task are held and mirrored under the earlier revision, and "Answer" sends both values naming it

#### Scenario: A Gantt the agent linked
- **WHEN** the agent's revision links a new Gantt to a Tree the user has edited, and the user chooses "Keep mine" with no reload and adds a package by name
- **THEN** neither the draft nor its record holds a value for the new Gantt

#### Scenario: An item the agent added
- **WHEN** the user holds work on a question and the agent's revision adds a TextField to it
- **THEN** the question does not stay loading: "Keep mine" and "Reload, losing my work" can be chosen, and after "Keep mine" "Answer" sends the earlier revision

#### Scenario: An item that fails stops every act of its question
- **WHEN** a widget item of a question throws while it renders, the question having counted as visible, and the user holds answers for it and for another question in submitted delivery
- **THEN** the board page refuses every act for the question but the choice "Reload, losing my work", its held acts are no longer held while its work stays in the draft, Submit sends the other question's answer, and the card's agent-change notice still offers that choice, which reaches the agent

#### Scenario: An Approval beside a removed edit
- **WHEN** the user has edited a Tree beside an Approval, the agent's revision removes the Tree, and the user chooses "Keep mine" with no reload
- **THEN** the Approval's summary counts the Tree's edits and "Approve" cannot be chosen

### Requirement: Document review strings
Every string a Document review shows SHALL come from the view's tables in en-US and it-IT: the toolbar, the counter, the cards, the detached list, the refusals and the hint (FR-34; EXPERIENCE, Voice and Tone).

#### Scenario: An Italian board
- **WHEN** an ask in it-IT holds a Document review with a comment, a suggested edit and a detached annotation
- **THEN** no English string of the Document review shows in its text, accessible names or titles
