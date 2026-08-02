import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convexQuery, run } from "../convex";
import { absoluteLink } from "../route";
import { CardView } from "./CardView";
import { QRCode } from "./QRCode";
import { detectLanguage, languages, t, type Language } from "../i18n";
import type { Card, CardId, Player, PlayerId, TableId } from "../model";

const CARD_WIDTH_FRACTION = 0.07;

interface Drag {
  kind: "card" | "player";
  id: string;
  x: number;
  y: number;
  moved: boolean;
}

interface Flight {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** A card back flying across the board (e.g. stock pile → drawing player). */
const FlyingCard = ({ flight }: { flight: Flight }) => {
  const [pos, setPos] = useState(flight.from);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    // Two frames so the starting position is painted before transitioning.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setPos(flight.to);
        setLanded(true);
      }),
    );
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fly-card${landed ? " fly-card-landed" : ""}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <CardView rank="" suit="" faceUp={false} width={52} />
    </div>
  );
};

export const TableView = ({ tableId }: { tableId: TableId }) => {
  const table = useAtomValue(convexQuery(api.tables.get, { tableId }));
  const players = useAtomValue(convexQuery(api.players.list, { tableId }));
  const cards = useAtomValue(convexQuery(api.cards.forTable, { tableId }));
  const events = useAtomValue(convexQuery(api.events.recent, { tableId }));

  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Dropped positions we still render locally until the server echoes the
  // move back — otherwise the item briefly jumps to its stale position.
  const [pending, setPending] = useState<Record<string, { x: number; y: number }>>({});
  const [showQr, setShowQr] = useState(false);
  const [flights, setFlights] = useState<Array<Flight>>([]);
  // null until the first events payload arrives — everything already in it
  // predates this screen, so it is marked seen without animating.
  const seenEvents = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (events === undefined) return;
    if (seenEvents.current === null) {
      seenEvents.current = new Set(events.map((e) => e._id));
      return;
    }
    const seen = seenEvents.current;
    const rect = boardRef.current?.getBoundingClientRect();
    for (const event of events) {
      if (seen.has(event._id)) continue;
      seen.add(event._id);
      if (rect === undefined || players === undefined || table === null || table === undefined) continue;
      if (Date.now() - event._creationTime > 10_000) continue;
      const target = players.find((p) => p._id === event.playerId);
      if (target === undefined) continue;

      // Pile origin: piles sit centred on the board, stock left of burn.
      const bothPiles = table.config.stockPile && table.config.burnPile;
      const offset = bothPiles ? (event.kind === "draw" ? -44 : 44) : 0;
      const flight: Flight = {
        id: event._id,
        from: { x: rect.width / 2 + offset, y: rect.height / 2 },
        to: { x: target.x * rect.width, y: target.y * rect.height },
      };
      setFlights((current) => [...current, flight]);
      setTimeout(() => {
        setFlights((current) => current.filter((f) => f.id !== flight.id));
      }, 1000);
    }
  }, [events, players, table]);

  if (table === undefined || players === undefined || cards === undefined) {
    return <div className="page center">{t(detectLanguage(), "table.loading")}</div>;
  }
  if (table === null) {
    return <div className="page center">{t(detectLanguage(), "table.gone")}</div>;
  }

  const lang = table.language ?? "en";
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

  const moveWithOverride = (
    id: string,
    x: number,
    y: number,
    mutate: () => Promise<unknown>,
  ) => {
    setPending((p) => ({ ...p, [id]: { x, y } }));
    // Convex resolves a mutation only after our subscriptions reflect the
    // write, so dropping the override here can't flash the old position.
    void mutate().finally(() => {
      setPending(({ [id]: _dropped, ...rest }) => rest);
    });
  };

  const endDrag = () => {
    if (drag === null) return;
    if (drag.kind === "card") {
      if (drag.moved) {
        moveWithOverride(drag.id, drag.x, drag.y, () =>
          run(api.cards.moveOnBoard, {
            cardId: drag.id as CardId,
            x: drag.x,
            y: drag.y,
          }),
        );
      } else {
        // A tap on a board card flips it over.
        void run(api.cards.flip, { cardId: drag.id as CardId });
      }
    } else if (drag.moved) {
      moveWithOverride(drag.id, drag.x, drag.y, () =>
        run(api.players.move, {
          playerId: drag.id as PlayerId,
          x: drag.x,
          y: drag.y,
        }),
      );
    }
    setDrag(null);
  };

  const dragPosition = (kind: Drag["kind"], id: string, x: number, y: number) => {
    if (drag !== null && drag.kind === kind && drag.id === id) {
      return { x: drag.x, y: drag.y };
    }
    return pending[id] ?? { x, y };
  };

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
            {inLobby
              ? t(lang, "table.startRound")
              : t(lang, "table.newRound", { round: table.round })}
          </button>
          {table.config.burnPile && !inLobby && (
            <button
              className="btn"
              onClick={() => void run(api.tables.gatherBoard, { tableId, to: "burn" })}
            >
              {t(lang, "table.gatherBurn")}
            </button>
          )}
          {table.config.stockPile && !inLobby && (
            <button
              className="btn"
              onClick={() => void run(api.tables.gatherBoard, { tableId, to: "stock" })}
            >
              {t(lang, "table.gatherStock")}
            </button>
          )}
          <button
            className="btn"
            onClick={() => void run(api.players.arrangeCircle, { tableId })}
          >
            {t(lang, "table.circle")}
          </button>
          <button className="btn" onClick={() => setShowQr((s) => !s)}>
            QR
          </button>
          <select
            className="btn lang-select"
            value={lang}
            onChange={(e) =>
              void run(api.tables.setLanguage, {
                tableId,
                language: e.target.value as Language,
              })
            }
          >
            {languages.map((option) => (
              <option key={option.value} value={option.value}>
                🌐 {option.label}
              </option>
            ))}
          </select>
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
                <span className="pile-label">
                  {t(lang, "table.stock")} · {cards.stockCount}
                </span>
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
                <span className="pile-label">
                  {t(lang, "table.burn")} · {cards.burnCount}
                </span>
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
                    drag?.kind === "card" && drag.id === card._id
                      ? 1000
                      : pending[card._id] !== undefined
                        ? 999
                        : card.z,
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

          {/* draw / take-burn animations */}
          {flights.map((flight) => (
            <FlyingCard key={flight.id} flight={flight} />
          ))}

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
            <h2>{t(lang, "table.scanToJoin")}</h2>
            <QRCode text={joinLink} size={240} />
            <a className="join-link" href={joinLink} target="_blank" rel="noreferrer">
              {joinLink}
            </a>
            <div className="lobby-players">
              {players.length === 0 && <p>{t(lang, "table.waitingForPlayers")}</p>}
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
                {t(lang, "table.dealAndStart")}
              </button>
            ) : (
              <button className="btn btn-big" onClick={() => setShowQr(false)}>
                {t(lang, "table.close")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
