## ADDED Requirements

### Requirement: Asking-rule texts
The contract SHALL hold one agent-facing text for each asking rule of its closed set, in the set's order, and no text for a name outside it. The `with-references` text SHALL be the text that describes the hook's predicate (AD-16, FR-30).

#### Scenario: One text per rule
- **WHEN** the asking-rule texts are read
- **THEN** there is exactly one non-empty text for each of `none`, `always` and `with-references`, in that order

#### Scenario: The with-references text
- **WHEN** the `with-references` text is compared with the description of the hook's predicate
- **THEN** they are the same text

### Requirement: A widget type's teaching text
A widget type's registry entry MAY carry teaching text: when to use the widget, 1 to 200 characters, and notes, each 1 to 300 characters. The registry check SHALL refuse teaching text outside those bounds, naming the type; every shipped type SHALL carry teaching text (FR-29).

#### Scenario: Shipped types carry teaching text
- **WHEN** the shipped registry is read
- **THEN** every entry has a teaching text of 1 to 200 characters

#### Scenario: A teaching text too long
- **WHEN** the registry check runs on an entry whose teaching text has 201 characters
- **THEN** it reports a problem naming the type
