// DESIGN.md's tokens as CSS (DESIGN.md, Colors: token layers): each colour a variable in the light
// scheme and again under `.dark`, which the board page sets on the view's root (renderer row 15),
// and Tailwind's theme mapping the utilities onto the variables, so components read only them.
// Aliases point at their target once, the same in both schemes. Fonts are the system stacks until
// the faces are adopted (design, Non-Goals).

const DARK = "-dark";
const COMFORTABLE = "-comfortable";

const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

type TypeStyle = {
  readonly fontSize?: string;
  readonly fontWeight?: string | number;
  readonly lineHeight?: string | number;
  readonly letterSpacing?: string;
};

export type DesignTokens = {
  readonly colors: Readonly<Record<string, string>>;
  /** Alias colours by name, with the colour each points at. */
  readonly aliases: Readonly<Record<string, string>>;
  readonly typography: Readonly<Record<string, TypeStyle>>;
  readonly rounded: Readonly<Record<string, string>>;
  readonly spacing: Readonly<Record<string, string>>;
};

// The YAML shows an alias resolved to hex, marked by a comment: `input: '#8f877a'  # = border-strong`.
const ALIAS = /^\s+([a-z0-9-]+):\s*'[^']*'\s*#\s*=\s*([a-z0-9-]+)\s*$/gm;

/** The tokens of DESIGN.md's YAML front matter. */
export const readDesignTokens = (markdown: string): DesignTokens => {
  const front = /^---\n([\s\S]*?)\n---$/m.exec(markdown)?.[1];
  if (front === undefined) throw new Error("DESIGN.md has no YAML front matter with its tokens");
  const parsed = Bun.YAML.parse(front) as Partial<DesignTokens>;
  const aliases = Object.fromEntries(
    [...front.matchAll(ALIAS)].map(([, name = "", target = ""]) => [name, target]),
  );
  return {
    colors: parsed.colors ?? {},
    aliases,
    typography: parsed.typography ?? {},
    rounded: parsed.rounded ?? {},
    spacing: parsed.spacing ?? {},
  };
};

const lightNames = (tokens: DesignTokens): string[] =>
  Object.keys(tokens.colors).filter((name) => !name.endsWith(DARK));

const declarations = (pairs: readonly [string, string][]): string =>
  pairs.map(([name, value]) => `--${name}:${value};`).join("");

/** The compact and the comfortable value of each density-dependent spacing key. */
const spacingPairs = (spacing: DesignTokens["spacing"]) => {
  const names = Object.keys(spacing).filter((name) => name.endsWith(COMFORTABLE));
  return names.map((name) => {
    const base = name.slice(0, -COMFORTABLE.length);
    const compact = spacing[base];
    if (compact === undefined) {
      throw new Error(`the key "${name}" has no compact key "${base}"`);
    }
    return { name: base, compact: String(compact), comfortable: String(spacing[name]) };
  });
};

/** The font-size variables: every style's compact size, and each comfortable delta. */
const sizePairs = (typography: DesignTokens["typography"]) => {
  const compact = Object.entries(typography)
    .filter(([name]) => !name.endsWith(COMFORTABLE))
    .flatMap(([name, style]): [string, string][] =>
      style.fontSize === undefined ? [] : [[`fs-${name}`, style.fontSize]],
    );
  const comfortable = Object.entries(typography)
    .filter(([name]) => name.endsWith(COMFORTABLE))
    .flatMap(([name, style]): [string, string][] => {
      const base = name.slice(0, -COMFORTABLE.length);
      if (typography[base] === undefined) {
        throw new Error(`the type style "${name}" has no compact style "${base}"`);
      }
      return style.fontSize === undefined ? [] : [[`fs-${base}`, style.fontSize]];
    });
  return { compact, comfortable };
};

/**
 * `:root` with the light scheme, every alias and the compact density, then `.dark` with the dark
 * scheme and `.comfortable` re-pointing the density variables (the type sizes and the spacing).
 */
export const tokensCss = (tokens: DesignTokens): string => {
  const light: [string, string][] = [];
  const dark: [string, string][] = [];
  for (const name of lightNames(tokens)) {
    const target = Object.hasOwn(tokens.aliases, name) ? tokens.aliases[name] : undefined;
    if (target !== undefined) {
      if (!Object.hasOwn(tokens.colors, target) || target.endsWith(DARK)) {
        throw new Error(`the alias "${name}" points at "${target}", which is no colour`);
      }
      light.push([name, `var(--${target})`]);
      continue;
    }
    const darkValue = tokens.colors[`${name}${DARK}`];
    if (darkValue === undefined) {
      throw new Error(`the colour "${name}" has no dark value ("${name}${DARK}")`);
    }
    light.push([name, tokens.colors[name] ?? ""]);
    dark.push([name, darkValue]);
  }
  const spacing = spacingPairs(tokens.spacing);
  const sizes = sizePairs(tokens.typography);
  const compact = [
    ...spacing.map((pair): [string, string] => [pair.name, pair.compact]),
    ...sizes.compact,
  ];
  const roomy = [
    ...spacing.map((pair): [string, string] => [pair.name, pair.comfortable]),
    ...sizes.comfortable,
  ];
  return (
    `:root{${declarations(light)}${declarations(compact)}color-scheme:light}\n` +
    `.dark{${declarations(dark)}color-scheme:dark}\n` +
    `.comfortable{${declarations(roomy)}}\n`
  );
};

const typeRamp = (typography: DesignTokens["typography"]): [string, string][] =>
  Object.entries(typography)
    .filter(([name]) => !name.endsWith(COMFORTABLE))
    .flatMap(([name, style]): [string, string][] => {
      if (style.fontSize === undefined) throw new Error(`the type style "${name}" has no fontSize`);
      const optional: [string, string | number | undefined][] = [
        [`text-${name}--line-height`, style.lineHeight],
        [`text-${name}--font-weight`, style.fontWeight],
        [`text-${name}--letter-spacing`, style.letterSpacing],
      ];
      return [
        [`text-${name}`, `var(--fs-${name})`],
        ...optional.flatMap(([key, value]): [string, string][] =>
          value === undefined ? [] : [[key, String(value)]],
        ),
      ];
    });

/**
 * Tailwind's theme: the colour, type and radius utilities read the token variables, with
 * Tailwind's defaults for those namespaces cleared so that no utility bypasses the tokens.
 */
export const themeCss = (tokens: DesignTokens): string => {
  const colors = lightNames(tokens).map((name): [string, string] => [
    `color-${name}`,
    `var(--${name})`,
  ]);
  const radius = Object.entries(tokens.rounded)
    .filter(([name]) => name !== "full")
    .map(([name, value]): [string, string] => [`radius-${name}`, value]);
  const spacing = spacingPairs(tokens.spacing).map(({ name }): [string, string] => [
    `spacing-${name}`,
    `var(--${name})`,
  ]);
  const inline = [
    ["color-*", "initial"],
    ...colors,
    ["text-*", "initial"],
    ...typeRamp(tokens.typography),
    ["radius-*", "initial"],
    ...radius,
    ...spacing,
  ] as [string, string][];
  return (
    `@theme inline{${declarations(inline)}}\n` +
    `@theme{${declarations([
      ["font-sans", SANS],
      ["font-mono", MONO],
    ])}}\n`
  );
};
