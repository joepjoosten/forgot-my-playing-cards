import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const shuffleKind = v.union(
  v.literal("fisher-yates"),
  v.literal("riffle"),
  v.literal("overhand"),
  v.literal("cut"),
  v.literal("none"),
);

/**
 * A table only knows *how* cards are handled, never the rules of the game:
 * how many decks, how to shuffle, how many cards to deal, and which piles
 * exist on the board (a stock pile to draw from, a burn/discard pile).
 */
export const tableConfig = v.object({
  deckCount: v.number(),
  jokersPerDeck: v.number(),
  shuffle: shuffleKind,
  shufflePasses: v.number(),
  dealPerPlayer: v.number(),
  stockPile: v.boolean(),
  burnPile: v.boolean(),
  playFaceUp: v.boolean(),
  // Render suits in four colors (♥ red, ♦ blue, ♣ green, ♠ black).
  // Optional so tables created before this field existed stay valid.
  fourColor: v.optional(v.boolean()),
  // When false, cards can only be discarded to the burn pile — nothing
  // is played onto the table (defaults to true).
  playToBoard: v.optional(v.boolean()),
});

export const language = v.union(v.literal("en"), v.literal("nl"));

export default defineSchema({
  tables: defineTable({
    name: v.string(),
    status: v.union(v.literal("lobby"), v.literal("playing")),
    config: tableConfig,
    round: v.number(),
    // Optional so tables created before this field existed stay valid.
    language: v.optional(language),
    // Short human-typeable join code (5 chars, unambiguous alphabet).
    code: v.optional(v.string()),
  }).index("by_code", ["code"]),

  players: defineTable({
    tableId: v.id("tables"),
    name: v.string(),
    color: v.string(),
    seat: v.number(),
    // Position of the player around the board, as fractions of the board size.
    x: v.number(),
    y: v.number(),
  }).index("by_table", ["tableId"]),

  /** Short-lived notifications so the table can animate what just
   * happened (e.g. a card flying between a pile and a player). */
  events: defineTable({
    tableId: v.id("tables"),
    kind: v.union(
      v.literal("draw"),
      v.literal("takeBurn"),
      v.literal("play"),
      v.literal("burn"),
    ),
    playerId: v.id("players"),
    // For "play": which card and where it landed on the board.
    cardId: v.optional(v.id("cards")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  }).index("by_table", ["tableId"]),

  cards: defineTable({
    tableId: v.id("tables"),
    deck: v.number(),
    rank: v.string(),
    suit: v.string(),
    zone: v.union(
      v.literal("stock"),
      v.literal("hand"),
      v.literal("board"),
      v.literal("burn"),
    ),
    ownerId: v.optional(v.id("players")),
    // Order inside an ordered zone (stock/burn: bottom -> top, hand: left -> right).
    order: v.number(),
    // Position on the board, as fractions of the board size.
    x: v.number(),
    y: v.number(),
    z: v.number(),
    faceUp: v.boolean(),
  })
    .index("by_table", ["tableId"])
    .index("by_table_zone", ["tableId", "zone"])
    .index("by_owner", ["ownerId"]),
});
