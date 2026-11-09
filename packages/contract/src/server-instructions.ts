// The server instructions: the approved text of the model contract, whole, since the tools it names,
// `ask`, `update`, `collect` and `fetch`, are the four AskBoard lists (ask-lifecycle, design
// decision 2). E1 listed two tools and cut the lines about the others. The follow-up line carries agent-facing-gaps'
// amendment (APPROVED_TEXT_AMENDMENTS), which the PO approved on 2026-11-08.

export const SERVER_INSTRUCTIONS = `AskBoard shows your questions to the user on a local web board and returns typed answers while you keep working.

Use it for questions AskUserQuestion carries badly: more than four at once, or a question that needs a diff, a plan, a tree, a table, a graph, a diagram, an image, or a file excerpt beside it. For one quick choice AskUserQuestion is fine, unless the user's asking rule says otherwise.

- Put everything you need in one \`ask\`, then keep working. The user gets a notice and a link. Never open the board or answer it yourself.
- Choose every ask and item ID yourself: an ask ID is a task slug plus a short random suffix. Change items by ID with \`update\`.
- Send content and data, never markup or layout. Point to project files instead of copying them; save screenshots under \`.askboard/media/\` and point to them.
- Never compute totals, estimates, dates or margins: AskBoard derives them and returns them with the answers.
- Recommended options are only labelled; the user still chooses.
- Collect answers with \`collect\` before you finish, passing the latest cursor you received for each ask. Answers carry only what changed; \`fetch\` returns a whole item.
- Reply to follow-ups at once with \`update\` (\`reply\`, with the question's \`itemId\` and the follow-up's cursor): the user is waiting for you.
- When the user answers a postponed question in the terminal, record it with \`update\` (\`answer\`).
- Do not ask a declined question again in this task. A \`discarded\` ask lost its unsent answers: ask again under a new ID if you still need them.`;
