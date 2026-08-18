import { useRef, useState } from "react";

/**
 * Local overrides shown until the server echoes a mutation back — the one
 * optimistic-UI pattern of this app (a dropped card pinned at its drop
 * point, a played card hidden from the hand, a fresh hand order).
 *
 * Convex resolves a mutation only after our subscriptions reflect the
 * write, so dropping an override when its mutation settles can never flash
 * the stale pre-mutation state. Every id carries an epoch: a newer apply or
 * hold on the same id invalidates the cleanup of an older, still-running
 * mutation.
 */
export const useServerEcho = <V>() => {
  const [overrides, setOverrides] = useState<Record<string, V>>({});
  const epochs = useRef(new Map<string, number>());

  const bump = (ids: ReadonlyArray<string>): Map<string, number> => {
    const snapshot = new Map<string, number>();
    for (const id of ids) {
      const epoch = (epochs.current.get(id) ?? 0) + 1;
      epochs.current.set(id, epoch);
      snapshot.set(id, epoch);
    }
    return snapshot;
  };

  const drop = (snapshot: Map<string, number>) => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const [id, epoch] of snapshot) {
        if (epochs.current.get(id) === epoch) delete next[id];
      }
      return next;
    });
  };

  return {
    get: (id: string): V | undefined => overrides[id],
    /** Show values locally, run the mutation, clear them once it settles. */
    apply: (entries: Record<string, V>, mutate: () => Promise<unknown>): void => {
      const snapshot = bump(Object.keys(entries));
      setOverrides((prev) => ({ ...prev, ...entries }));
      void mutate().finally(() => drop(snapshot));
    },
    /** Show a value locally with no mutation yet (e.g. during a drag). */
    hold: (id: string, value: V): void => {
      bump([id]);
      setOverrides((prev) => ({ ...prev, [id]: value }));
    },
    /** Drop an override immediately (a drag that ended without a mutation). */
    clear: (id: string): void => {
      drop(bump([id]));
    },
  };
};
