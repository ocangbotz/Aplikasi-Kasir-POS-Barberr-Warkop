/**
 * state.js
 * Store reaktif minimal (pub/sub) tanpa framework. Dipakai untuk state yang
 * perlu memicu re-render di banyak komponen sekaligus (mis. user login, tema).
 */
export function createStore(initialValue) {
  let value = initialValue;
  const listeners = new Set();

  return {
    get() {
      return value;
    },
    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      listeners.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(value);
      return () => listeners.delete(fn);
    }
  };
}
