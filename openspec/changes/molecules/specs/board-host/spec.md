# Spec Delta

## Purpose

The board host serves each ask's board on the local machine only, behind that board's own token, carries the board protocol between the board page and the core, and brings a new board to the user's browser (AD-8, AD-11, AD-21).

## ADDED Requirements

### Requirement: Molecule source
The `molecule-source` adapter SHALL serve, through `ask-core`'s `MoleculeSource` port, the ready-made definitions AskBoard ships and no other: by name, and by the version rule of AD-9, reading nothing from the file system or the network (AD-9, AD-11, NFR-9).

#### Scenario: Looking up the WBS with PERT
- **WHEN** `ask-core` asks for `wbs-pert` with no version
- **THEN** the adapter gives the shipped `wbs-pert` 1.0.0 definition

#### Scenario: Only shipped molecules
- **WHEN** a file `wbs-pert.json` sits under the project's `.askboard/` folder
- **THEN** the adapter never reads it, and gives the shipped definition

### Requirement: Shipped definitions are checked before use
The adapter SHALL check each definition against the contract's definition format on its first lookup, not when the session process starts, and SHALL refuse to serve one that fails, or whose format major it does not support, saying why, so that a broken definition never expands (AD-2, AD-10, FR-17).

#### Scenario: A broken definition
- **WHEN** the adapter is given a definition whose `fills` name an undeclared parameter
- **THEN** its lookup fails with a problem naming the molecule and the fill, and nothing expands from it

#### Scenario: Start-up
- **WHEN** the session process starts and answers `server/discover`
- **THEN** no definition has been read or checked
