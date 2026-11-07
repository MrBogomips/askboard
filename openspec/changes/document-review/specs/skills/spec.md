## ADDED Requirements

### Requirement: The item index line
Each line of `SKILL.md`'s item index SHALL be `` - [`<type>`](<reference>): <use> ``, a Markdown link from the item type to its reference, then its use. Every use the index shows, of a widget type, a molecule or a context item, SHALL be at most 70 characters, and the generator SHALL fail on a longer one, naming the type (AD-6, NFR-1).

#### Scenario: The Tree's line
- **WHEN** the skill is generated on the shipped registry
- **THEN** `SKILL.md` holds a line starting `` - [`tree`](references/widgets/tree.md): `` followed by the Tree's use, and the linked file exists

#### Scenario: A use too long
- **WHEN** the generator runs on a registry whose probe type has a use of 71 characters
- **THEN** it fails, naming the type and the limit

#### Scenario: The Document review within the budget
- **WHEN** the skill is generated with the Document review registered
- **THEN** `check:skills` passes, and its figures print the characters `SKILL.md` has left under 9,000
