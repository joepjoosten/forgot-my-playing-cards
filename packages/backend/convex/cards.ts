import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { emit } from "./events";
import { clamp01 } from "./lib/layout";
import {
  groupMembers,
  leaveGroup,
  moveCards,
  nextBoardZ,
  topCard,
  zoneCards,
} from "./lib/zones";

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
    const x = clamp01(args.x);
    const y = clamp01(args.y);
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

/** Move the top card of a pile into a hand (drawing / taking the burn). */
const takeTopInto = async (
  ctx: MutationCtx,
  playerId: Id<"players">,
  from: "stock" | "burn",
  kind: "draw" | "takeBurn",
): Promise<Id<"cards"> | null> => {
  const player = await ctx.db.get(playerId);
  if (player === null) throw new Error("Player not found");
  const top = topCard(await zoneCards(ctx, player.tableId, from));
  if (top === null) return null;
  await moveCards(ctx, [top], { zone: "hand", playerId });
  await emit(ctx, player.tableId, kind, playerId);
  return top._id;
};

/** Draw the top card of the stock pile into a hand. */
export const draw = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => takeTopInto(ctx, args.playerId, "stock", "draw"),
});

/** Take the top card of the burn pile into a hand. */
export const takeBurn = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) =>
    takeTopInto(ctx, args.playerId, "burn", "takeBurn"),
});

/** Discard a card (from hand or board) onto the burn pile. */
export const burn = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null) return;
    const discardedBy = card.zone === "hand" ? card.ownerId : undefined;
    await moveCards(ctx, [card], { zone: "burn" });
    if (discardedBy !== undefined) {
      await emit(ctx, card.tableId, "burn", discardedBy);
    }
  },
});

/** Put a card (from hand or board) back on top of the stock pile, face down. */
export const toStock = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (card === null) return;
    await moveCards(ctx, [card], { zone: "stock", at: "top" });
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
      x: clamp01(args.x),
      y: clamp01(args.y),
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
    const x = clamp01(args.x);
    const y = clamp01(args.y);
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
    await moveCards(ctx, [card], { zone: "hand", playerId: args.playerId });
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
    const x = clamp01(args.x);
    const y = clamp01(args.y);
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

    const burnPile = (await zoneCards(ctx, player.tableId, "burn")).sort(
      (a, b) => a.order - b.order,
    );
    if (burnPile.length === 0) return null;

    await moveCards(ctx, burnPile, { zone: "hand", playerId: args.playerId });
    await emit(ctx, player.tableId, "takeBurnAll", args.playerId);
    return burnPile.length;
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
