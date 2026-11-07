## ADDED Requirements

### Requirement: Answers of nested items
`ask-core` SHALL take an answer's values, results and derived values for items inside a question's layouts, at any depth, as for its own items, keyed by item ID. A value or result keyed by a layout SHALL refuse the answer, appending and publishing nothing (FR-13, FR-18, AD-10, AD-20).

#### Scenario: A result two layouts deep
- **WHEN** the user answers a question whose NumberField `days` sits in a Group in the first tab of a Tabs
- **THEN** the answer event's `results` hold `days`, and `collect` returns it

#### Scenario: A result for a layout
- **WHEN** an answer act carries a result keyed by the Tabs' ID
- **THEN** the act is refused, and nothing is appended or published

#### Scenario: A plan and its Tree in two tabs
- **WHEN** a question's first tab holds the Tree `wbs` and its second tab a Gantt plan naming `wbs`
- **THEN** the ask passes the send-time graph check, and the answer carries the plan's derived values

### Requirement: Changing a nested item or a layout
An `update` `change` naming an item inside a layout, at any depth, or a layout SHALL merge the given props into its props key by key, check its question as an ask's is, and raise the question's `rev`; a question whose latest answer is logged SHALL NOT change unless reopened (FR-6, AD-20).

#### Scenario: A nested field's bound
- **WHEN** the agent changes the `max` of a NumberField inside a Group of an open question at `rev` 1
- **THEN** the question is at `rev` 2, the NumberField holds the new `max`, and every other item is as it was

#### Scenario: A Tabs' tabs replaced
- **WHEN** the agent changes a Tabs' `tabs` to a list whose new tab holds a TextField
- **THEN** the question is at its next `rev` with the new tabs, and the TextField is checked as an ask's item is

### Requirement: Item IDs unique across the ask on update
An `update`'s `add` and `change` SHALL refuse an item, at any depth, whose ID another question of the ask holds at any depth, naming the ID, and the update SHALL leave the ask unchanged (FR-5, FR-6).

#### Scenario: Adding a question with a used ID
- **WHEN** the agent adds a question holding a TextField `name` while another question's Group holds an item `name`
- **THEN** the update is refused, naming `name` as in use, and the ask is unchanged

#### Scenario: Changing a question to hold a used ID
- **WHEN** the agent changes a question's `items` to hold a Toggle with the ID of a Tree in another question
- **THEN** the update is refused, naming the ID

### Requirement: Fetching nested items and layouts
`fetch` of an item inside a layout SHALL return that item alone as the user left it, with its question's state. `fetch` of a layout SHALL return it with every item inside it as the user left it, and a fetched question SHALL hold its layouts the same way (FR-20, AD-9).

#### Scenario: Fetching a nested Tree
- **WHEN** the agent fetches a Tree inside a tab after the user answered with an added node
- **THEN** the result holds the Tree with the added node, and the question's state

#### Scenario: Fetching a Group
- **WHEN** the agent fetches a Group whose Tree the user edited
- **THEN** the result holds the Group with its title and its Tree as the user left it
