# Spec Delta

## ADDED Requirements

### Requirement: Snapshot data schema set
The contract SHALL hold the `snapshot-data` set at version 1.0, owned by `snapshot` (AD-7), whose one schema describes a Snapshot's `askboard-data` block. Like every set, it SHALL refuse fields it does not define and SHALL have no root combinator.

#### Scenario: The set is listed
- **WHEN** the contract's schema sets are listed
- **THEN** `snapshot-data` is among them at 1.0, with `snapshot` as its owner

### Requirement: What the Snapshot data names
The Snapshot data SHALL name its versions (the set's, the output format's and the board protocol's), the epoch and the ask ID, and SHALL hold the Snapshot's record: `takenAt` in UTC, `takenBy` (`agent` or `user`), `who` for the user's, and `unsentWork: true` only for a board's Snapshot taken with unsent work (AD-15).

#### Scenario: The agent's Snapshot
- **WHEN** the Snapshot data of an agent's Snapshot is validated
- **THEN** it passes with `takenBy: "agent"`, a UTC `takenAt` and no `who` or `unsentWork`

#### Scenario: A user's Snapshot without its taker
- **WHEN** Snapshot data with `takenBy: "user"` and no `who` is validated
- **THEN** it fails, naming `who`

### Requirement: What the Snapshot data holds
The Snapshot data SHALL hold the current board document, the earlier revisions its events name, the board state as the board protocol carries it, the ask's origin as the board protocol's `origin` message carries it when known, and every event of the log, each with the full values kept for its answer; optionally the molecule expansion map and kept diagram renders (AD-15, open questions A1 and A2).

#### Scenario: The fixture validates
- **WHEN** the contract's Snapshot data fixture, with areas, a postponed question, a thread with a reply, a recorded answer and a revised answer, is validated
- **THEN** it passes against the `snapshot-data` schema

#### Scenario: A draft in the data
- **WHEN** Snapshot data carries a `draft` field
- **THEN** it fails validation, naming the field

### Requirement: The snapshot tool's envelopes
The tool envelopes SHALL define the `snapshot` request as the approved definition's input schema (`askId` only) and its result: the versions, epoch, ask ID, the ask's state, the file's absolute `path`, and `unchecked: true` for an ask without an owner; and the typed result `discarded` naming the ask (AD-6, FR-26).

#### Scenario: A result validates
- **WHEN** the Snapshot fixture's `snapshot` result is validated against the `snapshot` result envelope
- **THEN** it passes and names a result and an output version

#### Scenario: A relative path
- **WHEN** a `snapshot` result whose `path` does not start with `/` is validated
- **THEN** it fails, naming `path`

### Requirement: The approved snapshot definition
The contract's tool definitions SHALL be the approved `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, equal to the approved `tools.json`, with `snapshot`'s description and annotations unchanged (`destructiveHint: false`, `openWorldHint: false`). The server instructions SHALL stay the approved text.

#### Scenario: The tool definitions
- **WHEN** the contract's tool definitions are compared with the approved `tools.json`
- **THEN** they are equal, all five entries in order

### Requirement: Snapshot messages on the board protocol
The board protocol SHALL define, page to host, `snapshot` with a `requestId` and an optional `unsentWork: true`; and host to page, `snapshot-saved` with the `requestId` and the file's absolute `path`, and `snapshot-failed` with the `requestId`, a `reason` of `write-failed`, `no-project-root`, `internal-error` or `discarded`, and the Snapshot folder's path for `write-failed` only (FR-26, AD-12).

#### Scenario: A request without its ID
- **WHEN** a `snapshot` message without `requestId` is validated
- **THEN** it fails, naming `requestId`

#### Scenario: A failure inside AskBoard names no folder
- **WHEN** a `snapshot-failed` with the reason `internal-error` and a `folder` is validated
- **THEN** it fails, naming `folder`

#### Scenario: The recorded exchange
- **WHEN** the recorded transcript of a board's Snapshot, saved and then failed, is validated in both directions
- **THEN** every message passes

### Requirement: Host-only and kept-render chunks
The view manifest SHALL admit, at its next minor, an optional `hostOnly: true` on a chunk needed only when the view has a parent host, and an optional `keptRender` on a component chunk naming the chunk that shows its kept renders (AD-9, open questions B2 and B3).

#### Scenario: A host-only chunk
- **WHEN** a manifest whose ext-apps chunk carries `hostOnly: true` is validated
- **THEN** it passes

#### Scenario: A kept-render chunk that does not exist
- **WHEN** a manifest names in `keptRender` a chunk it does not list
- **THEN** the view build's manifest check fails, naming both chunks

### Requirement: Snapshot constants
The contract SHALL hold, as shared constants, the default Snapshot folder `.askboard/snapshots`, the lines of `.askboard/.gitignore`, the file-name pattern, the random part's length and alphabet, the number of names tried, and the IDs of the `askboard-data` and `askboard-licences` elements; no unit SHALL define its own.

#### Scenario: The data element's ID
- **WHEN** `assemble` writes a Snapshot and the contract's tests read the element ID
- **THEN** both use the contract's `askboard-data`

### Requirement: Snapshot registrations are appended
Every schema, export and fixture this change adds SHALL be registered by entries appended after the existing ones (`sets.ts`, `SCHEMA_IDS`, the board protocol's message lists, and one export block at the end of `src/index.ts`, `src/validate.ts` and `src/fixtures/index.ts`), and importing the contract SHALL register nothing.

#### Scenario: Existing order kept
- **WHEN** the contract's sets, schema IDs and board-protocol messages are listed
- **THEN** the entries before this change's keep their order, and this change's follow them
