import { Effect } from "effect";

/**
 * Deck building and shuffling, written as Effect (v4) programs.
 *
 * All randomness flows through an explicit seeded PRNG so a shuffle is a
 * deterministic function of (config, seed) — convenient inside Convex
 * mutations, which must be deterministic.
 */

export interface CardSpec {
  readonly deck: number;
  readonly rank: string;
  readonly suit: string;
}

export type ShuffleKind =
  | "fisher-yates"
  | "riffle"
  | "overhand"
  | "cut"
  | "none";

export interface DeckConfig {
  readonly deckCount: number;
  readonly jokersPerDeck: number;
  readonly shuffle: ShuffleKind;
  readonly shufflePasses: number;
}

export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32). */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const buildDecks = (
  deckCount: number,
  jokersPerDeck: number,
): Effect.Effect<Array<CardSpec>> =>
  Effect.sync(() => {
    const cards: Array<CardSpec> = [];
    for (let deck = 0; deck < deckCount; deck++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          cards.push({ deck, rank, suit });
        }
      }
      for (let j = 0; j < jokersPerDeck; j++) {
        cards.push({ deck, rank: "JOKER", suit: "★" });
      }
    }
    return cards;
  });

const fisherYates = <A>(cards: ReadonlyArray<A>, rng: Rng): Array<A> => {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
};

/** Split the deck roughly in half and interleave in small uneven clumps. */
const riffleOnce = <A>(cards: ReadonlyArray<A>, rng: Rng): Array<A> => {
  const mid =
    Math.floor(cards.length / 2) +
    Math.floor((rng() - 0.5) * Math.min(8, cards.length / 4));
  let left = cards.slice(0, mid);
  let right = cards.slice(mid);
  const out: Array<A> = [];
  while (left.length > 0 || right.length > 0) {
    const takeLeft = 1 + Math.floor(rng() * 3);
    out.push(...left.slice(0, takeLeft));
    left = left.slice(takeLeft);
    const takeRight = 1 + Math.floor(rng() * 3);
    out.push(...right.slice(0, takeRight));
    right = right.slice(takeRight);
  }
  return out;
};

/** Repeatedly pull small packets off the top onto a new pile. */
const overhandOnce = <A>(cards: ReadonlyArray<A>, rng: Rng): Array<A> => {
  let rest = [...cards];
  const out: Array<A> = [];
  while (rest.length > 0) {
    const take = 1 + Math.floor(rng() * Math.max(2, rest.length / 5));
    out.unshift(...rest.slice(0, take));
    rest = rest.slice(take);
  }
  return out;
};

const cutOnce = <A>(cards: ReadonlyArray<A>, rng: Rng): Array<A> => {
  if (cards.length < 2) return [...cards];
  const at = 1 + Math.floor(rng() * (cards.length - 1));
  return [...cards.slice(at), ...cards.slice(0, at)];
};

const pass = <A>(kind: ShuffleKind, cards: ReadonlyArray<A>, rng: Rng): Array<A> => {
  switch (kind) {
    case "fisher-yates":
      return fisherYates(cards, rng);
    case "riffle":
      return riffleOnce(cards, rng);
    case "overhand":
      return overhandOnce(cards, rng);
    case "cut":
      return cutOnce(cards, rng);
    case "none":
      return [...cards];
  }
};

export const shuffle = <A>(
  cards: ReadonlyArray<A>,
  kind: ShuffleKind,
  passes: number,
  rng: Rng,
): Effect.Effect<Array<A>> =>
  Effect.gen(function* () {
    let current = [...cards];
    const rounds = kind === "none" ? 0 : Math.max(1, Math.floor(passes));
    for (let i = 0; i < rounds; i++) {
      current = yield* Effect.sync(() => pass(kind, current, rng));
    }
    return current;
  });

/** Build all configured decks and shuffle them: the full "prepare" program. */
export const prepareDeck = (
  config: DeckConfig,
  seed: number,
): Effect.Effect<Array<CardSpec>> =>
  Effect.gen(function* () {
    const cards = yield* buildDecks(config.deckCount, config.jokersPerDeck);
    return yield* shuffle(cards, config.shuffle, config.shufflePasses, mulberry32(seed));
  });

/**
 * Deal `perPlayer` cards round-robin to `playerCount` players.
 * Returns the hands plus the remaining stock.
 */
export const deal = <A>(
  cards: ReadonlyArray<A>,
  playerCount: number,
  perPlayer: number,
): Effect.Effect<{ hands: Array<Array<A>>; stock: Array<A> }> =>
  Effect.sync(() => {
    const hands: Array<Array<A>> = Array.from({ length: playerCount }, () => []);
    let index = 0;
    for (let round = 0; round < perPlayer; round++) {
      for (let p = 0; p < playerCount; p++) {
        if (index >= cards.length) break;
        hands[p]!.push(cards[index]!);
        index++;
      }
    }
    return { hands, stock: cards.slice(index) };
  });
