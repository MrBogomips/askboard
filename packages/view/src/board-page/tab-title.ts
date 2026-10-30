// The board's tab: "<title> · AskBoard" (EXPERIENCE.md, Voice and Tone). The board page sets it
// as `document.title`, which is text: the agent's title never becomes markup (AD-8).

export const tabTitle = (title: string): string => `${title} · AskBoard`;
