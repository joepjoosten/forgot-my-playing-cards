import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Zone plumbing shared by every mutation that moves cards around. Each zone
 * is an ordered collection; moving cards means placing them at the top or
 * bottom of the destination's order, with the destination's conventions
 * (ownership, face-up-ness) applied in one place.
 */

export type Zone = Doc<"cards">["zone"];

/** All cards currently in one zone of a table. */
export const zoneCards = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
  zone: Zone,
): Promise<Array<Doc<"cards">>> =>
  await ctx.db
    .query("cards")
    .withIndex("by_table_zone", (q) => q.eq("tableId", tableId).eq("zone", zone))
    .collect();

/** The top card of a pile (highest order), or null when it is empty. */
export const topCard = (pile: ReadonlyArray<Doc<"cards">>): Doc<"cards"> | null =>
  pile.length === 0 ? null : pile.reduce((a, b) => (b.order > a.order ? b : a));

/** The z that puts a card on top of everything lying on the board. */
export const nextBoardZ = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
): Promise<number> => {
  const board = await zoneCards(ctx, tableId, "board");
  return board.reduce((max, c) => Math.max(max, c.z), 0) + 1;
};

/** All board cards of one group, in slot order. */
export const groupMembers = async (
  ctx: MutationCtx,
  tableId: Id<"tables">,
  groupId: string,
): Promise<Array<Doc<"cards">>> => {
  const board = await zoneCards(ctx, tableId, "board");
  return board
    .filter((c) => c.groupId === groupId)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
};

/**
 * Take a card out of its group (because it moves elsewhere): the remaining
 * members close ranks, and a group of one dissolves into a loose card.
 */
export const leaveGroup = async (
  ctx: MutationCtx,
  card: Doc<"cards">,
): Promise<void> => {
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

/**
 * Where cards can be moved to. Board placement is not a destination here:
 * it carries its own richer logic (positions, groups, slots) and lives in
 * the play/group mutations.
 */
export type Destination =
  | { zone: "hand"; playerId: Id<"players"> }
  | { zone: "burn" }
  | { zone: "stock"; at: "top" | "bottom" };

/**
 * Move cards into a hand or onto a pile, keeping the given sequence.
 * Hands and pile tops grow upward from the current top; the stock bottom
 * grows downward (those cards get drawn last). Hand and burn cards turn
 * face up, stock cards face down; ownership and any board grouping are
 * cleared (with the card's old group closing ranks).
 */
export const moveCards = async (
  ctx: MutationCtx,
  cards: ReadonlyArray<Doc<"cards">>,
  dest: Destination,
): Promise<void> => {
  if (cards.length === 0) return;
  const existing =
    dest.zone === "hand"
      ? await ctx.db
          .query("cards")
          .withIndex("by_owner", (q) => q.eq("ownerId", dest.playerId))
          .collect()
      : await zoneCards(ctx, cards[0]!.tableId, dest.zone);
  const downward = dest.zone === "stock" && dest.at === "bottom";
  let order = downward
    ? existing.reduce((min, c) => Math.min(min, c.order), 0)
    : existing.reduce((max, c) => Math.max(max, c.order), -1);
  for (const card of cards) {
    order += downward ? -1 : 1;
    await leaveGroup(ctx, card);
    await ctx.db.patch(card._id, {
      zone: dest.zone,
      ownerId: dest.zone === "hand" ? dest.playerId : undefined,
      groupId: undefined,
      slot: undefined,
      order,
      faceUp: dest.zone !== "stock",
    });
  }
};
