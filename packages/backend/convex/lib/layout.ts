/** Positions for players arranged in a circle around the board. */
export const circlePosition = (
  seat: number,
  playerCount: number,
): { x: number; y: number } => {
  const angle = (seat / Math.max(1, playerCount)) * Math.PI * 2 + Math.PI / 2;
  return {
    x: 0.5 + 0.42 * Math.cos(angle),
    y: 0.5 + 0.4 * Math.sin(angle),
  };
};

export const PLAYER_COLORS = [
  "#e6533c",
  "#3c82e6",
  "#3ce67a",
  "#e6c53c",
  "#a03ce6",
  "#e63cb8",
  "#3ce6d4",
  "#e6823c",
];
