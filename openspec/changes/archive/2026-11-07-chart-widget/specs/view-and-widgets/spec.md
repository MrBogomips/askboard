## ADDED Requirements

### Requirement: Chart drawing
A Chart SHALL be drawn on a canvas as its `kind` says: bars grouped by category, lines with a marker at each number and a gap at each `null`, or a pie of one series. Bar and line charts SHALL have one value axis starting at zero and a category axis, with their axis labels when sent. `title` SHALL show as text above the chart (FR-11; DESIGN Components, Chart).

#### Scenario: Two series of bars
- **WHEN** a bar chart of three categories and two series is shown
- **THEN** each category holds two bars, in `chart-1` and `chart-2`, and a legend names the two series

#### Scenario: A gap in a line
- **WHEN** a line chart's series holds `[3, null, 5]`
- **THEN** the line breaks at the second category and no marker is drawn there

### Requirement: Chart colours and legend
A Chart's series, and a pie's slices, SHALL take the palette's colours in order, the first `chart-1`, never cycled; a bar or line chart of two or more series SHALL show a legend that hides no series when clicked; a pie SHALL label each slice with its category (FR-11; DESIGN Colors, Components, Chart).

#### Scenario: A pie of three slices
- **WHEN** a pie of three categories is shown
- **THEN** its slices take `chart-1`, `chart-2` and `chart-3`, each labelled with its category, and no legend is shown

#### Scenario: A legend clicked
- **WHEN** the user clicks a series' name in the legend
- **THEN** every series stays drawn

### Requirement: Chart tooltips
A Chart's tooltip SHALL be drawn on the canvas, on `{colors.popover}`, naming the category, the series and the value; numbers on the axis and in tooltips SHALL show in the ask's locale with the `unit` (FR-11, FR-34, AD-8; renderer spike).

#### Scenario: A tooltip in Italian
- **WHEN** the pointer rests on a bar of value 1234.5 with `unit` "€" on an it-IT board
- **THEN** the tooltip, drawn on the canvas, reads the category, the series and "1.234,5 €"

### Requirement: Charts request nothing
Drawing a Chart, hovering, highlighting, switching the theme and resizing SHALL request nothing over the network, use no browser storage and cause no CSP violation (NFR-9, AD-8, AD-11).

#### Scenario: No violation
- **WHEN** a board holding a bar, a line and a pie chart is hovered, highlighted, switched to dark and resized in each engine
- **THEN** no CSP violation is reported and no request leaves the page

### Requirement: Agent text on a chart
A Chart SHALL draw every label, series name, axis label and unit as the agent sent it, as text: control and bidirectional characters SHALL show as visible escapes, as the board's other agent text does, and no agent text SHALL be read as the chart library's markup or template, on the canvas or in a tooltip (NFR-5, AD-8).

#### Scenario: Markup in a label
- **WHEN** a category's label is `{b|Fix} {c}` and its tooltip is shown
- **THEN** the tooltip reads `{b|Fix} {c}` as written, with no style applied and nothing substituted

#### Scenario: A bidirectional control
- **WHEN** a series label holds U+202E
- **THEN** the legend and the tooltip show `\u202E` in its place

