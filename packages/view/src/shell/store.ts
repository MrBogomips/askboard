// A value the view renders from that the board page may replace after boot, such as the board
// state: React reads it through `useSyncExternalStore`. Values are replaced, never changed.

export type Store<T> = {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
};

export const createStore = <T>(initial: T): Store<T> => {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (Object.is(next, current)) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
