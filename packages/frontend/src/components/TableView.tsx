import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convexQuery, run } from "../convex";
import { absoluteLink } from "../route";
import { CardView, FlipCard } from "./CardView";
import { QRCode } from "./QRCode";
import { fullscreenAvailable, toggleFullscreen } from "../fullscreen";
import { detectLanguage, languages, t, type Language } from "../i18n";
import {
  boardScale,
  cardSize,
  clamp01,
  flightWidth,
  meldOffset,
  pileCenter,
  pileGap,
  pileWidth,
} from "../board";
import { useServerEcho } from "../useServerEcho";
import type { Card, CardId, Player, PlayerId, TableId } from "../model";

/** What is being dragged — the id keeps the type of its kind. */
type DragTarget =
  | { kind: "card"; id: CardId }
  | { kind: "player"; id: PlayerId }
  | { kind: "group"; id: string };

type Drag = DragTarget & {
  /** Position of the dragged object's origin (not the pointer). */
  x: number;
  y: number;
  /** Offset from the pointer to the origin, fixed at drag start, so the
   * object stays anchored where it was grabbed instead of jumping to
   * centre itself under the pointer. */
  offX: number;
  offY: number;
  moved: boolean;
};

/** Where a dragged card would land. */
type DropTarget =
  | { kind: "player"; id: PlayerId }
  | { kind: "pile"; id: "stock" | "burn" }
  | { kind: "group"; id: string }
  | { kind: "card"; id: CardId };

/** A meld row on the board: cards fanned out from a shared origin. */
interface BoardGroup {
  id: string;
  members: Array<Card>;
}

interface Flight {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The board card this flight delivers (play events): it stays hidden
   * until the flight lands, and the flight shows its face. */
  cardId?: string;
  face?: { rank: string; suit: string; faceUp: boolean };
}

/** A card flying across the board (pile ↔ player). */
const FlyingCard = ({
  flight,
  fourColor,
  width,
}: {
  flight: Flight;
  fourColor: boolean;
  width: number;
}) => {
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
      <CardView
        rank={flight.face?.rank ?? ""}
        suit={flight.face?.suit ?? ""}
        faceUp={flight.face?.faceUp ?? false}
        width={width}
        fourColor={fourColor}
      />
    </div>
  );
};

