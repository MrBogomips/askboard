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
- **WHEN** a title, a document, a comment and a replacement each hold 200 characters with no space, on a board 1,280 pixels wide
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
"Suggest edit" SHALL open a card whose replacement field starts with the passage's text, with an optional note. While the replacement differs from the passage, or a note is written, the draft SHALL hold a suggested edit, shown as the passage struck through followed by the replacement; an empty replacement SHALL suggest deleting the passage (FR-11; DESIGN, Document review).

#### Scenario: A word replaced
- **WHEN** the user selects "drafts", presses "Suggest edit" and changes the field to "unsent answers"
- **THEN** the draft holds a suggested edit with that replacement, shown as "drafts" struck through and "unsent answers" after it

#### Scenario: A deletion
- **WHEN** the user empties the replacement field
- **THEN** the draft holds a suggested edit with an empty replacement, shown as the passage struck through

#### Scenario: Nothing changed
- **WHEN** the replacement equals the passage and no note is written
- **THEN** the draft holds no annotation for it

### Requirement: Passages the board does not anchor
The board SHALL anchor an annotation only to the passage the user selected. It SHALL refuse a passage that is blank, longer than 2,000 characters, outside the document, one of several selected ranges, overlapping an annotation, or repeated in the document with 200 characters of context, and SHALL say why beside the toolbar, never only in the console (NFR-10, AD-10).

#### Scenario: An overlapping passage
- **WHEN** the user selects text that overlaps comment 2 and presses "Comment"
- **THEN** no card opens, and the toolbar's message says the passage overlaps comment 2

#### Scenario: A repeated passage
- **WHEN** the user selects a sentence the document repeats with the same context and presses "Suggest edit"
- **THEN** no card opens, and the message asks for a longer passage

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
When the agent changes a Document review's document, a held annotation whose quote no longer has exactly one place, or whose place overlaps an earlier one, SHALL be listed under the document as detached, with its quote, its text and "Delete", and never moved or dropped. While one is listed, the question's "Answer", "Accept recommended", "Select recommended" and Submit SHALL not send it, and the hint SHALL say why, except on a revision the board cannot show (AD-10, NFR-10).

#### Scenario: A commented sentence rewritten
- **WHEN** the user has commented on "remembers" and the agent's revision replaces that word, and the user keeps the draft
- **THEN** the comment is listed as detached, "Answer" sends nothing, and the hint says to delete the detached comments first

#### Scenario: The detached comment deleted
- **WHEN** the user deletes the detached comment
- **THEN** the hint is gone and "Answer" sends the remaining annotations

#### Scenario: A passage the revision kept
- **WHEN** the agent's revision changes another paragraph only
- **THEN** each annotation keeps its place, mark and pin

#### Scenario: Inside a hidden tab
- **WHEN** a Document review with a detached annotation sits in a Tabs layout's tab that is not selected
- **THEN** that tab shows its mark

### Requirement: A Document review at the keyboard
The document SHALL be one Tab stop whose Up, Down, Home and End move the current block (a paragraph, heading, list item, table cell or code block), and whose Left and Right move between the current block's pins; Enter opens the current pin's card. With no text selected, "Comment" and "Suggest edit" SHALL anchor the current block's text. The toolbar SHALL be another Tab stop (EXPERIENCE, Accessibility Floor).

#### Scenario: A comment from the keyboard
- **WHEN** the user tabs into the document, presses Down twice, then tabs to the toolbar and presses "Comment"
- **THEN** the card opens for the third block's text, and typing writes the comment

#### Scenario: A block too long to quote
- **WHEN** the current block holds 2,500 characters and the user presses "Comment" with no text selected
- **THEN** no card opens, and the message asks for a shorter passage selected with the pointer

### Requirement: Links in a Document review
A link in a Document review SHALL open as a Markdown Text's link does. The board page SHALL open it only when the URL passes the contract's link check and the item the message names is a Document review of the board document, at any depth of its question's layouts. In a Snapshot it SHALL open in a new tab with no opener and no referrer (AD-8).

#### Scenario: A link clicked
- **WHEN** the user clicks an `https:` link in a Document review on the live board
- **THEN** the board page opens it in a new tab

#### Scenario: A message naming another item
- **WHEN** an open-link message names a Chart's item ID
- **THEN** the board page opens nothing and logs the refusal with no agent text

### Requirement: A Document review read-only and in Snapshots
Once its question is answered, locked or shown in a Snapshot, a Document review SHALL show its annotations' marks and pins and open their cards read-only, with no toolbar, "Edit" or "Delete". An annotation that has no place in the shown revision SHALL be listed as detached, without actions (AD-15, FR-26).

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

### Requirement: Document review strings
Every string a Document review shows SHALL come from the view's tables in en-US and it-IT: the toolbar, the counter, the cards, the detached list, the refusals and the hint (FR-34; EXPERIENCE, Voice and Tone).

#### Scenario: An Italian board
- **WHEN** an ask in it-IT holds a Document review with a comment, a suggested edit and a detached annotation
- **THEN** no English string of the Document review shows in its text, accessible names or titles
