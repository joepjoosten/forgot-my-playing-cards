import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { emit } from "./events";

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

/** All board cards of one group, in slot order. */
const groupMembers = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
  groupId: string,
): Promise<Array<Doc<"cards">>> => {
  const board = await ctx.db
    .query("cards")
    .withIndex("by_table_zone", (q) => q.eq("tableId", tableId).eq("zone", "board"))
    .collect();
  return board
    .filter((c) => c.groupId === groupId)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
};

/**
 * Take a card out of its group (because it moves elsewhere): the remaining
 * members close ranks, and a group of one dissolves into a loose card.
 */
const leaveGroup = async (ctx: MutationCtx, card: Doc<"cards">): Promise<void> => {
  if (card.groupId === undefined) return;
  const rest = (await groupMembers(ctx, card.tableId, card.groupId)).filter(
    (c) => c._id !== card._id,
  );
  if (rest.length <= 1) {
    for (const c of rest) {
      await ctx.db.patch(c._id, { groupId: undefined, slot: undefined });
    }
    return;
  }
  for (let i = 0; i < rest.length; i++) {
    if (rest[i]!.slot !== i) await ctx.db.patch(rest[i]!._id, { slot: i });
  }
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
    const x = Math.min(1, Math.max(0, args.x));
    const y = Math.min(1, Math.max(0, args.y));
    const thrownBy = card.zone === "hand" ? card.ownerId : undefined;
    await leaveGroup(ctx, card);
    await ctx.db.patch(args.cardId, {
      zone: "board",
      ownerId: undefined,
      groupId: undefined,
      slot: undefined,
      x,
      y,
      z: await nextBoardZ(ctx, card.tableId),
      faceUp: args.faceUp,
    });
    if (thrownBy !== undefined) {
      await emit(ctx, card.tableId, "play", thrownBy, {
        cardId: card._id,
        x,
        y,
      });
    }
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
    await emit(ctx, player.tableId, "draw", args.playerId);
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
    await emit(ctx, player.tableId, "takeBurn", args.playerId);
    return top._id;
  },
});

/** Discard a card (from hand or board) onto the burn pile. */
export const burn = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null) return;
    const discardedBy = card.zone === "hand" ? card.ownerId : undefined;
    const pile = await ctx.db
      .query("cards")
      .withIndex("by_table_zone", (q) =>
        q.eq("tableId", card.tableId).eq("zone", "burn"),
      )
      .collect();
    const top = pile.reduce((max, c) => Math.max(max, c.order), -1) + 1;
    await leaveGroup(ctx, card);
    await ctx.db.patch(args.cardId, {
      zone: "burn",
      ownerId: undefined,
      groupId: undefined,
      slot: undefined,
      order: top,
      faceUp: true,
    });
    if (discardedBy !== undefined) {
      await emit(ctx, card.tableId, "burn", discardedBy);
    }
  },
});

/** Drag a card that lies on the board (out of its group, if it was in one). */
export const moveOnBoard = mutation({
  args: { cardId: v.id("cards"), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null || card.zone !== "board") return;
    await leaveGroup(ctx, card);
    await ctx.db.patch(args.cardId, {
      groupId: undefined,
      slot: undefined,
      x: Math.min(1, Math.max(0, args.x)),
      y: Math.min(1, Math.max(0, args.y)),
      z: await nextBoardZ(ctx, card.tableId),
    });
  },
});

