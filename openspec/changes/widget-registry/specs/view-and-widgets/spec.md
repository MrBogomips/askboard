## ADDED Requirements

### Requirement: Component facts through the port
A component chunk SHALL register, with its component, the facts the shell needs of its type: its element shape when the user edits the agent's content, and its name in the agent-change notice. The shell SHALL hold no table by widget type, and a widget whose chunk gives no name SHALL be named by its type (AD-9).

#### Scenario: The Tree and Gantt notices as before
- **WHEN** the agent changes a Tree and a Gantt plan under unsent work and the user opens "Show the agent's change"
- **THEN** each is listed by its name, "Tree" or "Gantt", with the number of element operations, as before this change

#### Scenario: The facts agree with the registry
- **WHEN** the widget chunks' registrations are read beside the contract's registry
- **THEN** each registered widget type's chunk gives the element shape its registry entry gives, and a name

### Requirement: Widget results only fill the draft
A component SHALL put its result into the draft record through the port, apart from its edited value, and SHALL send nothing; it SHALL hold no result while the user has given none. A held result SHALL be mirrored, restored, held for Submit, kept on "Keep mine" and dropped on "Reload" as a widget's edited value is (AD-9, AD-10, AD-20).

#### Scenario: A result reported
- **WHEN** a component reports a result and then reports none
- **THEN** the question's draft record holds the result under `results`, then holds no entry for the item, and no view message leaves the view

#### Scenario: A reload keeps a held result
- **WHEN** the draft record mirrored to `board-host` holds a result and the tab reloads
- **THEN** the restored draft gives the component that result

### Requirement: Answered results shown read-only
An answered question SHALL give each widget the result its latest logged answer holds for it, read-only, after a reload or a takeover too; a widget with no logged result SHALL get none (AD-20, AD-21).

#### Scenario: A reload after an answer with a result
- **WHEN** the board state's answer to a question holds `results` for one of its items and the tab reloads
- **THEN** that item's component gets the logged result and is disabled

### Requirement: Results in the view protocol and the board page
The view protocol SHALL take `results` as an answer's content beside a choice, widget values and "Other…" text, and derived values SHALL come only beside one of them; the board page SHALL refuse to send an answer whose `results` name an item that is not a widget item of its question (AD-10, AD-20).

#### Scenario: Results alone
- **WHEN** the view sends an answer whose only content is `results`
- **THEN** the board page accepts it and sends one `act` whose answer carries those results

#### Scenario: A result for another question's item
- **WHEN** the view sends an answer whose `results` name an item of another question
- **THEN** the board page refuses it, naming the key, and sends nothing to `board-host`

#### Scenario: Derived values beside a result
- **WHEN** the view sends an answer with `results` and `derived`
- **THEN** the board page accepts it

### Requirement: Registered widget types have chunks
The view build SHALL fail when a widget type the contract's registry holds has no component chunk registering it, naming the type, or when a chunk folder under `packages/widgets/src/` registers no registered type, naming the folder. The board graph's code SHALL live in `packages/widgets/src/board-graph/`, so that no widget type's folder name is taken (AD-9).

#### Scenario: A registered type with no chunk
- **WHEN** the build runs with a registry that holds `probe` and no chunk registers `probe`
- **THEN** it fails, naming `probe`

#### Scenario: A widget chunk with no registered type
- **WHEN** the build finds `packages/widgets/src/kanban/index.tsx` and the registry holds no `kanban`
- **THEN** it fails, naming the folder

#### Scenario: Today's catalogue
- **WHEN** the view is built
- **THEN** it passes, the manifest lists the component chunks `tree` and `gantt` and the library chunk `board-graph` as before, and no folder `packages/widgets/src/graph` exists

## MODIFIED Requirements

### Requirement: Answering a question with a widget
"Answer" SHALL be enabled once the question has a choice, a widget holds a change or a widget holds a result. It SHALL send one answer message carrying the chosen options, if any, the full edited value of each changed widget item in its input-format shape, and the result of each widget that holds one, and nothing for an untouched one. The question SHALL then be read-only (AD-10, AD-20, FR-22).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved UJ-2 answer's `wbs` edits with the keyboard and presses "Answer"
- **THEN** one answer message leaves the view, its Tree value validates as an edited value, and the contract's diff of the sent and the edited value equals the approved `wbs` operations

#### Scenario: Nothing changed
- **WHEN** a Tree question opens and the user only moves the focus and expands and collapses nodes
- **THEN** "Answer" stays disabled

#### Scenario: A result alone
- **WHEN** a question's only content is a result its widget holds in the draft record
- **THEN** "Answer" is enabled, and the answer it sends carries `results` with that result and no `values`
