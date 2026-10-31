// The server instructions: the approved text of the model contract, keeping only the lines that
// apply to the tools E1 lists, `ask` and `collect` (design decision 4). The lines about `update`,
// `fetch`, follow-ups, postponing and declining come back with the epics that list those.

export const SERVER_INSTRUCTIONS = `AskBoard shows your questions to the user on a local web board and returns typed answers while you keep working.

Use it for questions AskUserQuestion carries badly: more than four at once, or a question that needs a diff, a plan, a tree, a table, a graph, a diagram, an image, or a file excerpt beside it. For one quick choice AskUserQuestion is fine, unless the user's asking rule says otherwise.

- Put everything you need in one \`ask\`, then keep working. The user gets a notice and a link. Never open the board or answer it yourself.
- Choose every ask and item ID yourself: an ask ID is a task slug plus a short random suffix.
- Send content and data, never markup or layout. Point to project files instead of copying them; save screenshots under \`.askboard/media/\` and point to them.
- Never compute totals, estimates, dates or margins: AskBoard derives them and returns them with the answers.
- Recommended options are only labelled; the user still chooses.
- Collect answers with \`collect\` before you finish, passing the latest cursor you received for each ask. Answers carry only what changed.
- A \`discarded\` ask lost its unsent answers: ask again under a new ID if you still need them.`;
