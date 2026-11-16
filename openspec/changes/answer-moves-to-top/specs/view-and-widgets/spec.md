# Spec Delta

## MODIFIED Requirements

### Requirement: Focus moves clear the sticky bars
Each move of focus to a question's heading, or to a field to fix, SHALL first scroll the view so that the element lies wholly between the sticky bars (the context header, the tab strip with tabs, the feedback tray) and the viewport's bottom, or starts just under them when taller than that space. This holds for the next-to-do, outline, strip, unread-reply, agent-change and "Go" jumps, the navigator, tabs and Focus after Answer and Submit; After an answer goes further (WCAG 2.2 SC 2.4.11).

#### Scenario: Next open to a heading under the bottom bar
- **WHEN** at 1280×800 with sections the next question to do has its heading's bottom edge 16 px above the viewport's bottom, where the bottom action bar stood, and the user activates the header's "Next to do"
- **THEN** the view does not scroll, nothing covers the heading, and it has focus

#### Scenario: Next open to a heading below the viewport
- **WHEN** at 1280×800 with sections the next question to do has its heading below the viewport and the user activates the header's "Next to do"
- **THEN** the heading lies wholly between the header's bottom edge and the viewport's bottom edge, and has focus

#### Scenario: A jump that wraps upward
- **WHEN** the next-to-do jump wraps to a question whose heading is above the viewport
- **THEN** the heading lies wholly below the header's bottom edge and above the viewport's bottom edge

#### Scenario: An outline jump
- **WHEN** with sections, and again with tabs, the user activates the outline entry of a question whose heading is out of view
- **THEN** that heading lies wholly between the header, or the tab strip, and the viewport's bottom edge, and has focus

#### Scenario: A jump into another tab
- **WHEN** with tabs the next-to-do jump activates another tab
- **THEN** the target question's heading lies wholly between the tab strip and the viewport's bottom edge, and has focus

#### Scenario: A message in the tray
- **WHEN** a message shows in the feedback tray and the user jumps to a question whose heading would sit beside it
- **THEN** the heading lies wholly below the tray's bottom edge, and has focus

#### Scenario: A jump in each engine
- **WHEN** in Chromium, Firefox and WebKit, at 1280×800 with sections, the user activates "Next to do" towards a heading below the viewport, and again towards a heading in another tab
- **THEN** within one second the target heading has focus and lies wholly between the header, or the tab strip, and the viewport's bottom edge

#### Scenario: A jump to a question in view keeps the page still
- **WHEN** at 1280×800 with sections the next question to do's card is wholly in view below the header, and the user activates the header's "Next to do"
- **THEN** the view does not scroll, the card carries no arrival mark, and its heading has focus

### Requirement: After an answer
On a board of two or more questions, when the primary sends or confirms an answer, or Postpone or Decline takes effect, and a question is still to do, the board SHALL move on to the next question to do: with "Go to the next" at once, bringing its card to the top of the view (The move to the next question) and focusing its heading, with the arrival mark; with "Stay here" when the user activates "Continue" in a footer of the card, which names that question and takes focus (FR-2).

#### Scenario: Go to the next
- **WHEN** with "Go to the next", in "One by one" with sections, the user sends question 3 while question 4 is to do
- **THEN** question 4's heading has focus, its card starts just under the sticky bars and carries the arrival mark, and the status region names question 4

#### Scenario: Stay here
- **WHEN** with "Stay here" the user sends question 3 while question 4 is to do
- **THEN** focus is on "Continue" in question 3's footer, which names question 4, and the page has not scrolled; when the user activates "Continue", question 4's heading has focus and its card starts just under the sticky bars

#### Scenario: One question per view
- **WHEN** with "Go to the next", in one question per view, the user sends the question shown while another is to do
- **THEN** the board shows the next question to do and its heading has focus

#### Scenario: Confirm in All together
- **WHEN** with "Go to the next", in "All together", the user confirms question 3 while question 4 is to do
- **THEN** question 4's heading has focus, and the status region reads "Answer ready, not sent. 1 ready." followed by question 4's title

#### Scenario: Later moves on
- **WHEN** with "Go to the next" the user activates "Later" on question 3 while question 4 is to do
- **THEN** question 3 reads "Postponed" and question 4's heading has focus

#### Scenario: A held key
- **WHEN** with "Go to the next", and again with "Stay here", the user holds Enter down on question 3's "Send answer" so that the key repeats after the board has moved
- **THEN** question 4 is neither answered nor changed, and "Continue" is not activated by the repeat

### Requirement: Reduced motion
The board's own motion SHALL be the move to the next question, scrolled smoothly for at most 250 ms, and the arrival mark, a fill and an accent edge on the card that fade over 1.2 seconds. Under `prefers-reduced-motion: reduce` the scroll SHALL be instant, the arrival mark static for 1.2 seconds then removed, and no animation or transition of the view or the board page SHALL last longer than 0 ms (WCAG 2.2 SC 2.3.3).

