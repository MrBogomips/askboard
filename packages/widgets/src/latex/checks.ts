// A LaTeX's props as the component takes them (design decision 7): the view hands props over as
// data, unchecked, so the contract's own plain check of the props' limits runs here, and a problem
// throws, naming the item; the item's error boundary then fails it and its question never counts as
// visible (AD-10). The agent's expression is never parsed here: drawing it is KaTeX's.

import { type LatexProps, latexPropsProblems } from "@askboard/contract";

/** The props as an agent's LaTeX, or an error naming the item and the problems. */
export const checkedLatexProps = (itemId: string, props: unknown): LatexProps => {
  const problems = latexPropsProblems(props).map(({ path, message }) => `${path}: ${message}`);
  if (problems.length === 0) return props as LatexProps;
  throw new Error(`the LaTeX "${itemId}" refuses its props: ${problems.join("; ")}`);
};
