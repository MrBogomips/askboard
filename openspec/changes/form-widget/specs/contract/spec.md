## ADDED Requirements

### Requirement: Required fields
A `text-field`, `number-field`, `money-field`, `date-field`, `toggle` or `pick-field` item SHALL take an optional boolean `required`. Its field check SHALL fail while the item has no result and pass once it has one, whatever the value, `false` included (FR-11, AD-10).

#### Scenario: A required Toggle
- **WHEN** a Toggle `{label: "I agree", required: true}` is checked with no result, then with `false`
- **THEN** the first check fails as required, and the second passes

#### Scenario: An optional field left empty
- **WHEN** a NumberField without `required` is checked with no result
- **THEN** the check passes

### Requirement: A TextField's length and pattern
A TextField SHALL take an optional `minLength` from 1 to its `maxLength` and an optional `pattern`. Its field check SHALL fail when its text holds fewer than `minLength` code points; its pattern check, which only the board runs, SHALL fail when the pattern, read as an ECMAScript regular expression with the `u` flag and unanchored as JSON Schema reads it, finds no match in the text. A TextField with no result passes both (FR-11).

#### Scenario: A ticket key
- **WHEN** a TextField `{label: "Ticket", pattern: "^[A-Z]{2}-\\d{4}$"}` is checked with `"AB-1234"`, then `"ab-1234"`, then no result
- **THEN** the first passes, the second fails naming the pattern, and the third passes

#### Scenario: Too short
- **WHEN** a TextField `{label: "Code", minLength: 3}` is checked with `"ab"`, then `"abc"`
- **THEN** the first fails naming the length, and the second passes

#### Scenario: A minimum over the maximum
- **WHEN** an ask holds a TextField `{label: "Code", minLength: 50, maxLength: 40}`
- **THEN** `ask` refuses it at `minLength`, naming the item

### Requirement: Safe patterns
`ask` and `update` SHALL refuse a TextField whose `pattern` is over 200 code points, does not compile, holds a backreference, a lookaround, a `(?` form but `(?:` and `(?<name>`, a name twice, a repeated group holding a quantifier or `|`, a `\p{…}` but a General_Category or ES2018 binary property, or costs over 3 repetitions (variable quantifiers and `|` groups; one more with no leading `^`), or with `maxLength` over 100 (100 when absent). Each refusal SHALL name the item and rule (NFR-5, AD-8).

#### Scenario: Patterns inside the subset
- **WHEN** an ask holds TextFields with the patterns `^[A-Z][a-z]+$`, `^\+?\d{6,15}$`, `^[^@\s]+@[^@\s]+\.[a-z]{2,}$`, `^(?:[a-z0-9-]+\.)?example\.com$`, `^(?<key>[A-Z]+)-\d+$`, `^(?:dev|test|prod)$` and `[(+*)]`
- **THEN** `ask` accepts them

#### Scenario: Patterns outside the subset
- **WHEN** an ask holds a TextField with the pattern `(a)\1`, `\k<x>`, `a(?=b)`, `a(?!b)`, `(?<=a)b`, `(?<!a)b`, `^(a+)+$`, `^(\d{2,})+$`, `^((ab)*c)+$`, `^(a|aa)*$`, `^(?:x|y){2,}$`, `(?i:a)`, `(?<a>x)|(?<a>y)`, `(`, `\p{Script=Garay}`, `\p{sc=Latin}`, `\P{scx=Greek}` or `[\p{Script=Latin}]`
- **THEN** `ask` refuses it, naming the item and what the pattern holds

#### Scenario: A pattern with too many repetitions
- **WHEN** an ask holds a TextField with the pattern `^\d*\d*\d*\d*$`, `\d+\d+\d+x`, `^(?:a|a)(?:a|a)(?:a|a)(?:a|a)$` or `a?a?a?a?`, and another with `^\d*\d*\d*$`, `\d+\d+x` or `^(?:a|b)(?:c|d)(?:e|f)$`
- **THEN** `ask` refuses the first four, naming the item, the count (4 or more) and the limit of 3, and accepts the others

#### Scenario: A property escape a board may not know
- **WHEN** an ask holds TextFields with the patterns `^\p{L}+$`, `^\p{Lu}\p{Ll}+$`, `^\p{General_Category=Letter}+$` and `^\p{Alphabetic}+$`, and others with `\p{Script=Garay}` or `\p{sc=Latin}`
- **THEN** `ask` accepts the first four and refuses the others, naming the item and the property, so that no pattern the server accepts can fail to compile on an older board

