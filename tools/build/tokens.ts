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
  /** Each named palette but Carta: its roles and their `-dark` twins (palettes, design decision D2). */
  readonly palettes: Readonly<Record<string, Readonly<Record<string, string>>>>;
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
    palettes: parsed.palettes ?? {},
    typography: parsed.typography ?? {},
    rounded: parsed.rounded ?? {},
    spacing: parsed.spacing ?? {},
  };
};

const lightNames = (tokens: DesignTokens): string[] =>
  Object.keys(tokens.colors).filter((name) => !name.endsWith(DARK));

const declarations = (pairs: readonly [string, string][]): string =>
  pairs.map(([name, value]) => `--${name}:${value};`).join("");

/**
 * The spacing keys that no density changes and a component reads as a variable: the rail's width,
 * which the rail and its fit test share (answering-flow-visual, design decision 2).
 */
const FIXED_SPACING = ["outline-rail"] as const;

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
    ...FIXED_SPACING.flatMap((name): [string, string][] =>
      tokens.spacing[name] === undefined ? [] : [[name, String(tokens.spacing[name])]],
    ),
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

/** The roles of `colors`: every light key that is not an alias. */
const roleNames = (tokens: DesignTokens): string[] =>
  lightNames(tokens).filter((name) => !Object.hasOwn(tokens.aliases, name));

// One palette's group against `colors` (D3): every role and its twin, nothing else, no alias.
const checkGroup = (tokens: DesignTokens, name: string): Record<string, string> => {
  const group = Object.hasOwn(tokens.palettes, name) ? tokens.palettes[name] : undefined;
  if (group === undefined) throw new Error(`the palette "${name}" has no group in palettes`);
  const roles = roleNames(tokens);
  for (const key of Object.keys(group)) {
    if (Object.hasOwn(tokens.aliases, key.endsWith(DARK) ? key.slice(0, -DARK.length) : key)) {
      throw new Error(`the palette "${name}" sets the alias "${key}", which no palette may set`);
    }
    const role = key.endsWith(DARK) ? key.slice(0, -DARK.length) : key;
    if (!roles.includes(role)) {
      throw new Error(`the palette "${name}" holds "${key}", which is no role of colors`);
    }
  }
  for (const role of roles) {
    for (const key of [role, `${role}${DARK}`]) {
      if (!Object.hasOwn(group, key)) {
        throw new Error(`the palette "${name}" has no value for "${key}"`);
      }
    }
  }
  return group;
};

/**
 * The named palettes against the contract's list: one whole group for each name but `carta`
 * (whose values are `colors`), and no group for a name the contract does not list.
 */
export const checkPalettes = (tokens: DesignTokens, names: readonly string[]): void => {
  for (const name of Object.keys(tokens.palettes)) {
    if (!names.includes(name) || name === "carta") {
      throw new Error(`the palette "${name}" is not one the contract names besides carta`);
    }
  }
  for (const name of names) if (name !== "carta") checkGroup(tokens, name);
};

/**
 * One palette's roles, light on `:root[data-palette]` and dark on its `.dark` form: more specific
 * than `:root` and `.dark`, so it wins with no `!important` and no order dependence (D3). Aliases
 * resolve through `var(--target)` from `:root`, so a palette holds roles only.
 */
export const paletteCss = (tokens: DesignTokens, name: string): string => {
  const group = checkGroup(tokens, name);
  if (!/^[a-z]+$/.test(name)) throw new Error(`the palette name "${name}" is not a plain name`);
  const roles = roleNames(tokens);
  const light = roles.map((role): [string, string] => [role, group[role] ?? ""]);
  const dark = roles.map((role): [string, string] => [role, group[`${role}${DARK}`] ?? ""]);
  const selector = `:root[data-palette="${name}"]`;
  return `${selector}{${declarations(light)}}\n${selector}.dark{${declarations(dark)}}\n`;
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
