import type { Doc, Id } from "@backend/convex/_generated/dataModel";

export type Table = Doc<"tables">;
export type Player = Doc<"players">;
export type Card = Doc<"cards">;
export type TableConfig = Table["config"];
export type TableId = Id<"tables">;
export type PlayerId = Id<"players">;
export type CardId = Id<"cards">;

export const defaultConfig: TableConfig = {
  deckType: "standard",
  deckCount: 1,
  jokersPerDeck: 0,
  shuffle: "riffle",
  shufflePasses: 7,
  dealPerPlayer: 7,
  stockPile: true,
  burnPile: true,
  playFaceUp: true,
  fourColor: false,
  playToBoard: true,
};

export const storedPlayerKey = (tableId: string) => `fmpc:player:${tableId}`;
