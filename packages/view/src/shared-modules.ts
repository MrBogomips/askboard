// The registry through which the view's chunks share modules (design decision 7). Classic scripts
// share no module scope, so the registry is one property of the global object: a library chunk
// provides the libraries several chunks use and the shell provides the `CatalogRenderer` port, and
// the view build compiles every import of a shared module in another chunk to `shared(name)`.

const REGISTRY = "__askboard";

type Registry = Record<string, unknown>;

const registry = (): Registry => {
  const host = globalThis as unknown as Record<string, Registry | undefined>;
  const existing = host[REGISTRY];
  if (existing !== undefined) return existing;
  const created: Registry = Object.create(null);
  host[REGISTRY] = created;
  return created;
};

/** Makes a module available to the chunks that run after this one. */
export const provide = (name: string, module: unknown): void => {
  const modules = registry();
  if (Object.hasOwn(modules, name)) throw new Error(`the module "${name}" is provided twice`);
  modules[name] = module;
};

/** A module that a chunk run earlier provided; `assemble` orders the chunks by what they need. */
export const shared = (name: string): unknown => {
  const modules = registry();
  if (!Object.hasOwn(modules, name)) {
    throw new Error(`no chunk loaded before this one provides the module "${name}"`);
  }
  return modules[name];
};
