import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { circlePosition, PLAYER_COLORS } from "./lib/layout";

export const join = mutation({
  args: { tableId: v.id("tables"), name: v.string() },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (table === null) throw new Error("Table not found");

    const players = await ctx.db
      .query("players")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const seat = players.reduce((max, p) => Math.max(max, p.seat), -1) + 1;
    const pos = circlePosition(seat, players.length + 1);

    return await ctx.db.insert("players", {
      tableId: args.tableId,
      name: args.name,
      color: PLAYER_COLORS[seat % PLAYER_COLORS.length]!,
      seat,
      x: pos.x,
      y: pos.y,
    });
  },
});

export const list = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();
    return players.sort((a, b) => a.seat - b.seat);
  },
});

export const get = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playerId);
  },
});

/** Free positioning: the table view can drag players anywhere. */
export const move = mutation({
  args: { playerId: v.id("players"), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      x: Math.min(1, Math.max(0, args.x)),
      y: Math.min(1, Math.max(0, args.y)),
    });
  },
});

/** Snap all players back onto a circle, in seat order. */
export const arrangeCircle = mutation({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const players = (
      await ctx.db
        .query("players")
        .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
        .collect()
    ).sort((a, b) => a.seat - b.seat);

    for (let i = 0; i < players.length; i++) {
      const pos = circlePosition(i, players.length);
      await ctx.db.patch(players[i]!._id, { seat: i, x: pos.x, y: pos.y });
    }
  },
});

/** Swap the seat of a player with the neighbour in the given direction. */
export const shiftSeat = mutation({
  args: { playerId: v.id("players"), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (player === null) return;
    const players = (
      await ctx.db
        .query("players")
        .withIndex("by_table", (q) => q.eq("tableId", player.tableId))
        .collect()
    ).sort((a, b) => a.seat - b.seat);
    const index = players.findIndex((p) => p._id === player._id);
    const other = players[index + args.direction];
    if (other === undefined) return;
    await ctx.db.patch(player._id, { seat: other.seat });
    await ctx.db.patch(other._id, { seat: player.seat });
  },
});

/** Remove a player; their hand goes face-down under the stock pile. */
export const leave = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (player === null) return;

    const hand = await ctx.db
      .query("cards")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.playerId))
      .collect();

    const stock = await ctx.db
      .query("cards")
      .withIndex("by_table_zone", (q) =>
        q.eq("tableId", player.tableId).eq("zone", "stock"),
      )
      .collect();

    let bottom = stock.reduce((min, c) => Math.min(min, c.order), 0);
    for (const card of hand) {
      bottom--;
      await ctx.db.patch(card._id, {
        zone: "stock",
        ownerId: undefined,
        order: bottom,
        faceUp: false,
      });
    }

    await ctx.db.delete(args.playerId);
  },
});
