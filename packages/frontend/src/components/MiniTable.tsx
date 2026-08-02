import { CardView } from "./CardView";
import { t } from "../i18n";
import type { Card, Player, Table } from "../model";

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
}

/**
 * A read-only miniature of the table for a player's phone: same layout as
 * the real board (piles, played cards, players with hand counts), no
 * interaction whatsoever.
 */
export const MiniTable = ({ table, players, cards }: MiniTableProps) => {
  const lang = table.language ?? "en";
  const fourColor = table.config.fourColor === true;

  return (
    <div className="mini-board" aria-hidden="true">
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
          style={{ left: `${card.x * 100}%`, top: `${card.y * 100}%`, zIndex: card.z }}
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
          <span className="mini-player-name">{player.name}</span>
          <span className="mini-player-count" style={{ background: player.color }}>
            {cards.handCounts[player._id] ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
};
