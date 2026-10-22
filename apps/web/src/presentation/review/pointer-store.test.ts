import { describe, expect, it, vi } from 'vitest';
import { createPointerStore } from './pointer-store';

describe('createPointerStore', () => {
  it('stores rounded image pixels and notifies only when they change', () => {
    const store = createPointerStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ x: 10.4, y: 20.6 });
    expect(store.get()).toEqual({ x: 10, y: 21 });
    store.set({ x: 10.2, y: 20.9 });
    expect(listener).toHaveBeenCalledTimes(1);

    store.set(null);
    store.set(null);
    expect(store.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set({ x: 1, y: 1 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies when leaving the origin pixel', () => {
    const store = createPointerStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ x: 0, y: 0 });
    store.set(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
