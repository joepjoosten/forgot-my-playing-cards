import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Writes are throttled: a busy table is stamped at most twice an hour. */
const TOUCH_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Stamp a table as recently used, so the daily cleanup (see cleanup.ts)
 * leaves it alone. Called from the mutations that represent someone
 * actually at the table — joining, dealing, playing, moving cards.
 */
export const touchTable = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
): Promise<void> => {
  const table = await ctx.db.get(tableId);
  if (table === null) return;
  const now = Date.now();
  if (now - (table.lastActiveAt ?? 0) >= TOUCH_INTERVAL_MS) {
    await ctx.db.patch(tableId, { lastActiveAt: now });
  }
};
