import { defaultConfig, type TableConfig } from "./model";
import type { MessageKey } from "./i18n";

/**
 * A preset is just a named bundle of table settings — the "way of playing",
 * never the rules. Picking one fills the create form; everything stays
 * editable afterwards. This is purely a frontend convenience, so adding a
 * preset needs no backend change.
 */
export interface Preset {
  readonly id: string;
  readonly icon: string;
  readonly labelKey: MessageKey;
  readonly config: TableConfig;
}

const preset = (
  id: string,
  icon: string,
  labelKey: MessageKey,
  config: Partial<TableConfig>,
): Preset => ({ id, icon, labelKey, config: { ...defaultConfig, ...config } });

export const presets: ReadonlyArray<Preset> = [
  preset("uno", "🎴", "preset.uno", {
    deckType: "uno",
    dealPerPlayer: 7,
    // Draw pile + one central discard pile; you never scatter on the table.
    stockPile: true,
    burnPile: true,
    playToBoard: false,
  }),
  preset("pesten", "🃏", "preset.pesten", {
    deckCount: 1,
    jokersPerDeck: 2,
    dealPerPlayer: 7,
    // Like UNO: draw pile + discard pile only.
    stockPile: true,
    burnPile: true,
    playToBoard: false,
  }),
  preset("poker", "♠️", "preset.poker", {
    deckCount: 1,
    jokersPerDeck: 0,
    dealPerPlayer: 2,
    // Deck to deal from + community cards on the table; no discard pile.
    stockPile: true,
    burnPile: false,
    playToBoard: true,
    playFaceUp: true,
  }),
  preset("rummy", "🔢", "preset.rummy", {
    deckCount: 2,
    jokersPerDeck: 2,
    dealPerPlayer: 13,
    stockPile: true,
    burnPile: true,
    playToBoard: true,
    playFaceUp: true,
  }),
  preset("duizenden", "💯", "preset.duizenden", {
    // Two full decks with jokers, 13 cards each; one card is flipped open
    // next to the stock, and melds are laid out on the table.
    deckCount: 2,
    jokersPerDeck: 2,
    dealPerPlayer: 13,
    stockPile: true,
    burnPile: true,
    playToBoard: true,
    playFaceUp: true,
    startBurnCount: 1,
  }),
  preset("hearts", "♥️", "preset.hearts", {
    deckCount: 1,
    jokersPerDeck: 0,
    dealPerPlayer: 13,
    // All 52 cards are dealt out, so there is no stock to draw from.
    stockPile: false,
    burnPile: true,
    playToBoard: true,
    playFaceUp: true,
  }),
  preset("gofish", "🐟", "preset.gofish", {
    deckCount: 1,
    jokersPerDeck: 0,
    dealPerPlayer: 5,
    // Draw from the "ocean"; matched sets are laid down, nothing is discarded.
    stockPile: true,
    burnPile: false,
    playToBoard: true,
    playFaceUp: true,
  }),
  preset("free", "🎲", "preset.free", {
    // Sandbox: a full deck, nothing dealt, every option on.
    deckCount: 1,
    jokersPerDeck: 2,
    dealPerPlayer: 0,
    stockPile: true,
    burnPile: true,
    playToBoard: true,
    playFaceUp: true,
  }),
];

/** Which preset (if any) exactly matches a config, so it can be highlighted. */
export const matchingPresetId = (config: TableConfig): string | null => {
  const keys = Object.keys(defaultConfig) as Array<keyof TableConfig>;
  const found = presets.find((p) =>
    keys.every((k) => (p.config[k] ?? undefined) === (config[k] ?? undefined)),
  );
  return found?.id ?? null;
};