/** Drag a whole group (a meld row) across the board by its handle. */
export const moveGroup = mutation({
  args: {
    tableId: v.id("tables"),
    groupId: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const members = await groupMembers(ctx, args.tableId, args.groupId);
    if (members.length === 0) return;
    const x = Math.min(1, Math.max(0, args.x));
    const y = Math.min(1, Math.max(0, args.y));
    let z = await nextBoardZ(ctx, args.tableId);
    for (const card of members) {
      await ctx.db.patch(card._id, { x, y, z: z++ });
    }
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

/** Pick a board card up into a hand (taking a misplayed card back). */
export const pickUp = mutation({
  args: { cardId: v.id("cards"), playerId: v.id("players") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null || card.zone !== "board") return;
    await leaveGroup(ctx, card);
    const handCards = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();
    const end = handCards.reduce((max, c) => Math.max(max, c.order), -1) + 1;
    await ctx.db.patch(args.cardId, {
      zone: "hand",
      ownerId: args.playerId,
      groupId: undefined,
      slot: undefined,
      order: end,
      faceUp: true,
    });
    // The card's board position is where the pick-up animation starts; the
    // card id lets the screen that caused the pick-up skip the redundant
    // animation (it already showed the card being dragged there).
    await emit(ctx, card.tableId, "pickUp", args.playerId, {
      cardId: card._id,
      x: card.x,
      y: card.y,
    });
  },
});

/**
 * Play several hand cards at once as one group (a meld row) on the board.
 * The platform doesn't care whether they form a valid set — it just keeps
 * them physically together, like cards slid into a row on a real table.
 */
export const playMany = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    x: v.number(),
    y: v.number(),
    faceUp: v.boolean(),
  },
  handler: async (ctx, args) => {
    const first = args.cardIds[0] === undefined ? null : await ctx.db.get(args.cardIds[0]);
    if (first === null) return;
    const x = Math.min(1, Math.max(0, args.x));
    const y = Math.min(1, Math.max(0, args.y));
    const thrownBy = first.zone === "hand" ? first.ownerId : undefined;
    // A single card doesn't need a group; two or more become a row.
    const groupId = args.cardIds.length > 1 ? `${args.cardIds[0]}:${Date.now()}` : undefined;
    let z = await nextBoardZ(ctx, first.tableId);
    let slot = 0;
    const played: Array<Id<"cards">> = [];
    for (const cardId of args.cardIds) {
      const card = await ctx.db.get(cardId);
      if (card === null || card.tableId !== first.tableId) continue;
      await leaveGroup(ctx, card);
      await ctx.db.patch(cardId, {
        zone: "board",
        ownerId: undefined,
        groupId,
        slot: groupId === undefined ? undefined : slot++,
        x,
        y,
        z: z++,
        faceUp: args.faceUp,
      });
      played.push(cardId);
    }
    if (thrownBy !== undefined) {
      await emit(ctx, first.tableId, "play", thrownBy, {
        cardId: first._id,
        cardIds: played,
        slotStart: 0,
        x,
        y,
      });
    }
  },
});

/**
 * Append cards to the end of an existing group's row. Emits one play event
 * when any of them came from a hand, so the table animates the move.
 */
const appendToGroup = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
  groupId: string,
  cardIds: ReadonlyArray<Id<"cards">>,
): Promise<void> => {
  const row = (await groupMembers(ctx, tableId, groupId)).filter(
    (c) => !cardIds.some((id) => id === c._id),
  );
  if (row.length === 0) return;
  const origin = row[0]!;
  // Close any slot gaps left by cards that are about to move — including a
  // card being re-appended to its own row.
  for (let i = 0; i < row.length; i++) {
    if (row[i]!.slot !== i) await ctx.db.patch(row[i]!._id, { slot: i });
  }
  let slot = row.length;
  const slotStart = slot;
  let z = await nextBoardZ(ctx, tableId);
  let fromHand: Id<"players"> | undefined;
  const appended: Array<Id<"cards">> = [];
  for (const cardId of cardIds) {
    const card = await ctx.db.get(cardId);
    if (card === null || card.tableId !== tableId) continue;
    if (card.zone === "hand" && fromHand === undefined) fromHand = card.ownerId;
    // Only detach from a *different* group: for a card returning to its own
    // row, the compaction above already closed its gap (and leaveGroup
    // would wrongly dissolve a two-card row).
    if (card.groupId !== groupId) await leaveGroup(ctx, card);
    await ctx.db.patch(cardId, {
      zone: "board",
      ownerId: undefined,
      groupId,
      slot: slot++,
      x: origin.x,
      y: origin.y,
      z: z++,
      faceUp: card.zone === "hand" ? true : card.faceUp,
    });
    appended.push(cardId);
  }
  if (fromHand !== undefined && appended.length > 0) {
    await emit(ctx, tableId, "play", fromHand, {
      cardId: appended[0],
      cardIds: appended,
      slotStart,
      x: origin.x,
      y: origin.y,
    });
  }
};

