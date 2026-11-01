// What the Choice atom gets through the port: a question with options as its item, and the labels
// chosen so far as its value, undefined while none has been (design decision 7).

import type { BoardQuestion } from "@askboard/contract";
import type { ItemProps } from "../port.ts";

export type ChoiceProps = ItemProps<BoardQuestion, readonly string[]>;
