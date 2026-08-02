import { useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convexQuery, run } from "../convex";
import { absoluteLink } from "../route";
import { CardView } from "./CardView";
import { QRCode } from "./QRCode";
import type { Card, CardId, Player, PlayerId, TableId } from "../model";

const CARD_WIDTH_FRACTION = 0.07;

interface Drag {
  kind: "card" | "player";
  id: string;
  x: number;
  y: number;
  moved: boolean;
}

export const TableView = ({ tableId }: { tableId: TableId }) => {
  const table = useAtomValue(convexQuery(api.tables.get, { tableId }));
  const players = useAtomValue(convexQuery(api.players.list, { tableId }));
  const cards = useAtomValue(convexQuery(api.cards.forTable, { tableId }));

  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [showQr, setShowQr] = useState(false);

  if (table === undefined || players === undefined || cards === undefined) {
    return <div className="page center">Loading table…</div>;
  }
  if (table === null) {
    return <div className="page center">This table no longer exists.</div>;
  }

  const joinLink = absoluteLink(`/join/${tableId}`);
  const inLobby = table.status === "lobby";

  const toFraction = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect === undefined) return { x: 0.5, y: 0.5 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const startDrag =
    (kind: Drag["kind"], id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const pos = toFraction(e.clientX, e.clientY);
      setDrag({ kind, id, x: pos.x, y: pos.y, moved: false });
    };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const pos = toFraction(e.clientX, e.clientY);
    setDrag({ ...drag, x: pos.x, y: pos.y, moved: true });
  };

  const endDrag = () => {
    if (drag === null) return;
    if (drag.kind === "card") {
      if (drag.moved) {
        void run(api.cards.moveOnBoard, {
          cardId: drag.id as CardId,
          x: drag.x,
          y: drag.y,
        });
      } else {
        // A tap on a board card flips it over.
        void run(api.cards.flip, { cardId: drag.id as CardId });
      }
    } else if (drag.moved) {
      void run(api.players.move, {
        playerId: drag.id as PlayerId,
        x: drag.x,
        y: drag.y,
      });
    }
    setDrag(null);
  };

  const dragPosition = (kind: Drag["kind"], id: string, x: number, y: number) =>
    drag !== null && drag.kind === kind && drag.id === id
      ? { x: drag.x, y: drag.y }
      : { x, y };

  return (
    <div className="table-page">
      <header className="table-header">
        <h1>🃏 {table.name}</h1>
        <div className="table-actions">
          <button
            className="btn"
            onClick={() => void run(api.tables.startRound, { tableId })}
            disabled={players.length === 0}
          >
            {inLobby ? "Start round" : `New round (${table.round})`}
          </button>
          {table.config.burnPile && !inLobby && (
            <button
              className="btn"
              onClick={() => void run(api.tables.gatherBoard, { tableId, to: "burn" })}
            >
              Gather → burn
            </button>
          )}
          {table.config.stockPile && !inLobby && (
            <button
              className="btn"
              onClick={() => void run(api.tables.gatherBoard, { tableId, to: "stock" })}
            >
              Gather → stock
            </button>
          )}
          <button
            className="btn"
            onClick={() => void run(api.players.arrangeCircle, { tableId })}
          >
            Circle
          </button>
          <button className="btn" onClick={() => setShowQr((s) => !s)}>
            QR
          </button>
        </div>
      </header>

      <div className="board-wrap">
        <div className="board" ref={boardRef}>
          {/* piles */}
          <div className="piles">
            {table.config.stockPile && (
              <div className="pile">
                {cards.stockCount > 0 ? (
                  <CardView rank="" suit="" faceUp={false} width={64} />
                ) : (
                  <div className="pile-empty" />
                )}
                <span className="pile-label">Stock · {cards.stockCount}</span>
              </div>
            )}
            {table.config.burnPile && (
              <div className="pile">
                {cards.burnTop !== null ? (
                  <CardView
                    rank={cards.burnTop.rank}
                    suit={cards.burnTop.suit}
                    faceUp={cards.burnTop.faceUp}
                    width={64}
                  />
                ) : (
                  <div className="pile-empty" />
                )}
                <span className="pile-label">Burn · {cards.burnCount}</span>
              </div>
            )}
          </div>

          {/* board cards */}
          {cards.board.map((card: Card) => {
            const pos = dragPosition("card", card._id, card.x, card.y);
            return (
              <div
                key={card._id}
                className="board-card"
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  zIndex:
                    drag?.kind === "card" && drag.id === card._id ? 1000 : card.z,
                }}
                onPointerDown={startDrag("card", card._id)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <CardView
                  rank={card.rank}
                  suit={card.suit}
                  faceUp={card.faceUp}
                  width={Math.max(
                    48,
                    (boardRef.current?.clientWidth ?? 800) * CARD_WIDTH_FRACTION,
                  )}
                />
              </div>
            );
          })}

          {/* players */}
          {players.map((player: Player) => {
            const pos = dragPosition("player", player._id, player.x, player.y);
            return (
              <div
                key={player._id}
                className="player-disk"
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  borderColor: player.color,
                }}
                onPointerDown={startDrag("player", player._id)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <span className="player-name">{player.name}</span>
                <span className="player-count" style={{ background: player.color }}>
                  {cards.handCounts[player._id] ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(inLobby || showQr) && (
        <div className="lobby-overlay" onClick={() => !inLobby && setShowQr(false)}>
          <div className="lobby-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Scan to join</h2>
            <QRCode text={joinLink} size={240} />
            <a className="join-link" href={joinLink} target="_blank" rel="noreferrer">
              {joinLink}
            </a>
            <div className="lobby-players">
              {players.length === 0 && <p>Waiting for players…</p>}
              {players.map((p: Player) => (
                <span key={p._id} className="lobby-player" style={{ background: p.color }}>
                  {p.name}
                </span>
              ))}
            </div>
            {inLobby ? (
              <button
                className="btn btn-primary btn-big"
                disabled={players.length === 0}
                onClick={() => void run(api.tables.startRound, { tableId })}
              >
                Deal & start
              </button>
            ) : (
              <button className="btn btn-big" onClick={() => setShowQr(false)}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
