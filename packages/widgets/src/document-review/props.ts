// A Document review's props as the component takes them (view-and-widgets spec: A Document review's
// document; AD-10): the view hands props over as data, unchecked, so the contract's own checks run
// here, and a problem throws, naming the item; the item's error boundary then fails it and its
// question never counts as visible. The props object is given back as it came, since its reading
// is kept per props object (design decision 7).

import { type DocumentReviewProps, documentReviewPropsProblems } from "@askboard/contract";

/** The props as an agent's Document review, or an error naming the item and each problem. */
export const checkedProps = (itemId: string, props: unknown): DocumentReviewProps => {
  const problems = documentReviewPropsProblems(props);
  if (problems.length === 0) return props as DocumentReviewProps;
  const said = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
  throw new Error(`the Document review "${itemId}" refuses its props: ${said}`);
};
