## MODIFIED Requirements

### Requirement: Approved texts unchanged
The tool definitions and server instructions SHALL stay the approved texts with the amendments the contract records applied, which already teach pointers (`path#Heading`, `path#L10-L40`) and screenshots saved under `.askboard/media/`; E5 adds nothing to them (NFR-1).

#### Scenario: The listed tools
- **WHEN** a client lists the tools after this change
- **THEN** each definition and the instructions equal the approved fixtures with the recorded amendments applied

## ADDED Requirements

### Requirement: The server instructions route by complexity
The server instructions SHALL route by the question's cognitive and contextual complexity, never by a count of questions or options, and give its cases as examples for the agent to judge. A simple, self-explanatory choice SHALL stay with AskUserQuestion, and the user's asking rule or instruction SHALL come first. The instructions SHALL tell the agent to load the `askboard` skill before its first `ask`, and never to put a complex question in chat prose (FR-29, FR-30, AD-6).

#### Scenario: The routing paragraph
- **WHEN** a client reads the server instructions
- **THEN** they name many interconnected questions, questions that cite documents by bare IDs and content that reads better seen and worked on, say these are examples to judge by, keep a simple, self-explanatory choice with AskUserQuestion, and hold neither "more than four" nor "one quick choice"

#### Scenario: The skill line
- **WHEN** a client reads the server instructions
- **THEN** one line tells the agent to load the `askboard` skill before its first `ask`

#### Scenario: Not in chat prose
- **WHEN** a client reads the server instructions
- **THEN** one line tells the agent never to put a complex question in chat prose but to ask it on the board

#### Scenario: Within the limits
- **WHEN** a client reads the server instructions
- **THEN** they are at most 4,096 characters and never name `snapshot`

### Requirement: The ask description points to the skill
The `ask` tool's description SHALL tell the agent to load the `askboard` skill before its first `ask`, the skill saying when to ask on the board and listing every item type and its props (FR-29, AD-6).

#### Scenario: The ask description
- **WHEN** a client lists the tools
- **THEN** `ask`'s description tells the agent to load the `askboard` skill before its first ask, and stays within 4,096 characters