/** Slide cards (from a hand or the board) into an existing group's row. */
export const addToGroup = mutation({
  args: { cardIds: v.array(v.id("cards")), groupId: v.string() },
  handler: async (ctx, args) => {
    const first =
      args.cardIds[0] === undefined ? null : await ctx.db.get(args.cardIds[0]);
    if (first === null) return;
    await appendToGroup(ctx, first.tableId, args.groupId, args.cardIds);
  },
});

/**
 * Start a new row: a loose board card becomes the head of a fresh group and
 * the given cards slide in behind it. If the target meanwhile sits in a
 * group after all, the cards simply join that group.
 */
export const groupWith = mutation({
  args: { cardIds: v.array(v.id("cards")), targetCardId: v.id("cards") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetCardId);
    if (target === null || target.zone !== "board") return;
    let groupId = target.groupId;
    if (groupId === undefined) {
      groupId = `${args.targetCardId}:${Date.now()}`;
      await ctx.db.patch(args.targetCardId, { groupId, slot: 0 });
    }
    await appendToGroup(
      ctx,
      target.tableId,
      groupId,
      args.cardIds.filter((id) => id !== args.targetCardId),
    );
  },
});

/** Take the entire burn pile into a hand ("buying the pot"). */
export const takeBurnAll = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (player === null) throw new Error("Player not found");

    const burn = (
      await ctx.db
        .query("cards")
        .withIndex("by_table_zone", (q) =>
          q.eq("tableId", player.tableId).eq("zone", "burn"),
        )
        .collect()
    ).sort((a, b) => a.order - b.order);
    if (burn.length === 0) return null;

    const handCards = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();
    let end = handCards.reduce((max, c) => Math.max(max, c.order), -1) + 1;

    for (const card of burn) {
      await ctx.db.patch(card._id, {
        zone: "hand",
        ownerId: args.playerId,
        order: end++,
        faceUp: true,
      });
    }
    await emit(ctx, player.tableId, "takeBurnAll", args.playerId);
    return burn.length;
  },
});

/**
 * Lay a player's whole hand face-up on the board as one row, next to their
 * seat — e.g. showing leftover cards for counting at the end of a round.
 */
export const revealHand = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (player === null) throw new Error("Player not found");

    const hand = (
      await ctx.db
        .query("cards")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
        .collect()
    )
      .filter((c) => c.zone === "hand")
      .sort((a, b) => a.order - b.order);
    if (hand.length === 0) return;

    // Pull the row a bit toward the board centre so it lands on the felt.
    const x = Math.min(0.85, Math.max(0.1, player.x * 0.7 + 0.15));
    const y = Math.min(0.85, Math.max(0.1, player.y * 0.7 + 0.15));
    const groupId = hand.length > 1 ? `${hand[0]!._id}:${Date.now()}` : undefined;
    let z = await nextBoardZ(ctx, player.tableId);
    for (let i = 0; i < hand.length; i++) {
      await ctx.db.patch(hand[i]!._id, {
        zone: "board",
        ownerId: undefined,
        groupId,
        slot: groupId === undefined ? undefined : i,
        x,
        y,
        z: z++,
        faceUp: true,
      });
    }
    await emit(ctx, player.tableId, "play", args.playerId, {
      cardId: hand[0]!._id,
      cardIds: hand.map((c) => c._id),
      slotStart: 0,
      x,
      y,
    });
  },
});
