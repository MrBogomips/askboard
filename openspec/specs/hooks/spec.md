# hooks Specification

## Purpose
The hooks tell the session process which agent makes each AskBoard call, show the user the terminal link of the main conversation's asks, enforce the asking rule on AskUserQuestion and keep a subagent from finishing before it has received its answers, without ever blocking the agent's own calls (AD-5, AD-10, AD-16, AD-19).

## Requirements

### Requirement: An agent record for every AskBoard call
A `PreToolUse` hook on every AskBoard tool SHALL send the session process an agent record: `agent_id` (absent for the main conversation), `agent_type`, `cwd`, `tool_use_id`, the tool name, the ask IDs the call names and a timestamp. It SHALL then exit with no decision, so the call proceeds (AD-5).

#### Scenario: A subagent asks
- **WHEN** a subagent calls `ask`
- **THEN** the session process holds a record with that subagent's `agent_id` and `agent_type`, its `cwd` and the call's `tool_use_id` before the call reaches it

#### Scenario: The main conversation collects
- **WHEN** the main conversation calls `collect` on two asks
- **THEN** the record has no `agent_id` and names both ask IDs

### Requirement: Matching AskBoard's tool names
The hooks SHALL match AskBoard's tools both as `mcp__plugin_askboard_askboard__<tool>` and as `mcp__askboard__<tool>` (Consistency Conventions, MCP names).

#### Scenario: The server loaded from an MCP configuration
- **WHEN** AskBoard's server is loaded under the name `askboard` from an MCP configuration beside the plugin
- **THEN** its calls still produce agent records

### Requirement: A hook that cannot reach the session process
When the session file is missing, the session process cannot be reached, or it answers with a major the hook does not support, the hook SHALL exit 0 with no decision and write one line to stderr saying why. Each hook SHALL declare a timeout of 5 s (AD-7, AD-19).

#### Scenario: No session file
- **WHEN** the `PreToolUse` hook runs and finds no session file for its Claude Code process
- **THEN** it exits 0 with no decision within its timeout, and the call proceeds unchecked

#### Scenario: The session process does not answer
- **WHEN** the local API does not answer within the hook's request timeout
- **THEN** the hook exits 0 with no decision before its 5 s timeout

### Requirement: Terminal link for the main conversation's asks
A `PostToolUse` hook on `ask` SHALL show the user the board link of an ask the main conversation created, as a system message, with the ask's title as the session process holds it, or the link alone when the session process cannot be reached. For a subagent's ask, or a result that created no ask, it SHALL show nothing, since Claude Code files a subagent's message in its own transcript (FR-23, finding row 12).

#### Scenario: The main conversation asks
- **WHEN** the main conversation's `ask` returns a board link
- **THEN** the terminal shows a system message with the ask's title and its link

#### Scenario: The local API is unreachable
- **WHEN** the main conversation's `ask` returns a board link and the session file cannot be found
- **THEN** the terminal still shows a system message with the link

#### Scenario: A subagent asks
- **WHEN** a subagent's `ask` returns a board link
- **THEN** the hook returns no system message, and the subagent's context gains nothing

#### Scenario: No board could be shown
- **WHEN** `ask` returns `unavailable` or an error
- **THEN** the hook returns no system message

### Requirement: The stop guard blocks once with what the subagent has not received
A `SubagentStop` hook SHALL block the stop when an open ask the subagent owns holds events above `received` and the input's `stop_hook_active` is false. The block's reason SHALL carry those events in the contract's push message and list the subagent's open asks (AD-10, FR-25).

#### Scenario: An answer the subagent never collected
- **WHEN** a subagent stops while its ask holds an answer above `received`
- **THEN** the stop is blocked, and the subagent's next input carries the answer with its cursor and the list of its open asks

#### Scenario: The second stop
- **WHEN** the subagent stops again with `stop_hook_active` true
- **THEN** the stop is let through, even if events arrived meanwhile

### Requirement: The stop guard lets every other stop through
The `SubagentStop` hook SHALL let a stop through, with no error, when the subagent has no open ask holding events above `received`, when its asks have no bound owner, and when the session process has no record of the agent, such as Claude Code's own side agents. Whenever it lets a stop through, it SHALL tell the session process (AD-10).

#### Scenario: A side agent stops
- **WHEN** a Claude Code side agent with an empty `agent_type` stops
- **THEN** the stop goes through with no error and no message

#### Scenario: A subagent with nothing pending
- **WHEN** a subagent whose asks hold nothing above `received` stops
- **THEN** the stop goes through, and the session process is told that the subagent finished

### Requirement: The asking-rule hook
A `PreToolUse` hook on AskUserQuestion SHALL refuse the call, with a reason pointing to AskBoard, when the effective asking rule's predicate sends the question to AskBoard, and only while the session process is reachable and reports that it can show boards; otherwise it SHALL let the call through. The hooks implement the predicates of `none`, which sends nothing, and `always`, which sends every question; `with-references`' comes with the rule's source (E8) (AD-16, FR-30, NFR-8).

#### Scenario: The rule is none
- **WHEN** the effective rule is `none`
- **THEN** AskUserQuestion proceeds

#### Scenario: The rule is always
- **WHEN** the effective rule is `always` and the session process can show boards
- **THEN** AskUserQuestion is refused with a reason telling the agent to ask through AskBoard

#### Scenario: No board can be shown
- **WHEN** the effective rule is `always` but the session process reports that no board can be shown, or cannot be reached
- **THEN** AskUserQuestion proceeds

### Requirement: The with-references predicate
Under the asking rule `with-references`, the AskUserQuestion hook SHALL send a call to AskBoard when any of its questions' `question` or `header`, or any option's `label`, `description` or `preview`, holds an `http:` or `https:` URL or a project-file pointer: a relative path ending in a file extension that holds a `/` or is followed by `#` and an anchor or by `:` and a line (FR-30, AD-16). Otherwise the call SHALL proceed.

#### Scenario: A question with a pointer goes to AskBoard
- **WHEN** the rule is `with-references` and a question reads "Keep the retry in `src/retry.ts#L40-L62`?"
- **THEN** the hook refuses AskUserQuestion with a reason pointing to AskBoard

#### Scenario: A question with a URL in an option goes to AskBoard
- **WHEN** the rule is `with-references` and an option's description holds `https://example.com/adr/12`
- **THEN** the hook refuses AskUserQuestion

#### Scenario: A plain question proceeds
- **WHEN** the rule is `with-references` and no question or option holds a URL or a pointer
- **THEN** the call proceeds with no decision

#### Scenario: Words with a dot are not pointers
- **WHEN** the rule is `with-references` and a question reads "Use Node.js or e.g. Bun?"
- **THEN** the call proceeds

#### Scenario: A file at the root with an anchor
- **WHEN** the rule is `with-references` and a question reads "See README.md#Install first?"
- **THEN** the hook refuses AskUserQuestion
