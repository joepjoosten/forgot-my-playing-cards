import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/** How long a table may sit untouched before it is swept away. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * When the table was last used, inferred from what is already there — no
 * bookkeeping writes anywhere. Every join inserts a player, every deal
 * recreates all cards, and every hand action (draw, play, burn, take)
 * records an event that survives until the next round clears it; the
 * newest creation time among them is the last meaningful activity.
 * (Actions that create no documents — board drags, turn taps, score
 * edits — leave no trace, but no real session goes a day on those alone.)
 */
const lastActivity = async (
  ctx: MutationCtx,
  table: Doc<"tables">,
): Promise<number> => {
  const newestPlayer = await ctx.db
    .query("players")
    .withIndex("by_table", (q) => q.eq("tableId", table._id))
    .order("desc")
    .first();
  const newestCard = await ctx.db
    .query("cards")
    .withIndex("by_table", (q) => q.eq("tableId", table._id))
    .order("desc")
    .first();
  const newestEvent = await ctx.db
    .query("events")
    .withIndex("by_table", (q) => q.eq("tableId", table._id))
    .order("desc")
    .first();
  return Math.max(
    table._creationTime,
    newestPlayer?._creationTime ?? 0,
    newestCard?._creationTime ?? 0,
    newestEvent?._creationTime ?? 0,
  );
};

/**
 * Delete tables nobody has used for a day, with everything on them —
 * players, cards, events.
 */
export const staleTables = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const tables = await ctx.db.query("tables").collect();
    for (const table of tables) {
      if ((await lastActivity(ctx, table)) > cutoff) continue;
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();
      for (const card of cards) await ctx.db.delete(card._id);
      const players = await ctx.db
        .query("players")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();
      for (const player of players) await ctx.db.delete(player._id);
      const events = await ctx.db
        .query("events")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();
      for (const event of events) await ctx.db.delete(event._id);
      await ctx.db.delete(table._id);
    }
  },
});