#### Scenario: Reduced motion
- **WHEN** under `prefers-reduced-motion: reduce`, with "Go to the next", the user sends a question
- **THEN** the page reaches its new position at once, the arrival mark has no animation, and every element of the view and the board page computes an animation and transition duration of 0 ms

#### Scenario: No preference
- **WHEN** without a reduced-motion preference the user sends a question with "Go to the next"
- **THEN** the arrival mark shows on the next question's card and is gone after 1.2 seconds

#### Scenario: Reduced motion in each engine
- **WHEN** in Chromium, Firefox and WebKit, under `prefers-reduced-motion: reduce` with "Go to the next", the user sends a question whose next question to do is below the viewport
- **THEN** at once the next question's heading has focus and its card starts 8 px under the header's bottom edge, and its card shows the arrival mark

## ADDED Requirements

### Requirement: The move to the next question
The move After an answer and "Continue" make SHALL scroll the view until the target question's card starts 8 px under the sticky bars (the context header, the tab strip with tabs, the feedback tray), even when the card is already wholly in view. Where the page cannot scroll that far it SHALL stop at the page's end; in one question per view it SHALL go to the page's top. A scroll by the user during the move SHALL end the move where it is (FR-2, NFR-12).

#### Scenario: A question already in view
- **WHEN** at 1280×800 with sections and "Go to the next", on a board of short questions whose question 2 card is wholly in view with the page at its top, the user sends question 1
- **THEN** within one second the page has scrolled, question 2's card top lies 8 px (±2 px) under the header's bottom edge, and question 2's heading has focus

#### Scenario: A question below the viewport
- **WHEN** at 1280×800 with sections and "Go to the next", on the board of nine tall questions, the user sends question 3
- **THEN** within one second question 4's card top lies 8 px (±2 px) under the header's bottom edge, and its heading has focus

#### Scenario: Within a tab
- **WHEN** with tabs and "Go to the next" the user sends question 1 while question 2, in the same tab, is to do
- **THEN** question 2's card top lies 8 px (±2 px) under the tab strip's bottom edge, and its heading has focus

#### Scenario: The last question near the page's end
- **WHEN** with sections the next question to do is the board's last and the page cannot scroll far enough to bring its card under the header
- **THEN** the page is at its end, the card's heading has focus and lies wholly between the header and the viewport's bottom edge

#### Scenario: One question per view scrolled down
- **WHEN** in one question per view the user has scrolled down a tall question and sends it while another is to do
- **THEN** the page is at its top, the next question to do is shown, its heading has focus and its card carries the arrival mark

#### Scenario: A card taller than the viewport
- **WHEN** the next question to do's card is taller than the space between the header and the viewport's bottom edge
- **THEN** its top lies 8 px (±2 px) under the header's bottom edge, and its heading has focus

#### Scenario: A card above changes height during the move
- **WHEN** a card above the target changes height while the move runs
- **THEN** once the move ends, the target card's top lies 8 px (±2 px) under the sticky bars

#### Scenario: The user scrolls during the move
- **WHEN** the user scrolls the page while the smooth move runs
- **THEN** the move stops, and the page stays where the user put it

### Requirement: The arrival mark
The card the move arrives at SHALL show the arrival mark for 1.2 seconds: the `primary-subtle` fill and a 4 px `primary` edge inside its left border, held through the move, then fading to the card's own fill. Text, secondary text and muted text on that fill, and the edge on it, SHALL meet the palette's minimums in every palette, light and dark. Under forced colours the mark SHALL be a 3 px `Highlight` outline. Only the latest move's card SHALL carry it (WCAG 2.2 SC 1.4.3, 1.4.11).

#### Scenario: The mark at rest under reduced motion
- **WHEN** under `prefers-reduced-motion: reduce`, with "Go to the next", the user sends question 3 while question 4 is to do
- **THEN** question 4's card computes the `primary-subtle` background and a 4 px `primary` inner edge on its left, with no animation, and both are gone after 1.2 seconds

#### Scenario: The mark animates
- **WHEN** without a reduced-motion preference the user sends question 3 while question 4 is to do
- **THEN** question 4's card runs the arrival animation for 1.2 seconds, starting at the `primary-subtle` fill, and then shows the card's own fill

#### Scenario: Every palette
- **WHEN** the contrast report computes the arrival pairs for Carta, Nordico, Grafite and Contrasto, light and dark
- **THEN** text, secondary text and muted text on `primary-subtle` reach 4.5:1 (7:1 in Contrasto), and the `primary` edge on `primary-subtle` reaches 3:1 (4.5:1 in Contrasto)

#### Scenario: Forced colours
- **WHEN** forced colours are active and the board moves on to question 4
- **THEN** question 4's card shows a 3 px solid outline in the system's `Highlight` colour, gone after 1.2 seconds

#### Scenario: One mark at a time
- **WHEN** the board moves on to question 4 and, within 1.2 seconds, on to question 5
- **THEN** only question 5's card carries the arrival mark
