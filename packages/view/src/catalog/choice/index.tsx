// The Choice atom's chunk (design decision 8): Radix Radio Group for one choice, Checkbox for
// several, never Select (renderer row 6), each with manual activation. It renders only the options;
// the question card around it is view chrome. Nothing is preselected (AD-10): the options show the
// draft value, which starts unset, as no choice. It is ready as soon as it has been laid out (AD-9).

import { CHOICE } from "../components.ts";
import { register, useReadyAfterLayout } from "../port.ts";
import { MultipleChoice } from "./multiple-choice.tsx";
import type { ChoiceProps } from "./props.ts";
import { SingleChoice } from "./single-choice.tsx";

const Choice = (props: ChoiceProps) => {
  useReadyAfterLayout(props.ready);
  return props.item.props.multiSelect === true ? (
    <MultipleChoice {...props} />
  ) : (
    <SingleChoice {...props} />
  );
};

register(CHOICE, Choice);