#### Scenario: A pattern field's text is short
- **WHEN** an ask holds a TextField `{label: "Code", pattern: "^[A-Z]+$", minLength: 101}`, or one with `maxLength: 101`, and another with `{pattern: "^[A-Z]+$", maxLength: 100}`
- **THEN** `ask` refuses the first two, naming the item and the limit of 100 characters, and accepts the third; and a text of 101 characters in a TextField with a pattern and no `maxLength` does not fit, while one of 100 does

#### Scenario: An update that makes a pattern unsafe
- **WHEN** `update` adds a question whose TextField holds `{pattern: "^a$", maxLength: 5000}`, or changes a TextField holding `{maxLength: 5000}` to set `pattern: "^a$"`, or one holding `{pattern: "^a$"}` to set `maxLength: 5000`, or sets `pattern: "^(a+)+$"`
- **THEN** `update` refuses it at the offending prop, as `ask` does, and applies nothing

#### Scenario: A long field with a pattern
- **WHEN** an ask holds a TextField `{label: "Email", pattern: "^[^@]+@[^@]+$", maxLength: 5000}`
- **THEN** `ask` refuses it at `maxLength`, naming the item and the 100-character bound

### Requirement: A value that fails a check still fits
A result that fails only its field check SHALL still fit its item: `widgetResultFits` SHALL hold for it, and a draft record holding it SHALL be valid. Only a result that the item's result schema or result checks refuse SHALL be unfit (AD-20).

#### Scenario: A text against its pattern
- **WHEN** the board page asks whether `"ab-1234"` fits a TextField whose pattern is `^[A-Z]{2}-\d{4}$`
- **THEN** it fits, and the field check fails

### Requirement: PickField items
A `pick-field` item SHALL hold `label`, an optional `description`, `options` of 2 to 50 `{id, label, description?}` whose IDs are unique in the item and do not start with the view's prefix, an optional `multiple`, and, only with `multiple`, optional `minItems` and `maxItems` with 1 ≤ `minItems` ≤ `maxItems` ≤ the number of options (FR-11, FR-13, AD-7).

#### Scenario: A repeated option ID
- **WHEN** an ask holds a PickField whose options are `{id: "eu", label: "Europe"}` and `{id: "eu", label: "Asia"}`
- **THEN** `ask` refuses it, naming the item and the option ID

#### Scenario: A count on a single pick
- **WHEN** an ask holds a PickField with `minItems: 1` and no `multiple`
- **THEN** `ask` refuses it at `minItems`, naming the item

#### Scenario: More than the options
- **WHEN** an ask holds a multiple PickField of 5 options with `maxItems: 6`
- **THEN** `ask` refuses it at `maxItems`, naming the item

### Requirement: PickField results
A single PickField's result SHALL be one option ID; a multiple PickField's result SHALL be a list of 1 or more distinct option IDs in the options' order. Any other result SHALL be refused, naming the item. A multiple PickField's field check SHALL fail when it holds fewer than `minItems` or more than `maxItems` IDs (FR-18).

#### Scenario: Results checked
- **WHEN** a multiple PickField with options `a`, `b`, `c` and `maxItems: 2` receives `["a", "c"]`, then `["c", "a"]`, then `["a", "z"]`, then `"a"`, then `["a", "b", "c"]`
- **THEN** the first passes, the next three are refused naming the item, and the last fits but fails its field check

### Requirement: The PickField and forms in the registry and the skill
The registry SHALL hold `pick-field` after the layouts, with its props, result, field check, wording, example and teaching text. The generated skill SHALL hold its line and one sentence on building a form from fields, a Group per section, and SHALL stay within its budgets (AD-6, SM-1).

#### Scenario: The skill built
- **WHEN** `bun run build:skills` runs with the PickField registered
- **THEN** `SKILL.md` holds the PickField's line and the form sentence, its reference lists `required`, `multiple`, `minItems` and `maxItems`, and `bun run check:skills` passes

### Requirement: Form fields in the schema sets
The input format, the board document and the tool envelopes SHALL admit the field checks' props and the PickField item, and the output format its result, each at the next minor; a request, a board document or a result valid under the previous minor SHALL stay valid (AD-7).

#### Scenario: An earlier ask
- **WHEN** an ask valid under the previous minor of the input format is sent
- **THEN** it validates unchanged