### Requirement: Highlighting data points
A click on a point (a bar, a line's marker or a pie slice) of a Chart that takes highlights SHALL highlight it, and a click on a highlighted point SHALL clear it; with `highlights: "one"`, highlighting a point SHALL clear the other. A point with no value SHALL not be highlighted. A highlighted point SHALL take a 2px `{colors.change}` ring, and the counter SHALL say how many are highlighted (FR-11, AD-10; DESIGN Components, Chart).

#### Scenario: Two points
- **WHEN** the user clicks the bar of `fails` in `a`, then the bar of `fails` in `b`
- **THEN** both take the ring and the counter reads "2 points highlighted"

#### Scenario: One point
- **WHEN** the user highlights a point, then another, on a Chart with `highlights: "one"`
- **THEN** only the second is highlighted

### Requirement: A Chart's highlights as its result
A Chart SHALL hold its highlighted points as its result through the port, in the series' then the categories' order, and no result while none is highlighted; a held highlight SHALL follow the draft rules of every result (AD-9, AD-10, AD-20).

#### Scenario: Highlighted in any order
- **WHEN** the user highlights the bar of `fails` in `b`, then the one in `a`
- **THEN** the draft holds `{points: [{series: "fails", category: "a"}, {series: "fails", category: "b"}]}` for the item

#### Scenario: Cleared
- **WHEN** the user clicks the only highlighted point again
- **THEN** the counter reads "No points highlighted", the draft holds no result for the item, and "Answer" is disabled if nothing else answers the question

#### Scenario: Removed by the agent
- **WHEN** the user has highlighted a point in `q4` and the agent's change removes `q4`, and the user keeps their work
- **THEN** the draft drops that point's result, as for any result the item's current props refuse

### Requirement: A Chart at the keyboard
A Chart SHALL be one Tab stop. On focus it SHALL make its first point holding a number current, show that point's tooltip and take the focus ring; Left and Right SHALL move to the previous and next category holding a number in the current series, Up and Down to the previous and next series holding a number in the current category, Home and End to the first and last point; Space or Enter SHALL highlight or clear the current point as a click does (NFR-12; EXPERIENCE Accessibility Floor).

#### Scenario: Highlighting from the keyboard
- **WHEN** the user tabs to a bar chart, presses Right, then Space
- **THEN** the second category's point of the first series is highlighted

#### Scenario: A gap skipped
- **WHEN** the current point is before a `null` and the user presses Right
- **THEN** the current point is the next one holding a number

### Requirement: A Chart's points read aloud
Each move of a Chart's current point and each highlight or clear SHALL be announced through a polite live region: the category, the series, the value in the ask's locale with the `unit`, and "highlighted" when the point is (NFR-12; EXPERIENCE Accessibility Floor).

#### Scenario: A highlighted point read
- **WHEN** the user presses Space on the point of `Failures` in `Fix B`, of value 9 with `unit` "runs"
- **THEN** the live region reads "Fix B, Failures: 9 runs, highlighted"

### Requirement: Charts to read and read-only charts
A Chart with `highlights: "none"`, and a Chart that is disabled (its question cannot be answered, or the board is a Snapshot), SHALL highlight nothing on a click or a key and show no counter control; tooltips and the keyboard reading SHALL still work, with the default cursor. A disabled Chart SHALL show the highlights its question's latest answer holds (FR-11, AD-20; EXPERIENCE Hover and focus feedback).

#### Scenario: A Snapshot
- **WHEN** a Snapshot of a board whose Chart was answered with two points is opened from `file://`
- **THEN** the chart is drawn with the two rings, clicks and keys change nothing, and no CSP violation is reported

#### Scenario: A chart to read
- **WHEN** the user clicks a bar of a Chart with `highlights: "none"`
- **THEN** nothing is highlighted and the draft holds no result for the item

### Requirement: A Chart follows the theme
The catalog port SHALL tell a component the theme in effect, light or dark, and re-render it when the theme switches. A Chart SHALL build its colours, fonts and lines from DESIGN's tokens as resolved in that theme, and redraw with them on a switch, keeping its highlights, on the board and in a Snapshot (DESIGN Dark theme mechanism, EXPERIENCE Dark theme).

#### Scenario: Switching to dark
- **WHEN** a board holding a highlighted Chart switches from Light to Dark
- **THEN** the chart is redrawn with the dark tokens, `chart-1` resolved in dark among them, and the highlight stays

### Requirement: The Chart's chunk
The Chart SHALL be one component chunk, `chart`, holding the chart library's canvas renderer and only the chart and component modules the Chart uses; a board holding no Chart SHALL load none of it. The chunk's licence notices SHALL hold the chart library's licence and NOTICE texts and those of the packages it bundles (AD-9, AD-19).

#### Scenario: A board without a Chart
- **WHEN** a board holding only a Scale is assembled
- **THEN** it inlines no `chart` chunk

#### Scenario: The notices
- **WHEN** the view is built
- **THEN** the `chart` chunk's notices name `echarts` under Apache-2.0 with its NOTICE text and the d3 BSD-3-Clause text its time scale embeds, `zrender` under BSD-3-Clause and `tslib` under 0BSD

### Requirement: The Chart's strings
The Chart's own words (the counter, the live region's "highlighted", the keyboard hint, the chart's role description and its name in the agent-change notice) SHALL show in the ask's language, en-US or it-IT (FR-34).

#### Scenario: An Italian chart
- **WHEN** an it-IT board holds a Chart with one point highlighted
- **THEN** the counter reads "1 punto evidenziato" and no English word of the board's own shows on the item

### Requirement: A Chart's result end to end
A Chart's highlighted points SHALL travel in the answer's `results` by item ID to the agent, by `collect` and by the mod's push, and `fetch` of the item SHALL return them as its `result` (FR-18, FR-20, AD-20).

#### Scenario: Answered and collected
- **WHEN** the user highlights two points and answers, and the agent collects
- **THEN** the answer event holds the item's `{points}` under `results`, and it validates against the output format
