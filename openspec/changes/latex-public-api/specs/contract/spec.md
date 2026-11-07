# Spec Delta

## MODIFIED Requirements

### Requirement: LaTeX nesting bounded
The LaTeX's check SHALL refuse an expression nested deeper than `LATEX_NESTING_MAX_DEPTH` levels, its problem naming the depth and the limit, counting the levels its openers open: a level opens at `{`, `\bgroup`, `\begingroup`, `\begin` and `\left`, and for the argument of `^` and `_`; a run of n stacked combining marks (U+0300 to U+036F) reaches n + 1 levels. It is the one bound on nesting, for the agent and the board alike (AD-8, NFR-5).

#### Scenario: A nest at and past the limit
- **WHEN** a LaTeX item's `expression` nests `\frac{` with `}{x}` to the limit, then one level more
- **THEN** the first passes, and the second fails naming the item, its depth and the limit

#### Scenario: A script counts its argument
- **WHEN** the depth of `x^{y^{z}}` is read
- **THEN** it is 4: each script and each group is a level

#### Scenario: Stacked combining marks
- **WHEN** the depths of `x` followed by 10 combining circumflex accents (U+0302) and by 11 are read, then a LaTeX item's `expression` is `x` followed by 130 of them
- **THEN** the depths are 11 and 12, and the item fails naming its depth and the limit

#### Scenario: Accented text
- **WHEN** the depth of `\text{café}` is read, its `é` written as `e` and a combining acute accent (U+0301)
- **THEN** it is 3, and an item holding it passes