export const TableView = ({ tableId }: { tableId: TableId }) => {
  const table = useAtomValue(convexQuery(api.tables.get, { tableId }));
  const players = useAtomValue(convexQuery(api.players.list, { tableId }));
  const cards = useAtomValue(convexQuery(api.cards.forTable, { tableId }));
  const events = useAtomValue(convexQuery(api.events.recent, { tableId }));

  const boardRef = useRef<HTMLDivElement | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const attachBoard = (el: HTMLDivElement | null) => {
    boardRef.current = el;
    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
    if (el !== null) {
      const observer = new ResizeObserver(() => setBoardWidth(el.clientWidth));
      observer.observe(el);
      resizeObserver.current = observer;
      setBoardWidth(el.clientWidth);
    }
  };
  const [drag, setDrag] = useState<Drag | null>(null);
  // Double-tap detection for flipping a board card over.
  const lastTap = useRef<{ id: string; time: number } | null>(null);
  // Cards this screen dragged onto a player disk: their pickUp event skips
  // the flight animation (the drag itself already showed the move).
  const localPickUps = useRef<Set<string>>(new Set());
  // Dropped positions we still render locally until the server echoes the
  // move back — otherwise the item briefly jumps to its stale position.
  const pending = useServerEcho<{ x: number; y: number }>();
  const [showQr, setShowQr] = useState(false);
  const [showScores, setShowScores] = useState(false);
  // Per-player "points to add" drafts on the score pad.
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
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

      const pilePos = (which: "stock" | "burn") =>
        pileCenter(which, rect.width, rect.height, table.config);
      const playerPos = { x: target.x * rect.width, y: target.y * rect.height };

      const eventFlights: Array<Flight> = [];
      switch (event.kind) {
        case "draw":
          eventFlights.push({ id: event._id, from: pilePos("stock"), to: playerPos });
          break;
        case "takeBurn":
        case "takeBurnAll":
          eventFlights.push({ id: event._id, from: pilePos("burn"), to: playerPos });
          break;
        case "play":
          if (event.x !== undefined && event.y !== undefined) {
            // One flight per played card: a set fans out into its slots.
            const ids =
              event.cardIds ?? (event.cardId === undefined ? [] : [event.cardId]);
            const offset = meldOffset(rect.width);
            const slotStart = event.slotStart ?? 0;
            for (let i = 0; i < ids.length; i++) {
              eventFlights.push({
                id: `${event._id}:${i}`,
                from: playerPos,
                to: {
                  x: event.x * rect.width + (slotStart + i) * offset,
                  y: event.y * rect.height,
                },
                cardId: ids[i],
              });
            }
          }
          break;
        case "burn":
          eventFlights.push({ id: event._id, from: playerPos, to: pilePos("burn") });
          break;
        case "pickUp":
          // A card taken back: it flies from its board spot to the player —
          // unless this screen dragged it there itself.
          if (event.cardId !== undefined && localPickUps.current.has(event.cardId)) {
            localPickUps.current.delete(event.cardId);
            break;
          }
          if (event.x !== undefined && event.y !== undefined) {
            eventFlights.push({
              id: event._id,
              from: { x: event.x * rect.width, y: event.y * rect.height },
              to: playerPos,
            });
          }
          break;
      }
      if (eventFlights.length === 0) continue;

      setFlights((current) => [...current, ...eventFlights]);
      // Play flights end exactly when the transition lands, so the real
      // board cards (hidden while in flight) appear at the landing moment.
      setTimeout(
        () => {
          setFlights((current) =>
            current.filter((f) => !eventFlights.some((done) => done.id === f.id)),
          );
        },
        event.kind === "play" ? 700 : 1000,
      );
    }
  }, [events, players, table]);

  if (table === undefined || players === undefined || cards === undefined) {
    return <div className="page center">{t(detectLanguage(), "table.loading")}</div>;
  }
  if (table === null) {
    return <div className="page center">{t(detectLanguage(), "table.gone")}</div>;
  }

  const lang = table.language ?? "en";
  const fourColor = table.config.fourColor === true;
  const canPlayToBoard = table.config.playToBoard !== false;
  const joinLink = absoluteLink(`/join/${tableId}`);
  const inLobby = table.status === "lobby";

  const { w: cardW, h: cardH } = cardSize(boardWidth);
  const groupOffset = meldOffset(boardWidth);

  // Split the board into loose cards and meld rows (groups).
  const loose: Array<Card> = [];
  const byGroup = new Map<string, Array<Card>>();
  for (const card of cards.board) {
    if (card.groupId === undefined) {
      loose.push(card);
    } else {
      const members = byGroup.get(card.groupId);
      if (members === undefined) byGroup.set(card.groupId, [card]);
      else members.push(card);
    }
  }
  const groups: Array<BoardGroup> = [...byGroup.entries()].map(([id, members]) => ({
    id,
    members: members.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
  }));

  // A grouped card being dragged — or pinned at its drop point while the
  // server processes the move — leaves its row visually and renders as a
  // loose card in the meantime.
  const liftedGroupCards = cards.board.filter(
    (c) =>
      c.groupId !== undefined &&
      (pending.get(c._id) !== undefined ||
        (drag !== null && drag.kind === "card" && drag.moved && drag.id === c._id)),
  );

  /** The group whose row (plus a small margin) contains the given board point. */
  const groupAt = (fx: number, fy: number): BoardGroup | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect === undefined) return null;
    const px = fx * rect.width;
    const py = fy * rect.height;
    for (const group of groups) {
      const origin = group.members[0]!;
      const left = origin.x * rect.width - cardW / 2 - 10;
      const top = origin.y * rect.height - cardH / 2 - 26;
      const width = cardW + (group.members.length - 1) * groupOffset + 20;
      const height = cardH + 36;
      if (px >= left && px <= left + width && py >= top && py <= top + height) {
        return group;
      }
    }
    return null;
  };

  /** The player whose disk contains the given board point (to hand a card back). */
  const playerAt = (fx: number, fy: number): Player | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect === undefined) return null;
    const scale = boardScale(boardWidth);
    const px = fx * rect.width;
    const py = fy * rect.height;
    for (const player of players) {
      if (
        Math.abs(px - player.x * rect.width) <= 55 * scale &&
        Math.abs(py - player.y * rect.height) <= 40 * scale
      ) {
        return player;
      }
    }
    return null;
  };

  /** The topmost loose card under the given board point (to start a row). */
  const looseCardAt = (fx: number, fy: number, excludeId: string): Card | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect === undefined) return null;
    const px = fx * rect.width;
    const py = fy * rect.height;
    const hits = loose.filter(
      (card) =>
        card._id !== excludeId &&
        Math.abs(px - card.x * rect.width) <= cardW / 2 + 6 &&
        Math.abs(py - card.y * rect.height) <= cardH / 2 + 6,
    );
    if (hits.length === 0) return null;
    return hits.reduce((a, b) => (b.z > a.z ? b : a));
  };

  /** The pile (stock or burn) whose card area contains the given board point. */
  const pileAt = (fx: number, fy: number): "stock" | "burn" | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect === undefined) return null;
    const px = fx * rect.width;
    const py = fy * rect.height;
    const w = pileWidth(rect.width);
    const hit = (which: "stock" | "burn") => {
      const c = pileCenter(which, rect.width, rect.height, table.config);
      return Math.abs(px - c.x) <= w / 2 + 8 && Math.abs(py - c.y) <= (w * 1.4) / 2 + 8;
    };
    if (table.config.stockPile && hit("stock")) return "stock";
    if (table.config.burnPile && hit("burn")) return "burn";
    return null;
  };

  /**
   * Where the dragged card would land right now — the ring shown while
   * dragging and the action taken on drop both come from this one value,
   * so what the user sees is always what they get. Priority: player disk,
   * pile (burn or back onto the stock), meld row (its own row included:
   * the card returns to the end of it), loose card.
   */
  const dropTarget: DropTarget | null =
    drag !== null && drag.kind === "card" && drag.moved
      ? (() => {
          const receiver = playerAt(drag.x, drag.y);
          if (receiver !== null) return { kind: "player" as const, id: receiver._id };
          const pile = pileAt(drag.x, drag.y);
          if (pile !== null) return { kind: "pile" as const, id: pile };
          const group = groupAt(drag.x, drag.y);
          if (group !== null) return { kind: "group" as const, id: group.id };
          const target = looseCardAt(drag.x, drag.y, drag.id);
          if (target !== null) return { kind: "card" as const, id: target._id };
          return null;
        })()
      : null;

  const toFraction = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect === undefined) return { x: 0.5, y: 0.5 };
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const startDrag =
    (target: DragTarget, origin?: { x: number; y: number }) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const pos = toFraction(e.clientX, e.clientY);
      // With an origin, the object keeps its grab point (groups); without,
      // it centres under the pointer (single cards, players).
      const offX = origin === undefined ? 0 : origin.x - pos.x;
      const offY = origin === undefined ? 0 : origin.y - pos.y;
      setDrag({
        ...target,
        x: pos.x + offX,
        y: pos.y + offY,
        offX,
        offY,
        moved: false,
      });
    };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const pos = toFraction(e.clientX, e.clientY);
    setDrag({ ...drag, x: pos.x + drag.offX, y: pos.y + drag.offY, moved: true });
  };

  const moveWithOverride = (
    id: string,
    x: number,
    y: number,
    mutate: () => Promise<unknown>,
  ) => pending.apply({ [id]: { x, y } }, mutate);

  const endDrag = () => {
    if (drag === null) return;
    if (drag.kind === "card") {
      if (drag.moved) {
        if (dropTarget !== null && dropTarget.kind === "player") {
          // Onto a player disk: the card goes into that player's hand
          // (taking a misplay back, or handing a card to someone).
          localPickUps.current.add(drag.id);
          // Pin the card at the drop point until the server takes it off
          // the board — no snap back, no redundant flight on this screen.
          moveWithOverride(drag.id, drag.x, drag.y, () =>
            run(api.cards.pickUp, {
              cardId: drag.id,
              playerId: dropTarget.id,
            }),
          );
        } else if (dropTarget !== null && dropTarget.kind === "pile") {
          // Onto a pile: the card goes on top of the burn pile, or back
          // onto the stock face down. Pin it at the drop point until the
          // server takes it off the board — no snap back.
          moveWithOverride(drag.id, drag.x, drag.y, () =>
            dropTarget.id === "burn"
              ? run(api.cards.burn, { cardId: drag.id })
              : run(api.cards.toStock, { cardId: drag.id }),
          );
        } else if (dropTarget !== null && dropTarget.kind === "group") {
          // Onto a meld row (possibly its own): the card slides in at the
          // end — pin it at that exact slot so it doesn't jump when the
          // server confirms.
          const target = groups.find((g) => g.id === dropTarget.id);
          const origin = target?.members[0];
          const endSlot =
            target === undefined
              ? 0
              : target.members.length -
                (target.members.some((m) => m._id === drag.id) ? 1 : 0);
          const pinX =
            (origin?.x ?? drag.x) + (endSlot * groupOffset) / (boardWidth || 800);
          moveWithOverride(drag.id, pinX, origin?.y ?? drag.y, () =>
            run(api.cards.addToGroup, {
              cardIds: [drag.id],
              groupId: dropTarget.id,
            }),
          );
        } else if (dropTarget !== null && dropTarget.kind === "card") {
          // Onto a loose card: the two start a new row, the dropped card in
          // slot 1 — pin it there.
          const target = loose.find((c) => c._id === dropTarget.id);
          const pinX =
            (target?.x ?? drag.x) + groupOffset / (boardWidth || 800);
          moveWithOverride(drag.id, pinX, target?.y ?? drag.y, () =>
            run(api.cards.groupWith, {
              cardIds: [drag.id],
              targetCardId: dropTarget.id,
            }),
          );
        } else if (dropTarget === null) {
          moveWithOverride(drag.id, drag.x, drag.y, () =>
            run(api.cards.moveOnBoard, {
              cardId: drag.id,
              x: drag.x,
              y: drag.y,
            }),
          );
        }
      } else {
        // A double tap on a board card turns it over.
        const now = Date.now();
        const isDouble =
          lastTap.current !== null &&
          lastTap.current.id === drag.id &&
          now - lastTap.current.time < 350;
        if (isDouble) {
          lastTap.current = null;
          void run(api.cards.flip, { cardId: drag.id });
        } else {
          lastTap.current = { id: drag.id, time: now };
        }
      }
    } else if (drag.kind === "group") {
      if (drag.moved) {
        moveWithOverride(drag.id, drag.x, drag.y, () =>
          run(api.cards.moveGroup, {
            tableId,
            groupId: drag.id,
            x: drag.x,
            y: drag.y,
          }),
        );
      }
    } else if (drag.moved) {
      moveWithOverride(drag.id, drag.x, drag.y, () =>
        run(api.players.move, {
          playerId: drag.id,
          x: drag.x,
          y: drag.y,
        }),
      );
    } else {
      // A tap on a player disk passes the turn marker (tap again to clear).
      const playerId = drag.id;
      void run(api.tables.setTurn, {
        tableId,
        playerId: table.turnPlayerId === playerId ? undefined : playerId,
      });
    }
    setDrag(null);
  };

  const dragPosition = (kind: Drag["kind"], id: string, x: number, y: number) => {
    if (drag !== null && drag.kind === kind && drag.id === id) {
      return { x: drag.x, y: drag.y };
    }
    return pending.get(id) ?? { x, y };
  };

  return (
    <div className="table-page">
      <header className="table-header">
        <h1>🃏 {table.name}</h1>
        {table.code !== undefined && (
          <span className="table-code">{table.code}</span>
        )}
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
          {table.config.burnPile && !inLobby && canPlayToBoard && (
            <button
              className="btn"
              onClick={() => void run(api.tables.gatherBoard, { tableId, to: "burn" })}
            >
              {t(lang, "table.gatherBurn")}
            </button>
          )}
          {table.config.stockPile && !inLobby && canPlayToBoard && (
            <button
              className="btn"
              onClick={() => void run(api.tables.gatherBoard, { tableId, to: "stock" })}
            >
              {t(lang, "table.gatherStock")}
            </button>
          )}
          {table.config.burnPile && table.config.stockPile && !inLobby && (
            <button
              className="btn"
              disabled={cards.burnCount === 0}
              onClick={() => void run(api.tables.reshuffleBurn, { tableId })}
            >
              {t(lang, "table.reshuffleBurn")}
            </button>
          )}
          <button
            className="btn"
            onClick={() => void run(api.players.arrangeCircle, { tableId })}
          >
            {t(lang, "table.circle")}
          </button>
          <button
            className={`btn${showScores ? " btn-primary" : ""}`}
            onClick={() => setShowScores((s) => !s)}
          >
            🏆 {t(lang, "table.scores")}
          </button>
          <button className="btn" onClick={() => setShowQr((s) => !s)}>
            QR
          </button>
          {fullscreenAvailable() && (
            <button
              className="btn btn-icon"
              aria-label={t(lang, "app.fullscreen")}
              onClick={toggleFullscreen}
            >
              ⛶
            </button>
          )}
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
        <div className="board" ref={attachBoard}>
          {/* piles */}
          <div className="piles" style={{ gap: pileGap(boardWidth) }}>
            {table.config.stockPile && (
              <div
                className={`pile${
                  dropTarget?.kind === "pile" && dropTarget.id === "stock"
                    ? " drop-target"
                    : ""
                }`}
              >
                {cards.stockCount > 0 ? (
                  <CardView rank="" suit="" faceUp={false} width={pileWidth(boardWidth)} />
                ) : (
                  <div
                    className="pile-empty"
                    style={{
                      width: pileWidth(boardWidth),
                      height: pileWidth(boardWidth) * 1.4,
                    }}
                  />
                )}
                <span
                  className="pile-label"
                  style={{ fontSize: Math.max(12, pileWidth(boardWidth) * 0.17) }}
                >
                  {t(lang, "table.stock")} · {cards.stockCount}
                </span>
              </div>
            )}
            {table.config.burnPile && (
              <div
                className={`pile${
                  dropTarget?.kind === "pile" && dropTarget.id === "burn"
                    ? " drop-target"
                    : ""
                }`}
              >
                {cards.burnTop !== null ? (
                  <CardView
                    rank={cards.burnTop.rank}
                    suit={cards.burnTop.suit}
                    faceUp={cards.burnTop.faceUp}
                    width={pileWidth(boardWidth)}
                    fourColor={fourColor}
                  />
                ) : (
                  <div
                    className="pile-empty"
                    style={{
                      width: pileWidth(boardWidth),
                      height: pileWidth(boardWidth) * 1.4,
                    }}
                  />
                )}
                <span
                  className="pile-label"
                  style={{ fontSize: Math.max(12, pileWidth(boardWidth) * 0.17) }}
                >
                  {t(lang, "table.burn")} · {cards.burnCount}
                </span>
              </div>
            )}
          </div>

          {/* loose board cards, plus grouped cards mid-drag or pinned at a
              drop point (a card still flying in stays hidden until it lands) */}
          {[...loose, ...liftedGroupCards]
            .filter((card: Card) => !flights.some((f) => f.cardId === card._id))
            .map((card: Card) => {
            const pos = dragPosition("card", card._id, card.x, card.y);
            return (
              <div
                key={card._id}
                className={`board-card${
                  dropTarget?.kind === "card" && dropTarget.id === card._id
                    ? " drop-target"
                    : ""
                }`}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  zIndex:
                    drag?.kind === "card" && drag.id === card._id
                      ? 1000
                      : pending.get(card._id) !== undefined
                        ? 999
                        : card.z,
                }}
                onPointerDown={startDrag({ kind: "card", id: card._id }, pos)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <FlipCard
                  rank={card.rank}
                  suit={card.suit}
                  faceUp={card.faceUp}
                  width={cardW}
                  fourColor={fourColor}
                />
              </div>
            );
          })}

          {/* meld rows: cards fanned out from a shared origin, moved as one
              via the handle above the row */}
          {groups.map((group) => {
            const origin = group.members[0]!;
            const pos = dragPosition("group", group.id, origin.x, origin.y);
            const isDragged = drag?.kind === "group" && drag.id === group.id;
            const zTop = group.members.reduce((max, c) => Math.max(max, c.z), 0);
            return (
              <div
                key={group.id}
                className="board-group"
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  marginLeft: -cardW / 2,
                  marginTop: -cardH / 2,
                  zIndex: isDragged
                    ? 1000
                    : pending.get(group.id) !== undefined
                      ? 999
                      : zTop,
                }}
              >
                {dropTarget?.kind === "group" && dropTarget.id === group.id && (
                  <div
                    className="board-group-ring"
                    style={{
                      width: cardW + (group.members.length - 1) * groupOffset,
                      height: cardH,
                    }}
                  />
                )}
                <div
                  className="board-group-handle"
                  style={{ width: cardW + (group.members.length - 1) * groupOffset }}
                  onPointerDown={startDrag({ kind: "group", id: group.id }, pos)}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                {group.members
                  .filter(
                    (card) =>
                      !liftedGroupCards.some((l) => l._id === card._id) &&
                      !flights.some((f) => f.cardId === card._id),
                  )
                  .map((card) => (
                    <div
                      key={card._id}
                      className="board-group-card"
                      style={{ left: (card.slot ?? 0) * groupOffset }}
                      onPointerDown={startDrag({ kind: "card", id: card._id }, {
                        // The member's visual centre: row origin + its slot.
                        x: pos.x + ((card.slot ?? 0) * groupOffset) / (boardWidth || 800),
                        y: pos.y,
                      })}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      <FlipCard
                        rank={card.rank}
                        suit={card.suit}
                        faceUp={card.faceUp}
                        width={cardW}
                        fourColor={fourColor}
                      />
                    </div>
                  ))}
              </div>
            );
          })}

          {/* card-movement animations */}
          {flights.map((flight) => {
            const boardCard =
              flight.cardId !== undefined
                ? cards.board.find((c) => c._id === flight.cardId)
                : undefined;
            return (
              <FlyingCard
                key={flight.id}
                fourColor={fourColor}
                width={flightWidth(boardWidth)}
                flight={
                  boardCard === undefined
                    ? flight
                    : {
                        ...flight,
                        face: {
                          rank: boardCard.rank,
                          suit: boardCard.suit,
                          faceUp: boardCard.faceUp,
                        },
                      }
                }
              />
            );
          })}

          {/* players */}
          {players.map((player: Player) => {
            const pos = dragPosition("player", player._id, player.x, player.y);
            const handCount = cards.handCounts[player._id] ?? 0;
            const isTurn = table.turnPlayerId === player._id;
            // Player disks grow with the board so names and hands read
            // well from a distance on a TV.
            const scale = boardScale(boardWidth);
            return (
              <div
                key={player._id}
                className={`player-disk${isTurn ? " player-disk-turn" : ""}${
                  dropTarget?.kind === "player" && dropTarget.id === player._id
                    ? " drop-target"
                    : ""
                }`}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  borderColor: player.color,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                }}
                onPointerDown={startDrag({ kind: "player", id: player._id })}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {isTurn && <span className="player-turn-marker">▶</span>}
                <span className="player-name">
                  {player.name}
                  {player.score !== undefined && (
                    <span className="player-score"> {player.score}</span>
                  )}
                </span>
                <span className="player-cards">
                  {Array.from({ length: Math.min(handCount, 5) }, (_, i) => (
                    <span key={i} className="player-mini-card" />
                  ))}
                  <span className="player-count" style={{ background: player.color }}>
                    {handCount}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {showScores && (
          <div className="score-panel">
            <h3>🏆 {t(lang, "table.scores")}</h3>
            {players.map((player: Player) => {
              const draft = scoreDrafts[player._id] ?? "";
              const commit = () => {
                const delta = Number(draft);
                if (draft.trim() === "" || Number.isNaN(delta)) return;
                void run(api.players.setScore, {
                  playerId: player._id as PlayerId,
                  score: (player.score ?? 0) + delta,
                });
                setScoreDrafts((d) => ({ ...d, [player._id]: "" }));
              };
              return (
                <div key={player._id} className="score-row">
                  <span className="score-name" style={{ background: player.color }}>
                    {player.name}
                  </span>
                  <strong className="score-total">{player.score ?? 0}</strong>
                  <input
                    className="score-input"
                    type="number"
                    placeholder="±"
                    value={draft}
                    onChange={(e) =>
                      setScoreDrafts((d) => ({ ...d, [player._id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                    }}
                  />
                  <button className="btn score-add" onClick={commit}>
                    {t(lang, "table.scoreAdd")}
                  </button>
                </div>
              );
            })}
            <p className="score-hint">{t(lang, "table.turnHint")}</p>
            <button
              className="btn"
              onClick={() => {
                if (!window.confirm(t(lang, "table.scoreResetConfirm"))) return;
                void run(api.players.resetScores, { tableId });
              }}
            >
              {t(lang, "table.scoreReset")}
            </button>
          </div>
        )}
      </div>

      {(inLobby || showQr) && (
        <div className="lobby-overlay" onClick={() => !inLobby && setShowQr(false)}>
          <div className="lobby-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{t(lang, "table.scanToJoin")}</h2>
            <QRCode text={joinLink} size={240} />
            {table.code !== undefined && (
              <div className="lobby-code">
                {t(lang, "table.code")}: <strong>{table.code}</strong>
              </div>
            )}
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
