## ADDED Requirements

### Requirement: Document review items
The registry SHALL hold `document-review`, whose props hold `markdown`, the document: 1 to 10,000 characters holding no control or bidirectional formatting character other than a line feed or a tab. The props MAY hold `title`, 1 to 120 characters, and SHALL hold nothing else (FR-11, AD-7).

#### Scenario: A document in a question
- **WHEN** an ask holds a Document review `{markdown: "## Release 0.2\n\nThe board **remembers** drafts.", title: "Release notes"}`
- **THEN** it passes

#### Scenario: A control character
- **WHEN** a Document review's `markdown` holds a carriage return, U+0000 or U+202E
- **THEN** validation fails, naming the item and `markdown`, and the character as an escape such as `‮`

#### Scenario: A document too long
- **WHEN** a Document review's `markdown` holds 10,001 characters
- **THEN** validation fails, naming the item and `markdown`, and the limit

#### Scenario: A field the type does not take
- **WHEN** a Document review's props hold `format: "plain"`, `__proto__` or `constructor` as a key
- **THEN** validation fails, naming the item and the field

### Requirement: Document review results
A Document review's result SHALL be `{annotations}`: 1 to 100 annotations, each with a view-made ID unique in the result and a `quote` selector whose `exact` holds a character other than white space and is no longer than the item's document. `exact`, `prefix` and `suffix` SHALL hold no character the document refuses, and a suggested edit's `replacement` SHALL differ from its `exact` (FR-11, FR-18, AD-7, AD-10).

#### Scenario: A comment and a suggested edit
- **WHEN** a result holds `{id: "u-1", target: {selector: {type: "quote", exact: "remembers", prefix: "The board ", suffix: " drafts."}}, body: {text: "Say how long."}}` and `{id: "u-2", target: {selector: {type: "quote", exact: "drafts"}}, body: {replacement: "unsent answers"}}`
- **THEN** it passes for the item above

#### Scenario: Another selector
- **WHEN** an annotation's selector is a `position` or a `region`
- **THEN** it fails, naming the item, the annotation and saying that a Document review takes quotes

#### Scenario: IDs the view did not make
- **WHEN** an annotation's ID is `c1`, `__proto__` or `constructor`, or two annotations share an ID
- **THEN** it fails, naming the item and the annotation

#### Scenario: A quote that cannot come from the document
- **WHEN** an annotation's `exact` is white space only, longer than the item's document, or holds U+202E
- **THEN** it fails, naming the item and the annotation

#### Scenario: A suggestion that changes nothing
- **WHEN** a suggested edit's `replacement` equals its `exact`
- **THEN** it fails, naming the item and the annotation

#### Scenario: Nothing annotated
- **WHEN** a result `{annotations: []}` is checked
- **THEN** it fails at `/annotations`

### Requirement: A quote's place in a text
The contract SHALL give the one rule that places a quote in a text: its `prefix`, `exact` and `suffix`, joined, SHALL occur exactly once, and its place is that occurrence's `exact`. A quote that occurs nowhere SHALL be missing and one that occurs more than once ambiguous, and neither SHALL get a place. Of two annotations whose places overlap, the later in the result SHALL get none (AD-7, AD-10).

#### Scenario: Found once
- **WHEN** a quote `{exact: "drafts", prefix: "remembers "}` is placed in "The board remembers drafts. Old drafts stay."
- **THEN** its place is the first "drafts"

#### Scenario: Missing or ambiguous
- **WHEN** the quote `{exact: "drafts"}` is placed in a text without "drafts", or in one holding it twice
- **THEN** it is missing, or ambiguous, and has no place

#### Scenario: Two places that overlap
- **WHEN** two annotations whose quotes place them on overlapping text are placed, in the result's order
- **THEN** the first has its place and the second is detached as overlapping

### Requirement: Quoting a passage
Quoting a passage of a text SHALL give its exact text with up to 32 characters of context on each side, widened up to 200 until the quote occurs once, never splitting a character. It SHALL refuse a passage that is blank, longer than 2,000 characters, or that occurs more than once with 200 characters of context (AD-7, NFR-10).

