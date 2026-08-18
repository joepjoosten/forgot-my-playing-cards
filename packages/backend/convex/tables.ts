import { Effect } from "effect";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { language, tableConfig } from "./schema";
import { deal, mulberry32, prepareDeck, shuffle, type CardSpec } from "./lib/deck";
import { circlePosition } from "./lib/layout";
import { moveCards, zoneCards } from "./lib/zones";
import { clearAll } from "./events";

// No 0/O/1/I: every character is unambiguous when read from a screen.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

const generateCode = (): string =>
  Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");

export const create = mutation({
  args: {
    name: v.string(),
    config: tableConfig,
    language: v.optional(language),
  },
  handler: async (ctx, args) => {
    let code = generateCode();
    while (
      (await ctx.db
        .query("tables")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first()) !== null
    ) {
      code = generateCode();
    }
    return await ctx.db.insert("tables", {
      name: args.name,
      status: "lobby",
      config: args.config,
      round: 0,
      language: args.language ?? "en",
      code,
    });
  },
});

/** Look a table up by its short join code (case/whitespace-insensitive). */
export const byCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.replace(/\s/g, "").toUpperCase();
    if (code.length === 0) return null;
    return await ctx.db
      .query("tables")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
  },
});

export const setLanguage = mutation({
  args: { tableId: v.id("tables"), language },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tableId, { language: args.language });
  },
});

export const get = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tableId);
  },
});

export const updateConfig = mutation({
  args: { tableId: v.id("tables"), config: tableConfig },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tableId, { config: args.config });
  },
});

/**
 * Move the visual turn marker to a player, or clear it. Purely cosmetic:
 * the platform never enforces turn order.
 */
export const setTurn = mutation({
  args: { tableId: v.id("tables"), playerId: v.optional(v.id("players")) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tableId, { turnPlayerId: args.playerId });
  },
});

/** Insert one freshly dealt card; the overrides say where it starts. */
const insertCard = (
  ctx: MutationCtx,
  tableId: Id<"tables">,
  spec: CardSpec,
  overrides: {
    zone: Doc<"cards">["zone"];
    order: number;
    ownerId?: Id<"players">;
    x?: number;
    y?: number;
    z?: number;
    faceUp?: boolean;
  },
) =>
  ctx.db.insert("cards", {
    tableId,
    deck: spec.deck,
    rank: spec.rank,
    suit: spec.suit,
    x: 0.5,
    y: 0.5,
    z: 0,
    faceUp: false,
    ...overrides,
  });

/**
 * Start a (new) round: rebuild the decks, shuffle them according to the
 * table config (an Effect program), deal every player their cards and put
 * the remainder on the stock pile (or spread it on the board when the
 * table has no stock pile). Players are re-arranged in a circle.
 */
export const startRound = mutation({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (table === null) throw new Error("Table not found");

    const players = (
      await ctx.db
        .query("players")
        .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
        .collect()
    ).sort((a, b) => a.seat - b.seat);

    await clearAll(ctx, args.tableId);

    // Remove all cards from the previous round.
    const oldCards = await ctx.db
      .query("cards")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();
    for (const card of oldCards) {
      await ctx.db.delete(card._id);
    }

    // Convex seeds Math.random deterministically per mutation execution.
    const seed = Math.floor(Math.random() * 0xffffffff);

    const { hands, stock } = Effect.runSync(
      Effect.gen(function* () {
        const deck = yield* prepareDeck(table.config, seed);
        return yield* deal(deck, players.length, table.config.dealPerPlayer);
      }),
    );

    for (let p = 0; p < players.length; p++) {
      const player = players[p]!;
      const hand = hands[p] ?? [];
      for (let i = 0; i < hand.length; i++) {
        await insertCard(ctx, args.tableId, hand[i]!, {
          zone: "hand",
          ownerId: player._id,
          order: i,
          faceUp: true,
        });
      }
    }

    // Flip the configured number of opening cards face-up onto the burn
    // pile (the top of the stock goes first, so it ends up on top).
    const openCount = table.config.burnPile
      ? Math.min(table.config.startBurnCount ?? 0, stock.length)
      : 0;
    const open = stock.splice(stock.length - openCount, openCount).reverse();
    for (let i = 0; i < open.length; i++) {
      await insertCard(ctx, args.tableId, open[i]!, {
        zone: "burn",
        order: i,
        faceUp: true,
      });
    }

    for (let i = 0; i < stock.length; i++) {
      if (table.config.stockPile) {
        await insertCard(ctx, args.tableId, stock[i]!, {
          zone: "stock",
          order: i,
        });
      } else {
        // No stock pile: scatter the remaining cards face down on the board.
        await insertCard(ctx, args.tableId, stock[i]!, {
          zone: "board",
          order: i,
          x: 0.2 + 0.6 * ((i * 37) % 100) / 100,
          y: 0.25 + 0.5 * ((i * 61) % 100) / 100,
          z: i,
        });
      }
    }

    // Arrange the players in a circle for the new round.
    for (let i = 0; i < players.length; i++) {
      const pos = circlePosition(i, players.length);
      await ctx.db.patch(players[i]!._id, { seat: i, x: pos.x, y: pos.y });
    }

    await ctx.db.patch(args.tableId, {
      status: "playing",
      round: table.round + 1,
    });
  },
});

/**
 * Reshuffle the burn pile and slide it face-down under the current stock
 * pile — the usual move when the stock runs low. Uses the table's
 * configured shuffle, freshly seeded.
 */
export const reshuffleBurn = mutation({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (table === null) throw new Error("Table not found");

    const burn = await zoneCards(ctx, args.tableId, "burn");
    if (burn.length === 0) return;

    const seed = Math.floor(Math.random() * 0xffffffff);
    const shuffled = Effect.runSync(
      shuffle(burn, table.config.shuffle, table.config.shufflePasses, mulberry32(seed)),
    );

    await moveCards(ctx, shuffled, { zone: "stock", at: "bottom" });
  },
});

/**
 * Gather every card on the board into a pile: the burn pile, or the bottom
 * of the stock pile (e.g. collecting a trick / a played round).
 */
export const gatherBoard = mutation({
  args: {
    tableId: v.id("tables"),
    to: v.union(v.literal("burn"), v.literal("stock")),
  },
  handler: async (ctx, args) => {
    const boardCards = (await zoneCards(ctx, args.tableId, "board")).sort(
      (a, b) => a.z - b.z,
    );
    // Gathered cards land on top of the burn, or slide under the current
    // stock (they get drawn last).
    await moveCards(
      ctx,
      boardCards,
      args.to === "burn" ? { zone: "burn" } : { zone: "stock", at: "bottom" },
    );
  },
});
