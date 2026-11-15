# Spec Delta

## MODIFIED Requirements

### Requirement: The release workflow
A release SHALL run only from a manual dispatch on `main`. Before publishing it SHALL fail when the versions disagree, the tag `v<version>` exists, `CHANGELOG.md` has no section for the version, the Claude Code `stable` channel is below the declared minimum (AD-18), the repository checks fail, or the tree's start script does not answer the handshake on Node 24 on macOS and on Linux. Publishing SHALL be its only step with write access.

#### Scenario: A release that passes its gates
- **WHEN** the workflow is dispatched on `main` at a version with a CHANGELOG section and no tag
- **THEN** the `release` branch gains one commit holding the tree, tagged `v<version>`, and a GitHub release `v<version>` holds the bundle, the tree as an archive and a SHA-256 file for both, with the CHANGELOG section as its notes

#### Scenario: A version already released
- **WHEN** the workflow is dispatched and the tag `v<version>` exists
- **THEN** it fails before building, naming the tag, and pushes nothing

#### Scenario: The build's artifact replaced during the run
- **WHEN** another job of the release run replaces or deletes the artifact the build job uploaded
- **THEN** publishing fails to download it, and nothing is pushed or released

## ADDED Requirements

### Requirement: The release gate runs the end-to-end suites
Before publishing, a release SHALL fail when the browser suite or the conformance suite fails on macOS in the weekly cadence's set of files (NFR-7, AD-1).

#### Scenario: A browser test fails on macOS
- **WHEN** the workflow is dispatched and one browser test of the weekly set fails on macOS in WebKit
- **THEN** publishing does not run, and nothing is pushed or released

### Requirement: An engine left out of the release gate
The release gate MAY leave out one browser engine on macOS only while open Issues track that engine's failures there, and the workflow SHALL name those Issues where it leaves the engine out. That engine SHALL still run the smoke set on Linux in the gate (NFR-7).

#### Scenario: An engine left out while its failures are tracked
- **WHEN** the workflow is dispatched while open Issues track Firefox's failures on macOS, and the workflow names them where it leaves Firefox out
- **THEN** the gate runs the weekly set in Chromium and WebKit only, runs the smoke set in Firefox on Linux, and the nightly and weekly cadences still run Firefox

### Requirement: The release publishes its own build
The publishing job SHALL publish only the artifact its own build job produced, read by that artifact's ID (AD-19).

#### Scenario: The build's artifact replaced during the run
- **WHEN** another job of the release run replaces or deletes the artifact the build job uploaded
- **THEN** publishing fails to download it, and nothing is pushed or released
