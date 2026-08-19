import { internalMutation } from "./_generated/server";

/** How long a table may sit untouched before it is swept away. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Delete tables nobody has used for a day, with everything on them —
 * players, cards, events. Activity is stamped by touchTable (lib/activity);
 * tables from before that field existed fall back to their creation time,
 * so one round of play after deploying starts their clock fresh.
 */
export const staleTables = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const tables = await ctx.db.query("tables").collect();
    for (const table of tables) {
      if ((table.lastActiveAt ?? table._creationTime) > cutoff) continue;
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
