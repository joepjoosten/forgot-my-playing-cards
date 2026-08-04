import { CardView } from "./CardView";
import { t } from "../i18n";
import type { Card, CardId, Player, Table } from "../model";

interface MiniTableProps {
  table: Table;
  players: ReadonlyArray<Player>;
  cards: {
    board: ReadonlyArray<Card>;
    stockCount: number;
    burnCount: number;
    burnTop: Card | null;
    handCounts: Record<string, number>;
  };
  /**
   * When set, the mini table becomes a tap target for the player's current
   * hand selection: tap a meld row to add the cards to it, tap a loose card
   * to start a new row with it, tap empty felt to lay them down there.
   */
  targeting?: {
    onPlayAt: (x: number, y: number) => void;
    onAddToGroup: (groupId: string) => void;
    onGroupWith: (cardId: CardId) => void;
  };
}

/**
 * A miniature of the table for a player's phone: same layout as the real
 * board (piles, played cards, players with hand counts). Read-only, unless
 * `targeting` arms it as a drop target for the selected hand cards.
 */
export const MiniTable = ({ table, players, cards, targeting }: MiniTableProps) => {
  const lang = table.language ?? "en";
  const fourColor = table.config.fourColor === true;

  const onFeltClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (targeting === undefined) return;
    const rect = e.currentTarget.getBoundingClientRect();
    targeting.onPlayAt(
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    );
  };

  return (
    <div
      className={`mini-board${targeting === undefined ? "" : " mini-board-armed"}`}
      aria-hidden={targeting === undefined}
      onClick={onFeltClick}
    >
      <div className="mini-piles">
        {table.config.stockPile && (
          <div className="mini-pile">
            {cards.stockCount > 0 ? (
              <CardView rank="" suit="" faceUp={false} width={34} />
            ) : (
              <div className="mini-pile-empty" />
            )}
            <span>
              {t(lang, "table.stock")} · {cards.stockCount}
            </span>
          </div>
        )}
        {table.config.burnPile && (
          <div className="mini-pile">
            {cards.burnTop !== null ? (
              <CardView
                rank={cards.burnTop.rank}
                suit={cards.burnTop.suit}
                faceUp={cards.burnTop.faceUp}
                width={34}
                fourColor={fourColor}
              />
            ) : (
              <div className="mini-pile-empty" />
            )}
            <span>
              {t(lang, "table.burn")} · {cards.burnCount}
            </span>
          </div>
        )}
      </div>

      {cards.board.map((card) => (
        <div
          key={card._id}
          className="mini-card"
          style={{
            // Grouped cards (meld rows) share an origin and fan out by slot.
            left: `calc(${card.x * 100}% + ${(card.slot ?? 0) * 13}px)`,
            top: `${card.y * 100}%`,
            zIndex: card.z,
          }}
          onClick={
            targeting === undefined
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  if (card.groupId !== undefined) targeting.onAddToGroup(card.groupId);
                  else targeting.onGroupWith(card._id as CardId);
                }
          }
        >
          <CardView
            rank={card.rank}
            suit={card.suit}
            faceUp={card.faceUp}
            width={30}
            fourColor={fourColor}
          />
        </div>
      ))}

      {players.map((player) => (
        <div
          key={player._id}
          className="mini-player"
          style={{
            left: `${player.x * 100}%`,
            top: `${player.y * 100}%`,
            borderColor: player.color,
          }}
        >
          <span className="mini-player-name">
            {table.turnPlayerId === player._id ? "▶ " : ""}
            {table.dealerPlayerId === player._id ? "Ⓓ " : ""}
            {player.name}
            {player.score !== undefined ? ` · ${player.score}` : ""}
          </span>
          <span className="mini-player-count" style={{ background: player.color }}>
            {cards.handCounts[player._id] ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
};
