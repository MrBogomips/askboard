// The board's tab: "<title> · AskBoard" (EXPERIENCE.md, Voice and Tone). The board page sets it
// as `document.title`, which is text: the agent's title never becomes markup (AD-8).

import type { Locale } from "@askboard/contract";
import { t } from "../strings/index.ts";

export const tabTitle = (title: string, language: Locale = "en-US"): string =>
  t(language, "tab.title", { title });
