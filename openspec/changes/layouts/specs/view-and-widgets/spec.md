## ADDED Requirements

### Requirement: Items inside layouts
A layout SHALL place the items it holds, each rendered through the port in its own item frame and error boundary. A question SHALL count as visible only when every item at every depth, its layouts included, is ready, and an item that throws at any depth SHALL fail its question (AD-9, AD-10, SM-C2).

#### Scenario: A field inside a Group inside a tab
- **WHEN** the user types in a NumberField that sits in a Group in the second tab, then reloads the board
- **THEN** the value is in the draft record under the NumberField's ID, comes back after the reload, and "Answer" sends it

#### Scenario: A nested item that throws
- **WHEN** a component inside a Row throws while rendering
- **THEN** the item shows its error state, its question offers no "Answer", and the rest of the board stays usable

#### Scenario: Chunks of nested items
- **WHEN** a board's only TextField sits in a Group
- **THEN** the board's srcdoc holds the `group` and `text-field` chunks

### Requirement: Stack and Group
A Stack SHALL show its items one under another. A Group SHALL show its title and its description above its items in a bordered frame, and SHALL be exposed as a group named by its title. Titles and descriptions SHALL show as text (AD-8; EXPERIENCE and DESIGN, Layouts).

#### Scenario: A Group read by assistive technology
- **WHEN** a Group titled "Contact" holds two TextFields
- **THEN** the accessibility tree holds a group named "Contact" around both fields

### Requirement: Row
A Row SHALL show its items side by side, each taking its weight's share of the Row's width, while every item gets at least 240 px; otherwise it SHALL show them one under another, in order. Widths SHALL reach the view through classes, never a `style` attribute (AD-8; DESIGN, Layouts).

#### Scenario: Wide and narrow
- **WHEN** a Row of two items weighted 2 and 1 is 960 px wide, then 400 px wide
- **THEN** the items first sit side by side with the first twice as wide, then one under another, and no `style` attribute or CSP report appears

### Requirement: Tabs inside a question
Tabs SHALL show one tab per entry with its title, select the first, keep every panel mounted and hidden but the selected one, follow Radix's keyboard, and be labelled by their question's text. Switching SHALL stay possible on an answered or locked question and in a Snapshot (AD-9; EXPERIENCE, Keyboard core, Tab order).

#### Scenario: The keyboard
- **WHEN** focus is on the first tab and the user presses ArrowRight, then End, then Tab
- **THEN** the second tab is selected, then the last, and focus moves into the last tab's panel

#### Scenario: Items in hidden panels
- **WHEN** a question's third tab holds a Gantt and the board opens
- **THEN** the question counts as visible without showing that tab, and the Gantt draws at the panel's width once its tab is selected

#### Scenario: After a reload
- **WHEN** the user selects the second tab, types in a field there, and reloads
- **THEN** the Tabs show their first tab, and the field's text is back in the second

### Requirement: A tab holding a field to correct
A tab whose panel holds, at any depth, a field with an entry SHALL show the field-error mark, and its accessible name SHALL say so, in en-US and it-IT; the mark SHALL clear once the entry is corrected or cleared (NFR-10, AD-20; EXPERIENCE, Voice and Tone).

#### Scenario: An entry in a hidden tab
- **WHEN** the user types `12,5` in an en-US NumberField of the second tab and selects the first tab
- **THEN** the second tab carries the mark and reads "needs a correction", and "Answer" stays disabled until the field is corrected

### Requirement: Layouts end to end
On the session process, a question arranged with layouts SHALL be answered with its results keyed by item ID at every depth through `collect`, SHALL come back from the draft after a reload, and an agent change to an item inside a layout SHALL show the agent-change notice naming that item's widget (FR-6, FR-13, FR-20).

#### Scenario: Answered through collect
- **WHEN** the user fills the arranged question's fields in several tabs and answers
- **THEN** `collect` returns one answer whose `results` hold each field's item ID

### Requirement: Layouts in Snapshots
A Snapshot SHALL show layouts as the board does, read-only, with Tabs still switching, opened from `file://` with no CSP report (FR-26, AD-15).

#### Scenario: A Snapshot of an answered arranged question
- **WHEN** a Snapshot of the answered question is opened from `file://`
- **THEN** each field shows its answered value read-only, the Tabs switch, and no CSP problem is reported
