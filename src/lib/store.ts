type Listener<T> = (value: T) => void;

export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get() {
      return value;
    },
    set(next: T) {
      value = next;
      listeners.forEach((listen) => listen(value));
    },
    subscribe(listen: Listener<T>) {
      listeners.add(listen);
      listen(value);
      return () => listeners.delete(listen);
    },
  };
}

export function bust(path: string): string {
  return `${path}?t=${Date.now()}`;
}
