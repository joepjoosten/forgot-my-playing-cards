import { Atom } from "effect/unstable/reactivity";
import { ConvexClient } from "convex/browser";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";

const url = import.meta.env.VITE_CONVEX_URL ?? import.meta.env.CONVEX_URL;
if (url === undefined) {
  throw new Error(
    "Missing VITE_CONVEX_URL. Run `npx convex dev` once, or set it in .env",
  );
}

export const convex = new ConvexClient(url);

const cache = new Map<string, Atom.Atom<unknown>>();

/**
 * An effect-atom Atom that stays subscribed to a Convex query while mounted.
 * Atoms are cached per (query, args) so every component sharing a query
 * shares one live Convex subscription; when the last subscriber unmounts,
 * the finalizer tears the subscription down.
 */
export const convexQuery = <Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
): Atom.Atom<FunctionReturnType<Query> | undefined> => {
  const key = getFunctionName(query) + ":" + JSON.stringify(args);
  let atom = cache.get(key);
  if (atom === undefined) {
    atom = Atom.make((get) => {
      const unsubscribe = convex.onUpdate(query, args, (value) => {
        get.setSelf(value);
      });
      get.addFinalizer(unsubscribe);
      return undefined as FunctionReturnType<Query> | undefined;
    });
    cache.set(key, atom);
  }
  return atom as Atom.Atom<FunctionReturnType<Query> | undefined>;
};

/** Fire a Convex mutation; errors are logged, never thrown into the UI. */
export const run = <Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  args: FunctionArgs<Mutation>,
): Promise<FunctionReturnType<Mutation> | undefined> =>
  convex.mutation(mutation, args).catch((error: unknown) => {
    console.error("mutation failed", getFunctionName(mutation), error);
    return undefined;
  });
