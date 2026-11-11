// The server instructions: the approved text of the model contract, whole, since the tools it names,
// `ask`, `update`, `collect` and `fetch`, are four of the five AskBoard tools (ask-lifecycle,
// design decision 2); it leaves out `snapshot`. E1 listed two tools and cut the lines about the
// others. The follow-up line carries agent-facing-gaps' amendment and the routing paragraph and the
// two skill lines carry skill-engagement's (APPROVED_TEXT_AMENDMENTS), which the PO approved on
// 2026-11-08 and 2026-11-10.

export const SERVER_INSTRUCTIONS = `AskBoard shows your questions to the user on a local web board and returns typed answers while you keep working.

Use it when a question is hard to grasp or to answer in a terminal dialog, whatever the number of questions or options: questions that are many and depend on one another; questions that cite documents by bare IDs (D-01, FR-12, ADR-7) the user would have to look up; content that reads better seen and worked on, such as a plan, a WBS or a Gantt, a chart, a table, a diagram or a state machine, a formula, or a document to review. These are examples: judge whether a visual, interactive board helps the user decide. A simple, self-explanatory choice stays in AskUserQuestion. The user's asking rule, or the user's own instruction about how to ask, decides first.

- Load the askboard skill (as a plugin skill, \`askboard:askboard\`) before your first \`ask\`: it says how to build each item.
- Never put a complex question to the user in chat prose: ask it on the board.
- Put everything you need in one \`ask\`, then keep working. The user gets a notice and a link. Never open the board or answer it yourself.
- Choose every ask and item ID yourself: an ask ID is a task slug plus a short random suffix. Change items by ID with \`update\`.
- Send content and data, never markup or layout. Point to project files instead of copying them; save screenshots under \`.askboard/media/\` and point to them.
- Never compute totals, estimates, dates or margins: AskBoard derives them and returns them with the answers.
- Recommended options are only labelled; the user still chooses.
- Collect answers with \`collect\` before you finish, passing the latest cursor you received for each ask. Answers carry only what changed; \`fetch\` returns a whole item.
- Reply to follow-ups at once with \`update\` (\`reply\`, with the question's \`itemId\` and the follow-up's cursor): the user is waiting for you.
- When the user answers a postponed question in the terminal, record it with \`update\` (\`answer\`).
- Do not ask a declined question again in this task. A \`discarded\` ask lost its unsent answers: ask again under a new ID if you still need them.`;
