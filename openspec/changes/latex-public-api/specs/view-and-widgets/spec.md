# Spec Delta

## MODIFIED Requirements

### Requirement: LaTeX bounded work
An expression the contract's LaTeX check refuses SHALL NOT render: one holding a macro definition or a KaTeX internal command SHALL show a field error naming the command, and one nested past the limit a field error naming its depth and the limit, the preview keeping its last render. Every expression of at most 2,000 code points SHALL render or show a field error within 2 seconds in Chromium and WebKit, the board responding (AD-8, NFR-5).

#### Scenario: A macro definition
- **WHEN** the user types `\def\a{\a}\a`, or `\def\b{` and 900 `x` then `}\def\a{` and `\b` 540 times then `}\a`
- **THEN** the field error names `\def` within 2 seconds, KaTeX does not run, the preview keeps its last render, and the board keeps responding

#### Scenario: An internal command
- **WHEN** the user types `\color{` and 900 `x` then `}` and `\current@color` 78 times
- **THEN** the field error names `\current@color` within 2 seconds, KaTeX does not run, and the preview keeps its last render

#### Scenario: Nests at and past the limit
- **WHEN** the expression nests `\frac` or `\dfrac` numerators, `{` with `\over x}`, `x^{`, `\sqrt{` or `\boxed{` to the nesting limit, alone or repeated side by side to 2,000 code points, then one level past the limit
- **THEN** at the limit the preview renders within 2 seconds in Chromium and WebKit with the board responding, and past it the field error names the depth and the limit, KaTeX does not run, and the preview keeps its last render

#### Scenario: Nests the scan once missed
- **WHEN** the user types `\frac{` with `\over y}{x}` nested 11 times, or ``\char` {`` 130 times, then `x`, then `\over}` 130 times
- **THEN** within 2 seconds the field error names the depth and the limit for the first and the command ``\char` `` for the second, KaTeX does not run, and Chromium's renderer does not crash


#### Scenario: Stacked combining marks
- **WHEN** the agent sends, or the user types, `x` followed by 130 combining circumflex accents (U+0302)
- **THEN** the field error names the depth and the limit, KaTeX does not run, the preview keeps its last render or stays empty, and Chromium's renderer does not crash

## ADDED Requirements

### Requirement: LaTeX preview within its box
The LaTeX preview SHALL stay within 400 px high, scrolling inside, whatever KaTeX draws, so the controls under it stay where they are (DESIGN Components: LaTeX; AD-8).

#### Scenario: A preview that would grow past its box
- **WHEN** a LaTeX item's expression is `\raisebox{-1000000em}{X}`, sent by the agent or typed by the user
- **THEN** the preview stays within 400 px high, scrolling inside, and the controls under it stay where they are on a board whose expression is at KaTeX's largest size

## REMOVED Requirements

### Requirement: LaTeX output bounded
**Reason**: The board measured KaTeX's output through `__renderToDomTree`, an internal KaTeX function its documentation calls unstable, and the PO refused that dependency on 2026-11-07. The contract's nesting bound, which now counts stacked combining marks, bounds every known nesting form; an output that still proves too costly is a known issue, fixed as a bug when seen.
**Migration**: None for agents: `ask` and `update` refuse what they refused, plus stacks of combining marks past the nesting limit (11 on a character outside any group). The "too complex to preview" field error goes; the preview's height scenario moves to "LaTeX preview within its box".
