## ADDED Requirements

### Requirement: The fetch outcome deleted
The tool envelopes SHALL define, beside `fetch`'s typed result `discarded`, the typed result `deleted`, which names the ask and the item (`itemId`) and may carry `unchecked: true`. `itemId` and `unchecked` SHALL appear only with `deleted` (AD-6, AD-10).

#### Scenario: A deleted outcome validates
- **WHEN** a `fetch` outcome with the versions, the epoch, `askId`, `itemId` `erp-export` and `outcome` `deleted` is validated
- **THEN** it passes, and passes with `unchecked: true` too

#### Scenario: A deleted outcome without its item
- **WHEN** a `fetch` outcome `deleted` without `itemId` is validated
- **THEN** it fails, naming `itemId`

#### Scenario: A discarded outcome stays as it was
- **WHEN** a `fetch` outcome `discarded` of the previous minor is validated, and one `discarded` carrying `itemId` is validated
- **THEN** the first passes and the second fails

### Requirement: Amendments to the approved texts
The contract SHALL record each amendment to an approved tool description or to the server instructions with the change that made it, the date of the PO's approval, the text replaced and the text that replaces it. The texts served SHALL equal the approved texts with the recorded amendments applied, in order (AD-6).

#### Scenario: The served texts follow the record
- **WHEN** the contract's tests apply the recorded amendments to the approved `tools.json` and `server-instructions.md`
- **THEN** the results equal the tool definitions and the server instructions the contract exports

#### Scenario: An amendment that no longer applies
- **WHEN** an amendment's replaced text is not found exactly once in the text it amends
- **THEN** the contract's tests fail, naming the amendment's change and target

### Requirement: The approved examples stay as archived
An amendment SHALL leave the approved examples, and their copies among the contract's fixtures, byte-identical to the archived `review-model-contract` examples; the amendment record SHALL be the only place where an approved text differs from what was served before it.

#### Scenario: Fixture copies untouched
- **WHEN** an amendment to the `update` description is recorded
- **THEN** the fixture `tools.json` still equals the archived one byte for byte
