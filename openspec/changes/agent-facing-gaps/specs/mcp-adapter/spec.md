## MODIFIED Requirements

### Requirement: Tool list
The session process SHALL list exactly `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, with the input schemas, descriptions and annotations of the approved model contract, as amended by the amendments the contract records, and the list SHALL NOT change during a session. Each description, and the server instructions, SHALL stay within 4,096 characters, and each full tool name within 128.

#### Scenario: Listing the tools
- **WHEN** a client lists the tools
- **THEN** it receives `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, matching the approved definitions of the contract fixtures with the recorded amendments applied

#### Scenario: A definition grows too long
- **WHEN** a tool description or the server instructions exceed 4,096 characters
- **THEN** the adapter's tests fail

#### Scenario: The update description names reply's fields
- **WHEN** a client reads the `update` tool's description
- **THEN** it says that a reply names its question in `itemId` and its follow-up's cursor in `followUp`, and that a widget joins a question through a change of the question's `items`, sent whole

### Requirement: Server instructions for the tools listed
The server instructions SHALL be the approved model contract's instructions, as amended by the amendments the contract records, keeping only the lines that apply to the tools listed.

#### Scenario: No instruction names a missing tool
- **WHEN** a client reads the server instructions
- **THEN** they name no tool other than the four listed, `ask`, `update`, `collect` and `fetch`, and never `snapshot`, which E7 adds

#### Scenario: The instructions are the approved text
- **WHEN** a client reads the server instructions
- **THEN** they equal the approved `server-instructions.md` with the recorded amendments applied, uncut

#### Scenario: The follow-up line names the question
- **WHEN** a client reads the server instructions' line on follow-ups
- **THEN** it says that the `reply` names the question's `itemId` and the follow-up's cursor

### Requirement: Fetching an item
`fetch` SHALL return one item of an open or closed ask as `ask-core` holds it now: its type, `rev` and props, and for a question its state and current answer in full. It SHALL return nothing from the draft record, SHALL NOT raise `received`, and an item ID the ask does not hold and never deleted SHALL be an error naming it (FR-20, AD-6).

#### Scenario: Fetching after a revision
- **WHEN** the user answered `database` with `PostgreSQL`, then revised it to `SQLite`, and the agent fetches `database`
- **THEN** the result holds the question at its `rev` with the answer `SQLite` and its cursor

#### Scenario: Fetching a closed ask
- **WHEN** an agent fetches a question of an ask it closed
- **THEN** the result holds the question and its answer as they were at the close

#### Scenario: An item the ask never held
- **WHEN** an agent fetches `budget` from an ask that has never held an item `budget`
- **THEN** the result is an error naming the ask and `budget`

#### Scenario: An item a change dropped
- **WHEN** the agent changed question `plan`'s `items` to a list without the TextField `owner`, then fetches `owner`
- **THEN** the result is an error naming the ask and `owner`, never the outcome `deleted`

## ADDED Requirements

### Requirement: A deleted item in fetch
`fetch` of an item the agent deleted, or of an item at any depth inside a question or area it deleted, SHALL return the typed result `deleted`, naming the ask and the item, never an error. It SHALL carry the versions and the epoch, and `unchecked: true` while the ask has no owner (FR-5, FR-6, AD-6, AD-10).

#### Scenario: A deleted question
- **WHEN** the agent deletes question `erp-export` with `update`, then fetches `erp-export`
- **THEN** the result is the typed outcome `deleted` naming the ask and `erp-export`, and it is not marked as an error

#### Scenario: An item inside a deleted question
- **WHEN** the agent deletes question `plan`, which holds a Group `owner-group` holding the TextField `owner`, then fetches `owner`
- **THEN** the result is the outcome `deleted` naming `owner`

#### Scenario: A molecule reference inside a deleted question
- **WHEN** the agent deletes the UJ-2 question `plan`, which holds the molecule references `wbs` and `schedule`, then fetches `wbs`, and then `wbs__tree`
- **THEN** `wbs` gives the outcome `deleted` naming `wbs`, and `wbs__tree`, an expanded ID the agent never sent, gives the error for an item the ask never held

#### Scenario: A deleted item of an unchecked ask
- **WHEN** an ask sent with no agent record has a question deleted, and the agent fetches it
- **THEN** the outcome `deleted` carries `unchecked: true`

#### Scenario: A discarded ask still wins
- **WHEN** the ask that held a deleted question is discarded, and the agent fetches that question
- **THEN** the result is the outcome `discarded` naming the ask
