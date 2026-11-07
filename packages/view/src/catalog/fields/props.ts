// An input atom's props as the view gets them: unchecked data, which the chunk checks with the
// contract's plain checks as an agent's and refuses by throwing, so that the item's error boundary
// shows it failed and its question never counts as visible (AD-10).

type Problem = { readonly path: string; readonly message: string };

/** The props, when the check finds nothing wrong; otherwise an error naming the item and each problem. */
export const checkedProps = <Props>(
  noun: string,
  itemId: string,
  props: unknown,
  check: (props: unknown) => readonly Problem[],
): Props => {
  const problems = check(props);
  if (problems.length > 0) {
    const said = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the ${noun} "${itemId}" refuses its props: ${said}`);
  }
  return props as Props;
};
