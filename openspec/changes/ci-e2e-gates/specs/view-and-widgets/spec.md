## MODIFIED Requirements

### Requirement: Timed bounds judged in the perf pass
Each time bound this spec states for the view or a widget (LaTeX, Markdown, the Table), and each other wall-clock gate the browser suite asserts, SHALL be judged in the perf pass, the test machine: the timed files alone, one at a time, one engine at a time, nothing else running. Each SHALL hold for the median of three runs in fresh pages, its value unchanged but for a hosted runner's factor; the functional outcomes of the same scenarios SHALL hold on every run (AD-8, NFR-5, NFR-12).

#### Scenario: One slow run of three
- **WHEN** the perf pass measures a Table edit at its bounds in WebKit three times, at 92, 131 and 97 ms against the 100 ms gate
- **THEN** the gate holds on the median, 97 ms, and the report shows all three figures

#### Scenario: A slow median
- **WHEN** the perf pass measures a LaTeX expression at the nesting limit three times, at 1,900, 2,300 and 2,450 ms against the 2-second bound
- **THEN** the bound fails on the median, 2,300 ms, and the report shows all three figures

#### Scenario: A functional outcome fails once
- **WHEN** one of the three runs of a macro definition shows no field error naming `\def`, though its time is within the bound
- **THEN** the scenario fails, whatever the median

#### Scenario: Not judged beside other work
- **WHEN** the browser suite runs its files in parallel, locally or in a CI shard
- **THEN** no time bound of this spec and no other wall-clock gate is asserted there, and the timed files run afterwards in the perf pass

#### Scenario: The Document review's cost of placing
- **WHEN** the perf pass places 100 near-miss quotes of 2,000 characters in a Document review in Chromium three times, and types in a card beside 99 of them and alone three times each
- **THEN** each gate (placed within 15 s, a key beside 99 quotes under four times its cost alone plus 60 ms, and with 32 Document reviews shown within 20 s and a key under 150 ms) is judged once on the medians, and no file outside the perf pass asserts them

#### Scenario: The Markdown test machine
- **WHEN** the Markdown bounded work requirement names "the test machine"
- **THEN** it means the perf pass, on the CI runner of the nightly or weekly run with that runner's factor, or on a developer's machine running `bun run test:e2e`

## ADDED Requirements

### Requirement: Timed bounds on a hosted runner
On a GitHub-hosted runner the perf pass SHALL judge each bound against its stated value times the factor of the runner's operating system: 2 on Linux, 3 on macOS. Each judgement SHALL print the stated value, the factor and the bound applied, beside the three figures. Anywhere else the factor SHALL be 1. A runner name the pass does not know SHALL fail the pass before it measures anything (NFR-7, NFR-12).

#### Scenario: A Table edit on the macOS runner
- **WHEN** the weekly run measures the worst form's cell edit in Chromium on the macOS runner at 398, 214 and 177 ms against the 100 ms gate
- **THEN** the gate holds on the median, 214 ms, against the applied bound of 300 ms, and the line shows the three figures, the gate 100, the factor 3 and the bound 300

#### Scenario: A gross regression on the Linux runner
- **WHEN** the nightly run measures the same edit in Chromium on the Linux runner at 240, 260 and 250 ms
- **THEN** the gate fails on the median, 250 ms, over the applied bound of 200 ms

#### Scenario: A developer's machine
- **WHEN** `bun run test:e2e` runs the perf pass on a developer's machine, where no workflow names a runner
- **THEN** every bound is judged at its stated value

#### Scenario: A runner the pass does not know
- **WHEN** the perf pass starts with a runner name it has no factor for
- **THEN** it fails at once, naming the value and the runners it knows, and judges nothing at a default factor

### Requirement: Keyboard cases with the platform's keyboard navigation
The browser suite SHALL run on a macOS runner with the system's keyboard navigation turned on, in every engine, so Tab moves through every control in WebKit as it does on Linux and on a developer's Mac. No keyboard case SHALL be skipped, or given another key, for WebKit on macOS (NFR-7, NFR-12).

#### Scenario: Tab reaches Answer on the macOS runner
- **WHEN** the weekly run answers a question with the keyboard only in WebKit on the macOS runner: Tab to the options, Space, Tab to Answer, Enter
- **THEN** Tab reaches Answer within ten presses and the answer is sent, as on Linux

#### Scenario: The setting precedes the browser
- **WHEN** a browser job runs on a macOS runner
- **THEN** keyboard navigation is turned on before the first browser starts, and a browser job on Linux changes no system setting
