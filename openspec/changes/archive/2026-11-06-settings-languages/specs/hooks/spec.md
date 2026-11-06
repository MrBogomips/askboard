# Spec Delta

## ADDED Requirements

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
