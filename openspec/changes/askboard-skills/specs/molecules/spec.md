## ADDED Requirements

### Requirement: Teaching data for each ready molecule
Each ready molecule SHALL have teaching data beside its definition: when to use it, 1 to 200 characters, and an example of the data an agent sends, which SHALL pass the molecule's parameter schema and its checks (FR-15, FR-29).

#### Scenario: Every ready molecule taught
- **WHEN** the ready molecules and their teaching data are read
- **THEN** each ready molecule has teaching data, and none names a molecule that is not ready

#### Scenario: The example data is valid
- **WHEN** each molecule's example data is checked against its parameter schema
- **THEN** it passes with no problem
