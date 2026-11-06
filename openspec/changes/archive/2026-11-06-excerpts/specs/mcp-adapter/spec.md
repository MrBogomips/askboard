# Spec Delta

## ADDED Requirements

### Requirement: Unresolved pointers in ask and update results
The results of `ask` and `update` SHALL carry one `unresolved-pointer` warning for each pointer of the revisions the call created that did not resolve, beside any other warning, and the call SHALL succeed (AD-6, FR-8).

#### Scenario: An update that adds a missing image
- **WHEN** an `update` adds an image whose file does not exist
- **THEN** the update is applied, and its result carries a warning naming the image, its pointer and reason `not-found`

### Requirement: Fetch omits excerpt text and image bytes
A `fetch` result SHALL carry each excerpt's pointer, title, status, reason and line range, each image's pointer, alt text, status and media type, and each reference as the board document holds it, but never an excerpt's text, written or read, nor an image's bytes (AD-6).

#### Scenario: Fetching a question with context
- **WHEN** the agent fetches a question holding a resolved excerpt, an agent-written excerpt and an image
- **THEN** the result holds no excerpt text and no image bytes, and the excerpt's status and line range are there

### Requirement: Approved texts unchanged
The tool definitions and server instructions SHALL stay the approved texts, which already teach pointers (`path#Heading`, `path#L10-L40`) and screenshots saved under `.askboard/media/`; E5 adds nothing to them (NFR-1).

#### Scenario: The listed tools
- **WHEN** a client lists the tools after this change
- **THEN** each definition and the instructions equal the approved fixtures byte for byte
