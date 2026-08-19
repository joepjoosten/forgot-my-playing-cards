import { useEffect, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convexQuery, run } from "../convex";
import { CardView } from "./CardView";
import { MiniTable } from "./MiniTable";
import { fullscreenAvailable, toggleFullscreen } from "../fullscreen";
import { detectLanguage, t } from "../i18n";
import { navigate } from "../route";
import { useServerEcho } from "../useServerEcho";
import { useElementWidth } from "../useElementWidth";
import { storedPlayerKey, type Card, type CardId, type PlayerId, type TableId } from "../model";

const THROW_DISTANCE = 90;

/** The single key under which the hand's local order override is kept. */
const HAND_ORDER = "hand-order";

interface HandDrag {
  cardId: CardId;
  /** Index in the hand when the drag started — the card stays anchored
   * here (plus dx) so it remains under the finger while neighbours shift. */
  startIndex: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

export const PlayerView = ({
  tableId,
  playerId,
}: {
  tableId: TableId;
  playerId: PlayerId;
}) => {
  const table = useAtomValue(convexQuery(api.tables.get, { tableId }));
  const player = useAtomValue(convexQuery(api.players.get, { playerId }));
  const hand = useAtomValue(convexQuery(api.cards.hand, { playerId }));
  const piles = useAtomValue(convexQuery(api.cards.forTable, { tableId }));
  const players = useAtomValue(convexQuery(api.players.list, { tableId }));

  const [showTable, setShowTable] = useState(false);
  // Tapping cards toggles them in the selection; two or more form a set
  // that can be played onto the table as one row.
  const [selected, setSelected] = useState<ReadonlySet<CardId>>(new Set());
  // The hand order while dragging / until the reorder mutation settles.
  const handOrder = useServerEcho<ReadonlyArray<CardId>>();
  const [drag, setDrag] = useState<HandDrag | null>(null);
  // Cards that just left the hand, hidden until the server confirms.
  const hidden = useServerEcho<true>();
  // Cards this phone played onto the board, most recent last — the take-back
  // button undoes them one at a time. Only your own plays can be undone.
  const [playedStack, setPlayedStack] = useState<ReadonlyArray<CardId>>([]);
  // Observed width so a rotation re-fits the hand rows to the new size.
  const strip = useElementWidth();

  // A new deal invalidates whatever was played in the previous round.
  const round = table?.round;
  useEffect(() => {
    setPlayedStack([]);
  }, [round]);

  if (table === undefined || player === undefined || hand === undefined) {
    return <div className="page center">{t(detectLanguage(), "player.loading")}</div>;
  }
  if (table === null || player === null) {
    const lang = table?.language ?? detectLanguage();
    return (
      <div className="page center">
        {t(lang, "player.notAtTable")}
        <a className="btn btn-big" href={`#/join/${tableId}`}>
          {t(lang, "player.joinAgain")}
        </a>
      </div>
    );
  }

  const lang = table.language ?? "en";
  const canPlayToBoard = table.config.playToBoard !== false;
  const fourColor = table.config.fourColor === true;

  // While dragging we show our local order; otherwise the server's order.
  const localOrder = handOrder.get(HAND_ORDER) ?? null;
  const visibleHand = hand.filter((c) => hidden.get(c._id) === undefined);
  const orderedHand: Array<Card> =
    localOrder === null
      ? visibleHand
      : [...visibleHand].sort(
          (a, b) => localOrder.indexOf(a._id) - localOrder.indexOf(b._id),
        );

  const stripWidth = strip.width || window.innerWidth;
  const cardWidth = Math.min(84, Math.max(56, stripWidth / 6));
  const cardHeight = cardWidth * 1.4;
  // Below this spacing the rank corner disappears under the next card, so
  // instead of squeezing further the hand wraps onto extra rows.
  const minSlot = cardWidth * 0.32;
  const maxPerRow = Math.max(
    2,
    1 + Math.floor((stripWidth - cardWidth - 24) / minSlot),
  );
  const rows = Math.max(1, Math.ceil(orderedHand.length / maxPerRow));
  // Spread the cards evenly over the rows (13 cards → 7 + 6, not 12 + 1).
  const perRow = Math.ceil(orderedHand.length / rows);
  const slot =
    perRow <= 1
      ? cardWidth
      : Math.min(cardWidth + 8, (stripWidth - cardWidth - 24) / (perRow - 1));
  // Lower rows overlap the row above them; the corner ranks stay visible.
  const rowHeight = cardHeight * 0.55;
  const rowOf = (index: number) => Math.floor(index / perRow);
  /** Vertical shift from the bottom row's baseline (negative = up). */
  const rowLift = (row: number) => -(rows - 1 - row) * rowHeight;

  // Cards leaving the hand are hidden locally until the server confirms —
  // otherwise the hand briefly snaps back to its stale server state.
  const removeManyFromHand = (
    cardIds: ReadonlyArray<CardId>,
    mutate: () => Promise<unknown>,
  ) =>
    hidden.apply(
      Object.fromEntries(cardIds.map((id) => [id, true as const])),
      mutate,
    );

  const removeFromHand = (cardId: CardId, mutate: () => Promise<unknown>) =>
    removeManyFromHand([cardId], mutate);

  const playCard = (cardId: CardId, faceUp: boolean) => {
    setSelected(new Set());
    setPlayedStack((s) => [...s, cardId]);
    removeFromHand(cardId, () =>
      run(api.cards.play, {
        cardId,
        x: 0.32 + Math.random() * 0.36,
        y: 0.34 + Math.random() * 0.32,
        faceUp,
      }),
    );
  };

  /** Play the selected cards together as one row (a meld) on the table. */
  const playSet = (cardIds: ReadonlyArray<CardId>, faceUp: boolean) => {
    setSelected(new Set());
    setPlayedStack((s) => [...s, ...cardIds]);
    removeManyFromHand(cardIds, () =>
      run(api.cards.playMany, {
        cardIds: [...cardIds],
        x: 0.25 + Math.random() * 0.35,
        y: 0.34 + Math.random() * 0.32,
        faceUp,
      }),
    );
  };

  /** Take the most recently played card back from the board (undo). */
  const takeBack = () => {
    const cardId = playedStack[playedStack.length - 1];
    if (cardId === undefined) return;
    setPlayedStack((s) => s.slice(0, -1));
    // If the card meanwhile left the board (piled, picked up), this no-ops.
    void run(api.cards.pickUp, { cardId, playerId });
  };

  const onPointerDown =
    (card: Card) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        cardId: card._id,
        startIndex: orderedHand.findIndex((c) => c._id === card._id),
        startX: e.clientX,
        startY: e.clientY,
        dx: 0,
        dy: 0,
      });
      // A hold also invalidates any pending reorder cleanup; this drag
      // owns the order now.
      handOrder.hold(HAND_ORDER, orderedHand.map((c) => c._id));
    };

  // A throw must clear the rows lying above the card's own row, so the
  // threshold grows the further down the hand the card sits.
  const throwDistance = (index: number) =>
    THROW_DISTANCE + rowOf(index) * rowHeight;

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null || localOrder === null) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDrag({ ...drag, dx, dy });

    // Movement reorders the hand (only while not throwing): horizontally
    // within a row, vertically across rows — any row above stays reachable
    // before the gesture starts counting as a throw.
    if (dy > -(THROW_DISTANCE / 2 + rowOf(drag.startIndex) * rowHeight)) {
      const from = localOrder.indexOf(drag.cardId);
      const startRow = rowOf(drag.startIndex);
      const targetRow = Math.min(
        rows - 1,
        Math.max(0, startRow + Math.round(dy / rowHeight)),
      );
      const shift =
        Math.round(dx / slot) + (targetRow - startRow) * perRow;
      const to = Math.min(
        localOrder.length - 1,
        Math.max(0, drag.startIndex + shift),
      );
      if (from !== to) {
        const next = [...localOrder];
        next.splice(from, 1);
        next.splice(to, 0, drag.cardId);
        handOrder.hold(HAND_ORDER, next);
      }
    }
  };

  const onPointerUp = () => {
    if (drag === null || localOrder === null) return;
    const isThrow = drag.dy < -throwDistance(drag.startIndex);
    const moved = Math.abs(drag.dx) > 8 || Math.abs(drag.dy) > 8;

    if (isThrow) {
      if (canPlayToBoard) {
        playCard(drag.cardId, table.config.playFaceUp);
      } else {
        // Burn-only table: an upward flick discards to the burn pile.
        setSelected(new Set());
        removeFromHand(drag.cardId, () =>
          run(api.cards.burn, { cardId: drag.cardId }),
        );
      }
      handOrder.clear(HAND_ORDER);
    } else if (moved) {
      const serverOrder = hand.map((c) => c._id);
      const changed =
        localOrder.length !== serverOrder.length ||
        localOrder.some((id, i) => id !== serverOrder[i]);
      if (changed) {
        // Keep showing the local order until the server echoes it back;
        // a newer drag takes precedence over this cleanup.
        handOrder.apply({ [HAND_ORDER]: localOrder }, () =>
          run(api.cards.reorderHand, {
            playerId,
            cardIds: [...localOrder],
          }),
        );
      } else {
        handOrder.clear(HAND_ORDER);
      }
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(drag.cardId)) next.delete(drag.cardId);
        else next.add(drag.cardId);
        return next;
      });
      handOrder.clear(HAND_ORDER);
    }
    setDrag(null);
  };

  const stockCount = piles?.stockCount ?? 0;
  const burnCount = piles?.burnCount ?? 0;
  const burnTop = piles?.burnTop ?? null;
  // Only cards still in the hand count; stale selections are ignored.
  const selectedCards = orderedHand.filter((c) => selected.has(c._id));
  const isMyTurn = table.turnPlayerId === playerId;

  // Aiming at the mini table: the selection goes exactly where the tap says.
  const takeSelection = (): ReadonlyArray<CardId> => {
    const cardIds = selectedCards.map((c) => c._id);
    setSelected(new Set());
    setPlayedStack((s) => [...s, ...cardIds]);
    return cardIds;
  };

  const playSelectedAt = (x: number, y: number) => {
    const cardIds = takeSelection();
    if (cardIds.length === 0) return;
    removeManyFromHand(cardIds, () =>
      run(api.cards.playMany, {
        cardIds: [...cardIds],
        x,
        y,
        faceUp: table.config.playFaceUp,
      }),
    );
  };

  const addSelectedToGroup = (groupId: string) => {
    const cardIds = takeSelection();
    if (cardIds.length === 0) return;
    removeManyFromHand(cardIds, () =>
      run(api.cards.addToGroup, { cardIds: [...cardIds], groupId }),
    );
  };

  const groupSelectedWith = (targetCardId: CardId) => {
    const cardIds = takeSelection();
    if (cardIds.length === 0) return;
    removeManyFromHand(cardIds, () =>
      run(api.cards.groupWith, { cardIds: [...cardIds], targetCardId }),
    );
  };

  const canTarget =
    canPlayToBoard && table.status === "playing" && selectedCards.length > 0;

  const leaveTable = () => {
    if (!window.confirm(t(lang, "player.leaveConfirm"))) return;
    localStorage.removeItem(storedPlayerKey(tableId));
    void run(api.players.leave, { playerId }).finally(() => navigate("/"));
  };

  return (
    <div className="player-page">
      <header className="player-header" style={{ borderColor: player.color }}>
        <span className="player-badge" style={{ background: player.color }}>
          {player.name}
        </span>
        {isMyTurn && (
          <span className="player-turn-badge">▶ {t(lang, "player.yourTurn")}</span>
        )}
        {table.dealerPlayerId === playerId && (
          <span className="player-dealer-badge">{t(lang, "player.dealer")}</span>
        )}
        <span className="player-table-name">{table.name}</span>
        <span className="player-hand-count">
          {t(lang, "player.cards", { count: hand.length })}
        </span>
        {canPlayToBoard && table.status === "playing" && hand.length > 0 && (
          <button
            className="btn btn-icon"
            aria-label={t(lang, "player.revealHand")}
            title={t(lang, "player.revealHand")}
            onClick={() => {
              if (!window.confirm(t(lang, "player.revealConfirm"))) return;
              setSelected(new Set());
              removeManyFromHand(
                hand.map((c) => c._id),
                () => run(api.cards.revealHand, { playerId }),
              );
            }}
          >
            🤲
          </button>
        )}
        <button
          className={`btn btn-icon${showTable ? " btn-primary" : ""}`}
          aria-label={t(lang, "player.showTable")}
          title={t(lang, "player.showTable")}
          onClick={() => setShowTable((s) => !s)}
        >
          👁
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
        <button
          className="btn btn-icon"
          aria-label={t(lang, "player.leave")}
          title={t(lang, "player.leave")}
          onClick={leaveTable}
        >
          🚪
        </button>
      </header>

      {showTable && piles !== undefined && (
        <>
          <MiniTable
            table={table}
            players={players ?? []}
            cards={piles}
            targeting={
              canTarget
                ? {
                    onPlayAt: playSelectedAt,
                    onAddToGroup: addSelectedToGroup,
                    onGroupWith: groupSelectedWith,
                  }
                : undefined
            }
          />
          {canTarget && (
            <p className="player-hint">{t(lang, "player.tapTable")}</p>
          )}
        </>
      )}

      <div className="player-actions">
        {table.config.stockPile && (
          <button
            className="btn btn-big"
            disabled={stockCount === 0}
            onClick={() => void run(api.cards.draw, { playerId })}
          >
            {t(lang, "player.draw", { count: stockCount })}
          </button>
        )}
        {table.config.burnPile && (
          <button
            className="btn btn-big"
            disabled={burnTop === null}
            onClick={() => void run(api.cards.takeBurn, { playerId })}
          >
            {t(lang, "player.takeBurn")}
            {burnTop !== null && burnTop.faceUp ? ` (${burnTop.rank}${burnTop.suit})` : ""}
          </button>
        )}
        {table.config.burnPile && burnCount > 1 && (
          <button
            className="btn btn-big"
            onClick={() => void run(api.cards.takeBurnAll, { playerId })}
          >
            {t(lang, "player.takeBurnAll", { count: burnCount })}
          </button>
        )}
        {table.status === "playing" && playedStack.length > 0 && (
          <button
            className="btn btn-big"
            title={t(lang, "player.takeBack")}
            onClick={takeBack}
          >
            ↩ {t(lang, "player.takeBack")}
          </button>
        )}
      </div>

      {table.status === "lobby" ? (
        <div className="player-waiting">
          <p>{t(lang, "player.waiting")}</p>
        </div>
      ) : (
        <>
          <p className="player-hint">
            {t(lang, canPlayToBoard ? "player.hint" : "player.hintBurnOnly")}
          </p>
          <div
            className="hand-strip"
            ref={strip.attach}
            style={
              rows > 1
                ? { minHeight: cardHeight + 32 + (rows - 1) * rowHeight }
                : undefined
            }
          >
            {orderedHand.map((card, index) => {
              const isDragged = drag !== null && drag.cardId === card._id;
              const isThrowing =
                isDragged && drag.dy < -throwDistance(drag.startIndex);
              const startRow = isDragged ? rowOf(drag.startIndex) : 0;
              return (
                <div
                  key={card._id}
                  className={`hand-card${isDragged ? " hand-card-dragged" : ""}${
                    isThrowing ? " hand-card-throwing" : ""
                  }`}
                  style={{
                    // While dragging, the full horizontal position lives in
                    // `left` (transitions off) so that on release the card
                    // animates from under the finger to its final slot —
                    // never via its old slot. The row offset rides on the
                    // transform so the CSS bottom baseline keeps working.
                    left: isDragged
                      ? 12 + (drag.startIndex % perRow) * slot + drag.dx
                      : 12 + (index % perRow) * slot,
                    zIndex: isDragged ? 1000 : index,
                    transform: isDragged
                      ? `translateY(${
                          rowLift(startRow) +
                          Math.min(drag.dy, (rows - 1 - startRow) * rowHeight)
                        }px) rotate(${drag.dx / 20}deg)`
                      : `translateY(${
                          rowLift(rowOf(index)) +
                          (selected.has(card._id) ? -24 : 0)
                        }px)`,
                  }}
                  onPointerDown={onPointerDown(card)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <CardView
                    rank={card.rank}
                    suit={card.suit}
                    faceUp={true}
                    width={cardWidth}
                    selected={selected.has(card._id)}
                    fourColor={fourColor}
                  />
                </div>
              );
            })}
            {orderedHand.length === 0 && (
              <p className="hand-empty">{t(lang, "player.emptyHand")}</p>
            )}
          </div>

          {selectedCards.length > 0 && (
            <div className="card-action-bar">
              {canPlayToBoard && selectedCards.length > 1 && (
                <button
                  className="btn btn-primary btn-big"
                  onClick={() =>
                    playSet(
                      selectedCards.map((c) => c._id),
                      table.config.playFaceUp,
                    )
                  }
                >
                  {t(lang, "player.playSet", { count: selectedCards.length })}
                </button>
              )}
              {canPlayToBoard && selectedCards.length === 1 && (
                <button
                  className="btn btn-primary btn-big"
                  onClick={() =>
                    playCard(selectedCards[0]!._id, table.config.playFaceUp)
                  }
                >
                  {t(lang, "player.play")}
                </button>
              )}
              {canPlayToBoard && selectedCards.length === 1 && (
                <button
                  className="btn btn-big"
                  onClick={() => playCard(selectedCards[0]!._id, false)}
                >
                  {t(lang, "player.playFaceDown")}
                </button>
              )}
              {table.config.burnPile && selectedCards.length === 1 && (
                <button
                  className={`btn btn-big${canPlayToBoard ? "" : " btn-primary"}`}
                  onClick={() => {
                    const cardId = selectedCards[0]!._id;
                    removeFromHand(cardId, () => run(api.cards.burn, { cardId }));
                    setSelected(new Set());
                  }}
                >
                  {t(lang, "player.burn")}
                </button>
              )}
              <button className="btn btn-big" onClick={() => setSelected(new Set())}>
                ✕
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