#### Scenario: A repeated word
- **WHEN** the second of two equal sentences' last word is quoted in a text where their 32 characters of context are equal too
- **THEN** the context widens until the quote occurs once, and placing the quote gives back the quoted passage

#### Scenario: A passage that cannot be told apart
- **WHEN** a sentence is quoted that a text repeats with the same 200 characters before and after
- **THEN** quoting refuses it as repeated

#### Scenario: Bounds
- **WHEN** a passage of white space, or of 2,001 characters, is quoted
- **THEN** quoting refuses it, saying which

#### Scenario: A character outside the basic plane
- **WHEN** a passage starts or ends next to an emoji and its context would cut one
- **THEN** the context keeps or leaves out the whole emoji

### Requirement: The Document review's teaching text
The Document review's registry entry SHALL carry its teaching text: when to use it (a Markdown document the user comments on and suggests edits to), that a quote gives the text as the board shows it, Markdown marks removed, that a `replacement` replaces `exact` and an empty one deletes it, that a quote the agent cannot find is asked about, never guessed, and that an untouched item gives no result; and an example item that validates (FR-29, AD-6).

#### Scenario: The generated reference
- **WHEN** the skill is generated
- **THEN** it holds a Document review reference naming `markdown`, `title`, the result's `annotations`, `replacement` and the example, which `AskCore.ask` accepts

### Requirement: The annotation body
An annotation's body SHALL hold `text`, a comment of 1 to 2,000 characters, `replacement`, a suggested edit of 0 to 4,000 characters that replaces the target's text (an empty one deleting it), or both, and nothing else. A widget type MAY take fewer of them in its result (AD-7).

#### Scenario: A comment
- **WHEN** an annotation's body is `{text: "Say how long."}`
- **THEN** it passes

#### Scenario: A suggested edit
- **WHEN** an annotation's body is `{replacement: ""}`, or `{replacement: "unsent answers", text: "Clearer."}`
- **THEN** it passes

#### Scenario: An empty body
- **WHEN** an annotation's body is `{}`, holds `motivation`, or holds a `replacement` of 4,001 characters
- **THEN** it fails, naming the body

### Requirement: The Document review in the sets' next minors
The input format, the output format, the tool envelopes and the board document SHALL each take the next minor after the one `main` holds, admitting the Document review's items and result and the annotation's `replacement`; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The previous minor
- **WHEN** an ask holding a Document review is validated by the input format's previous minor
- **THEN** it fails, naming the item and its type

#### Scenario: A fetch of a Document review alone
- **WHEN** a `fetch` result holds a Document review item with its `result`
- **THEN** it validates, and the same item with a Chart's result fails at `/item/result`

#### Scenario: Sets this change leaves alone
- **WHEN** the version constants are read after this change
- **THEN** the board protocol, the Snapshot data, the view manifest, the configuration, the local API and the session file equal `main`'s

## MODIFIED Requirements

### Requirement: The annotation shape
The output format SHALL define the annotation `{id, target: {selector}, body}`, its item being the key of the answer's `results`: `id` an element ID, `body` as "The annotation body" says, and `selector` one of `element` (`id`), `label` (`label`, optional `occurrence`), `region` (`value`, `xywh=percent:x,y,w,h`), `line` (`side` `old` or `new`, `path`, `line`), `quote` (`exact`, optional `prefix`, `suffix`) and `position` (`start`, `end`) (AD-7).

#### Scenario: One annotation of each selector
- **WHEN** six annotations, one per selector type, are validated
- **THEN** each passes

#### Scenario: A region in pixels
- **WHEN** an annotation's `region` selector holds `xywh=pixel:10,10,40,40`
- **THEN** it fails, naming the selector's `value`

#### Scenario: An unknown selector
- **WHEN** an annotation's selector has the type `css`
- **THEN** it fails, naming the selector's type
