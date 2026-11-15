# Spec Delta

## ADDED Requirements

### Requirement: Timed bounds judged in the perf pass
Each time bound this spec states for the view or a widget (LaTeX, Markdown, the Table), and each other wall-clock gate the browser suite asserts, SHALL be judged in the perf pass, the test machine: the timed files alone, one at a time, one engine at a time, nothing else running. Each SHALL hold for the median of three runs in fresh pages, its value unchanged; the functional outcomes of the same scenarios SHALL hold on every run (AD-8, NFR-5, NFR-12).

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
- **THEN** it means the perf pass, on the CI runner of the nightly or weekly run, or on a developer's machine running `bun run test:e2e`
