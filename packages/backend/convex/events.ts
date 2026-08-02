import { query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/** The latest table events, newest first (the table animates fresh ones). */
export const recent = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .order("desc")
      .take(15);
  },
});

/** Record an event and prune stale ones so the table never accumulates. */
export const emit = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
  kind: "draw" | "takeBurn",
  playerId: Id<"players">,
): Promise<void> => {
  const now = Date.now();
  const existing = await ctx.db
    .query("events")
    .withIndex("by_table", (q) => q.eq("tableId", tableId))
    .collect();
  for (const event of existing) {
    if (now - event._creationTime > 60_000) {
      await ctx.db.delete(event._id);
    }
  }
  await ctx.db.insert("events", { tableId, kind, playerId });
};

export const clearAll = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
): Promise<void> => {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_table", (q) => q.eq("tableId", tableId))
    .collect();
  for (const event of existing) {
    await ctx.db.delete(event._id);
  }
};
