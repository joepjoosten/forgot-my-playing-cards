import type { TableConfig } from "./model";

/**
 * Board geometry shared by rendering, hit-testing and flight animations —
 * one place for every size and position, so a drop ring always matches the
 * spot a flight lands on. All fractions are of the board size; all pixel
 * values take the board width (0 while unmeasured: an 800px board is
 * assumed).
 */

/** Clamp a board-fraction coordinate into [0, 1]. */
export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const CARD_WIDTH_FRACTION = 0.07;

/** Loose/meld card size, growing with the board. */
export const cardSize = (boardWidth: number): { w: number; h: number } => {
  const w = Math.max(48, (boardWidth || 800) * CARD_WIDTH_FRACTION);
  return { w, h: w * 1.4 };
};

/** How far each next card in a meld row is shifted; the rank stays visible. */
export const meldOffset = (boardWidth: number): number =>
  cardSize(boardWidth).w * 0.45;

/** Pile cards grow with the board so they read well on a TV. */
export const pileWidth = (boardWidth: number): number =>
  Math.max(64, Math.min(150, boardWidth * 0.085));

export const pileGap = (boardWidth: number): number =>
  pileWidth(boardWidth) * 0.375;

/** Cards in flight are slightly smaller than the cards on the board. */
export const flightWidth = (boardWidth: number): number =>
  Math.max(52, (boardWidth || 800) * 0.06);

/** Player disks and other chrome scale up with the board (capped for TVs). */
export const boardScale = (boardWidth: number): number =>
  Math.max(1, Math.min(1.7, (boardWidth || 800) / 800));

/** Centre of a pile in pixels: piles sit centred, stock left of burn. */
export const pileCenter = (
  which: "stock" | "burn",
  boardWidth: number,
  boardHeight: number,
  config: Pick<TableConfig, "stockPile" | "burnPile">,
): { x: number; y: number } => {
  const both = config.stockPile && config.burnPile;
  const half = (pileWidth(boardWidth) + pileGap(boardWidth)) / 2;
  const offset = both ? (which === "stock" ? -half : half) : 0;
  return { x: boardWidth / 2 + offset, y: boardHeight / 2 };
};
