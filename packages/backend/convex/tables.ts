import { Effect } from "effect";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { tableConfig } from "./schema";
import { deal, prepareDeck } from "./lib/deck";
import { circlePosition } from "./lib/layout";

export const create = mutation({
  args: {
    name: v.string(),
    config: tableConfig,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tables", {
      name: args.name,
      status: "lobby",
      config: args.config,
      round: 0,
    });
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
        const spec = hand[i]!;
        await ctx.db.insert("cards", {
          tableId: args.tableId,
          deck: spec.deck,
          rank: spec.rank,
          suit: spec.suit,
          zone: "hand",
          ownerId: player._id,
          order: i,
          x: 0.5,
          y: 0.5,
          z: 0,
          faceUp: true,
        });
      }
    }

    for (let i = 0; i < stock.length; i++) {
      const spec = stock[i]!;
      if (table.config.stockPile) {
        await ctx.db.insert("cards", {
          tableId: args.tableId,
          deck: spec.deck,
          rank: spec.rank,
          suit: spec.suit,
          zone: "stock",
          order: i,
          x: 0.5,
          y: 0.5,
          z: 0,
          faceUp: false,
        });
      } else {
        // No stock pile: scatter the remaining cards face down on the board.
        await ctx.db.insert("cards", {
          tableId: args.tableId,
          deck: spec.deck,
          rank: spec.rank,
          suit: spec.suit,
          zone: "board",
          order: i,
          x: 0.2 + 0.6 * ((i * 37) % 100) / 100,
          y: 0.25 + 0.5 * ((i * 61) % 100) / 100,
          z: i,
          faceUp: false,
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
 * Gather every card on the board into a pile: the burn pile, or the bottom
 * of the stock pile (e.g. collecting a trick / a played round).
 */
export const gatherBoard = mutation({
  args: {
    tableId: v.id("tables"),
    to: v.union(v.literal("burn"), v.literal("stock")),
  },
  handler: async (ctx, args) => {
    const boardCards = (
      await ctx.db
        .query("cards")
        .withIndex("by_table_zone", (q) =>
          q.eq("tableId", args.tableId).eq("zone", "board"),
        )
        .collect()
    ).sort((a, b) => a.z - b.z);

    const pile = await ctx.db
      .query("cards")
      .withIndex("by_table_zone", (q) =>
        q.eq("tableId", args.tableId).eq("zone", args.to),
      )
      .collect();

    if (args.to === "burn") {
      let top = pile.reduce((max, c) => Math.max(max, c.order), -1);
      for (const card of boardCards) {
        top++;
        await ctx.db.patch(card._id, {
          zone: "burn",
          order: top,
          ownerId: undefined,
          faceUp: true,
        });
      }
    } else {
      // Slide the gathered cards under the current stock (they get drawn last).
      let bottom = pile.reduce((min, c) => Math.min(min, c.order), 0);
      for (const card of boardCards) {
        bottom--;
        await ctx.db.patch(card._id, {
          zone: "stock",
          order: bottom,
          ownerId: undefined,
          faceUp: false,
        });
      }
    }
  },
});
