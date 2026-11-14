// Fills the `{{slot}}` markers of the generator's templates, which both generators share.

const SLOT = /\{\{(\w+)\}\}/g;

// Fills every slot of each template. A slot no value fills, and a value no template uses, fail.
export const fill = (
  templates: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
): Record<string, string> => {
  const used = new Set<string>();
  const filled = Object.fromEntries(
    Object.entries(templates).map(([name, text]) => [
      name,
      text.replace(SLOT, (_slot, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`the ${name} template has the slot {{${key}}}, which no value fills`);
        }
        used.add(key);
        return value;
      }),
    ]),
  );
  const unused = Object.keys(values).filter((key) => !used.has(key));
  if (unused.length > 0) {
    throw new Error(`no template uses the value ${unused.map((key) => `"${key}"`).join(", ")}`);
  }
  return filled;
};
