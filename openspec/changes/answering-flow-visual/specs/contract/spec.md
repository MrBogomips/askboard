## ADDED Requirements

### Requirement: Short question numbers in the draft record
The draft record SHALL admit `numbers`, each question's short number by its ID, a whole number from 1 to the contract's `QUESTION_NUMBER_MAX`, and `nextNumber`, the next number the board gives, above every number it holds and at most `QUESTION_NUMBER_MAX` plus one. A number held twice, a number not below `nextNumber`, and a key naming no question of the ask SHALL be refused. The record is in the board protocol, which takes its next minor (AD-7, AD-20).

#### Scenario: Numbers with a gap
- **WHEN** a draft record holds `numbers` `{"db": 1, "cache": 2, "rollout": 4}` and `nextNumber` 5 for an ask with those three questions
- **THEN** it validates

#### Scenario: A number held twice
- **WHEN** it holds `numbers` `{"db": 1, "cache": 1}`
- **THEN** it is refused, naming `/numbers`, and the held record is unchanged

#### Scenario: A number not below the next one
- **WHEN** it holds `numbers` `{"db": 5}` and `nextNumber` 5
- **THEN** it is refused, naming `/nextNumber`

#### Scenario: A key that is no question
- **WHEN** it holds `numbers` `{"constructor": 1}`
- **THEN** it is refused like any other unknown question ID

#### Scenario: Out of range
- **WHEN** it holds a number 0, a number of 2.5, or a `nextNumber` above `QUESTION_NUMBER_MAX` plus one
- **THEN** validation fails, naming the field

#### Scenario: The previous minor
- **WHEN** a draft record of the previous minor, without `numbers` or `nextNumber`, is checked
- **THEN** it validates
