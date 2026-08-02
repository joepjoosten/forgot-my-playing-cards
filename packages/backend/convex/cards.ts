import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Everything the table screen needs. Hand cards are only exposed as counts:
 * the table never shows what is in a player's hand.
 */
export const forTable = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const board: Array<Doc<"cards">> = [];
    const handCounts: Record<string, number> = {};
    let stockCount = 0;
    let burnCount = 0;
    let burnTop: Doc<"cards"> | null = null;

    for (const card of cards) {
      switch (card.zone) {
        case "board":
          board.push(card);
          break;
        case "stock":
          stockCount++;
          break;
        case "burn":
          burnCount++;
          if (burnTop === null || card.order > burnTop.order) burnTop = card;
          break;
        case "hand": {
          const owner = card.ownerId ?? "unknown";
          handCounts[owner] = (handCounts[owner] ?? 0) + 1;
          break;
        }
      }
    }

    board.sort((a, b) => a.z - b.z);
    return { board, stockCount, burnCount, burnTop, handCounts };
  },
});

/** A player's own hand, in hand order. */
export const hand = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();
    return cards
      .filter((c) => c.zone === "hand")
      .sort((a, b) => a.order - b.order);
  },
});

/** Persist a full new hand order (drag & drop reordering on the phone). */
export const reorderHand = mutation({
  args: { playerId: v.id("players"), cardIds: v.array(v.id("cards")) },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.cardIds.length; i++) {
      const card = await ctx.db.get(args.cardIds[i]!);
      if (card !== null && card.ownerId === args.playerId && card.zone === "hand") {
        await ctx.db.patch(card._id, { order: i });
      }
    }
  },
});

const nextBoardZ = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
): Promise<number> => {
  const board = await ctx.db
    .query("cards")
    .withIndex("by_table_zone", (q) => q.eq("tableId", tableId).eq("zone", "board"))
    .collect();
  return board.reduce((max, c) => Math.max(max, c.z), 0) + 1;
};

/** Throw a card from a hand (or move it from anywhere) onto the board. */
export const play = mutation({
  args: {
    cardId: v.id("cards"),
    x: v.number(),
    y: v.number(),
    faceUp: v.boolean(),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null) return;
    await ctx.db.patch(args.cardId, {
      zone: "board",
      ownerId: undefined,
      x: Math.min(1, Math.max(0, args.x)),
      y: Math.min(1, Math.max(0, args.y)),
      z: await nextBoardZ(ctx, card.tableId),
      faceUp: args.faceUp,
    });
  },
});

/** Draw the top card of the stock pile into a hand. */
export const draw = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (player === null) throw new Error("Player not found");

    const stock = await ctx.db
      .query("cards")
      .withIndex("by_table_zone", (q) =>
        q.eq("tableId", player.tableId).eq("zone", "stock"),
      )
      .collect();
    if (stock.length === 0) return null;
    const top = stock.reduce((a, b) => (b.order > a.order ? b : a));

    const handCards = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();
    const end = handCards.reduce((max, c) => Math.max(max, c.order), -1) + 1;

    await ctx.db.patch(top._id, {
      zone: "hand",
      ownerId: args.playerId,
      order: end,
      faceUp: true,
    });
    return top._id;
  },
});

/** Take the top card of the burn pile into a hand. */
export const takeBurn = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (player === null) throw new Error("Player not found");

    const burn = await ctx.db
      .query("cards")
      .withIndex("by_table_zone", (q) =>
        q.eq("tableId", player.tableId).eq("zone", "burn"),
      )
      .collect();
    if (burn.length === 0) return null;
    const top = burn.reduce((a, b) => (b.order > a.order ? b : a));

    const handCards = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();
    const end = handCards.reduce((max, c) => Math.max(max, c.order), -1) + 1;

    await ctx.db.patch(top._id, {
      zone: "hand",
      ownerId: args.playerId,
      order: end,
      faceUp: true,
    });
    return top._id;
  },
});

/** Discard a card (from hand or board) onto the burn pile. */
export const burn = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null) return;
    const pile = await ctx.db
      .query("cards")
      .withIndex("by_table_zone", (q) =>
        q.eq("tableId", card.tableId).eq("zone", "burn"),
      )
      .collect();
    const top = pile.reduce((max, c) => Math.max(max, c.order), -1) + 1;
    await ctx.db.patch(args.cardId, {
      zone: "burn",
      ownerId: undefined,
      order: top,
      faceUp: true,
    });
  },
});

/** Drag a card that lies on the board. */
export const moveOnBoard = mutation({
  args: { cardId: v.id("cards"), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null || card.zone !== "board") return;
    await ctx.db.patch(args.cardId, {
      x: Math.min(1, Math.max(0, args.x)),
      y: Math.min(1, Math.max(0, args.y)),
      z: await nextBoardZ(ctx, card.tableId),
    });
  },
});

export const flip = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null) return;
    await ctx.db.patch(args.cardId, { faceUp: !card.faceUp });
  },
});

/** Pick a board card up into a hand. */
export const pickUp = mutation({
  args: { cardId: v.id("cards"), playerId: v.id("players") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null || card.zone !== "board") return;
    const handCards = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();
    const end = handCards.reduce((max, c) => Math.max(max, c.order), -1) + 1;
    await ctx.db.patch(args.cardId, {
      zone: "hand",
      ownerId: args.playerId,
      order: end,
      faceUp: true,
    });
  },
});
