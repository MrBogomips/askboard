## ADDED Requirements

### Requirement: Graph sources by widget type
`compute` SHALL map a board item of a type other than Tree and Gantt through a table of graph sources by widget type, which a computing widget extends; an item whose type has no source SHALL add nothing. Every registered type that declares derived values SHALL be a Tree, a Gantt or a type of that table (AD-13).

#### Scenario: A source for a test-only type
- **WHEN** a board holds a probe item and the table passed to the mapping holds a source for `probe`
- **THEN** the probe's graph items are in the graph source, in board order with the Tree and Gantt items

#### Scenario: A type with no source
- **WHEN** a board holds an item of a type the table does not hold
- **THEN** the graph source is the same as without that item

#### Scenario: Computing types have sources
- **WHEN** the registry's types that declare derived values are listed
- **THEN** each is `tree`, `gantt` or a type of the table
