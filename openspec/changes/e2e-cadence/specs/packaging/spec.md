# Spec Delta

## MODIFIED Requirements

### Requirement: The release workflow
A release SHALL run only from a manual dispatch on `main`. Before publishing it SHALL fail when the versions disagree, the tag `v<version>` exists, `CHANGELOG.md` has no section for the version, the Claude Code `stable` channel is below the declared minimum (AD-18), the repository checks fail, the tree's start script does not answer the handshake on Node 24 on macOS and on Linux, or the browser suite and the conformance suite fail on macOS in the weekly cadence's set (NFR-7, AD-1). Publishing SHALL be its only step with write access.

#### Scenario: A release that passes its gates
- **WHEN** the workflow is dispatched on `main` at a version with a CHANGELOG section and no tag
- **THEN** the `release` branch gains one commit holding the tree, tagged `v<version>`, and a GitHub release `v<version>` holds the bundle, the tree as an archive and a SHA-256 file for both, with the CHANGELOG section as its notes

#### Scenario: A version already released
- **WHEN** the workflow is dispatched and the tag `v<version>` exists
- **THEN** it fails before building, naming the tag, and pushes nothing

#### Scenario: A browser test fails on macOS
- **WHEN** the workflow is dispatched and one browser test of the weekly set fails on macOS in WebKit
- **THEN** publishing does not run, and nothing is pushed or released
