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
export const deckType = v.union(v.literal("standard"), v.literal("uno"));

export const tableConfig = v.object({
  // Which card set to build. Optional so tables created before this field
  // existed keep working (they are treated as "standard").
  deckType: v.optional(deckType),
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
  // How many cards are flipped face-up onto the burn pile right after the
  // deal (the "open card" many games start with). Defaults to 0.
  startBurnCount: v.optional(v.number()),
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
    // A purely visual turn marker the table can pass around; the platform
    // never enforces whose turn it is.
    turnPlayerId: v.optional(v.id("players")),
  }).index("by_code", ["code"]),

  players: defineTable({
    tableId: v.id("tables"),
    name: v.string(),
    color: v.string(),
    seat: v.number(),
    // Position of the player around the board, as fractions of the board size.
    x: v.number(),
    y: v.number(),
    // Running total on the scoreboard; entered by the players themselves,
    // the platform never computes it.
    score: v.optional(v.number()),
  }).index("by_table", ["tableId"]),

  /** Short-lived notifications so the table can animate what just
   * happened (e.g. a card flying between a pile and a player). */
  events: defineTable({
    tableId: v.id("tables"),
    kind: v.union(
      v.literal("draw"),
      v.literal("takeBurn"),
      v.literal("takeBurnAll"),
      v.literal("play"),
      v.literal("burn"),
      v.literal("pickUp"),
    ),
    playerId: v.id("players"),
    // For "play": which card and where it landed on the board.
    cardId: v.optional(v.id("cards")),
    // A multi-card play (a set): every card gets its own flight, landing
    // fanned out from slotStart onwards.
    cardIds: v.optional(v.array(v.id("cards"))),
    slotStart: v.optional(v.number()),
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
    // Board cards can sit in a named group (a meld / row laid on the table):
    // members share the group's x/y origin and are fanned out by slot.
    groupId: v.optional(v.string()),
    slot: v.optional(v.number()),
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
