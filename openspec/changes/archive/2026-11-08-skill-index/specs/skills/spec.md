## ADDED Requirements

### Requirement: The item catalogue
The skill SHALL hold a generated reference, `references/items.md`, with one line per item type a question's `items` may hold, giving what the type is for: the context item types, then each registered widget type in registry order with its noun, then each ready molecule in order, each with the use its teaching data gives (FR-29, AD-6).

#### Scenario: The Tree in the catalogue
- **WHEN** the skill is generated on the shipped registry
- **THEN** `references/items.md` holds a line naming the Tree's noun and `` `tree` `` with the Tree's use

#### Scenario: A type registered
- **WHEN** the generator runs on a registry with one more widget type
- **THEN** `references/items.md` holds that type's line with its use, `SKILL.md` links that type's reference, and every other line of both files is unchanged

#### Scenario: The catalogue within its budget
- **WHEN** the skill check runs
- **THEN** it measures `references/items.md` against the reference budget of 6,000 characters and fails, naming it, when it is over

### Requirement: Every reference one level from SKILL.md
`SKILL.md` SHALL link the item catalogue, `references/context.md` once for the context items, and each widget type's and ready molecule's reference by its type or name, and SHALL give no per-type use. No generated file other than `SKILL.md` SHALL link to a file of the skill (NFR-1, NFR-11).

#### Scenario: The Tree's link
- **WHEN** the skill is generated on the shipped registry
- **THEN** `SKILL.md` links `` `tree` `` to `references/widgets/tree.md` and does not hold the Tree's use

#### Scenario: Every generated file linked once deep
- **WHEN** the generated files are read
- **THEN** every generated file other than `SKILL.md` is the target of a link in `SKILL.md`, and no file other than `SKILL.md` links to a file of the skill

## MODIFIED Requirements

### Requirement: A reference for each widget type
For each registered widget type, in registry order, the skill SHALL hold one reference file giving when to use it, its props' shape and fields from its props schema, with the bounds of each branch of a field that takes one of several forms, any notes its registry entry gives, what its answer carries (edits, a result, derived values), and its example item; the item catalogue SHALL list it with its use, and `SKILL.md` SHALL link its reference.

#### Scenario: The Tree's reference
- **WHEN** the generator runs on the shipped registry
- **THEN** a Tree reference exists, names every top-level field of the Tree's props schema, says that the answer carries the edited nodes and the derived values, and holds the Tree's example item

#### Scenario: The Gantt's two forms of tasks
- **WHEN** the generator runs on the shipped registry
- **THEN** the Gantt reference says when `tasks` is a list and when it maps a task ID of the Tree that `workPackages` names, and gives each form's bound

#### Scenario: A type without teaching text
- **WHEN** a registered type has no teaching text or no example
- **THEN** the generator fails naming the type

### Requirement: A reference for each ready molecule
For each ready molecule, the skill SHALL hold one reference file giving when to use it, its name and version, its parameters' fields from its parameter schema, and an example molecule reference; the item catalogue SHALL list it with its use, and `SKILL.md` SHALL link its reference (FR-15). When the molecule's teaching data names a companion, the example SHALL be an ask whose question holds the companion's example reference under the ID the teaching data gives, then the molecule's own.

#### Scenario: The WBS with PERT
- **WHEN** the generator runs on the shipped molecules
- **THEN** the `wbs-pert` reference names the parameters `nodes` and `depth` and holds an example reference of type `molecule` naming `wbs-pert`

#### Scenario: The Gantt plan with its work breakdown
- **WHEN** the generator runs on the shipped molecules
- **THEN** the `gantt-plan` reference holds an ask example whose question holds a `wbs-pert` reference under the ID that `gantt-plan`'s teaching data names, then the `gantt-plan` reference

#### Scenario: A molecule without teaching data
- **WHEN** a ready molecule has no teaching data
- **THEN** the generator fails naming the molecule

### Requirement: Every item type named
`SKILL.md` SHALL name, in backticks, every item type of the input format: each non-widget item type of the contract (questions, areas, molecule references and the context items) and each registered widget type, the latter as the text of the link to its reference. It SHALL teach the area's shape and that areas stand at the top level only, holding questions, and that once one top-level item is an area every one is (FR-2, AD-6).

#### Scenario: Every type named
- **WHEN** the generator runs on the contract's non-widget item types and the shipped registry
- **THEN** each of those types is named in `SKILL.md` as `` `<type>` ``

#### Scenario: Areas taught
- **WHEN** the generated `SKILL.md` is read
- **THEN** it gives the area's shape `{type: "area", id, props: {title, items}}`, says areas stand at the top level only and hold questions, and says that once one top-level item is an area every one is
