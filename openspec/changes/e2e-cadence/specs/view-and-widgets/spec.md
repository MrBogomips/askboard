# Spec Delta

## ADDED Requirements

### Requirement: Timed bounds judged in the perf pass
Each time bound this spec states for the view or a widget (the LaTeX and Markdown bounds, the Table's gates of design decision 13) SHALL be judged in the perf pass, the test machine: the timed files alone, one at a time, one engine at a time, nothing else running. Each bound SHALL hold for the median of three runs in fresh pages, with its value unchanged. The functional outcomes of the same scenarios SHALL hold on every run (AD-8, NFR-5, NFR-12).

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
- **THEN** no time bound of this spec is asserted there, and the timed files run afterwards in the perf pass

#### Scenario: The Markdown test machine
- **WHEN** the Markdown bounded work requirement names "the test machine"
- **THEN** it means the perf pass, on the CI runner of the nightly or weekly run, or on a developer's machine running `bun run test:e2e`
