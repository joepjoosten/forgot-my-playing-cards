import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convexQuery, run } from "../convex";
import { CardView } from "./CardView";
import { MiniTable } from "./MiniTable";
import { fullscreenAvailable, toggleFullscreen } from "../fullscreen";
import { detectLanguage, t } from "../i18n";
import { navigate } from "../route";
import { storedPlayerKey, type Card, type CardId, type PlayerId, type TableId } from "../model";

const THROW_DISTANCE = 90;

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
  const [localOrder, setLocalOrder] = useState<ReadonlyArray<CardId> | null>(null);
  const [drag, setDrag] = useState<HandDrag | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<CardId>>(new Set());
  // Cards this phone played onto the board, most recent last — the take-back
  // button undoes them one at a time. Only your own plays can be undone.
  const [playedStack, setPlayedStack] = useState<ReadonlyArray<CardId>>([]);
  const orderEpoch = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);

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
  // Cards that just left the hand stay hidden until the server confirms.
  const visibleHand = hand.filter((c) => !hidden.has(c._id as CardId));
  const orderedHand: Array<Card> =
    localOrder === null
      ? visibleHand
      : [...visibleHand].sort(
          (a, b) =>
            localOrder.indexOf(a._id as CardId) - localOrder.indexOf(b._id as CardId),
        );

  const stripWidth = stripRef.current?.clientWidth ?? window.innerWidth;
  const cardWidth = Math.min(84, Math.max(56, stripWidth / 6));
  const slot =
    orderedHand.length <= 1
      ? cardWidth
      : Math.min(
          cardWidth + 8,
          (stripWidth - cardWidth - 24) / (orderedHand.length - 1),
        );

  // Cards leaving the hand are hidden locally until the server confirms,
  // and a fresh local order is kept until the reorder mutation settles —
  // otherwise the hand briefly snaps back to its stale server state.
  const removeManyFromHand = (
    cardIds: ReadonlyArray<CardId>,
    mutate: () => Promise<unknown>,
  ) => {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const id of cardIds) next.add(id);
      return next;
    });
    void mutate().finally(() => {
      setHidden((prev) => {
        const next = new Set(prev);
        for (const id of cardIds) next.delete(id);
        return next;
      });
    });
  };

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
      // Invalidate any pending reorder cleanup; this drag owns the order now.
      orderEpoch.current++;
      setDrag({
        cardId: card._id as CardId,
        startIndex: orderedHand.findIndex((c) => c._id === card._id),
        startX: e.clientX,
        startY: e.clientY,
        dx: 0,
        dy: 0,
      });
      setLocalOrder(orderedHand.map((c) => c._id as CardId));
    };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null || localOrder === null) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDrag({ ...drag, dx, dy });

    // Horizontal movement reorders the hand (only while not throwing).
    if (dy > -THROW_DISTANCE / 2) {
      const from = localOrder.indexOf(drag.cardId);
      const shift = Math.round(dx / slot);
      const to = Math.min(
        localOrder.length - 1,
        Math.max(0, drag.startIndex + shift),
      );
      if (from !== to) {
        const next = [...localOrder];
        next.splice(from, 1);
        next.splice(to, 0, drag.cardId);
        setLocalOrder(next);
      }
    }
  };

  const onPointerUp = () => {
    if (drag === null || localOrder === null) return;
    const isThrow = drag.dy < -THROW_DISTANCE;
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
      setLocalOrder(null);
    } else if (moved) {
      const serverOrder = hand.map((c) => c._id as CardId);
      const changed =
        localOrder.length !== serverOrder.length ||
        localOrder.some((id, i) => id !== serverOrder[i]);
      if (changed) {
        // Keep showing the local order until the server echoes it back;
        // a newer drag (epoch bump) takes precedence over this cleanup.
        const epoch = ++orderEpoch.current;
        void run(api.cards.reorderHand, {
          playerId,
          cardIds: [...localOrder],
        }).finally(() => {
          if (orderEpoch.current === epoch) setLocalOrder(null);
        });
      } else {
        setLocalOrder(null);
      }
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(drag.cardId)) next.delete(drag.cardId);
        else next.add(drag.cardId);
        return next;
      });
      setLocalOrder(null);
    }
    setDrag(null);
  };

  const stockCount = piles?.stockCount ?? 0;
  const burnCount = piles?.burnCount ?? 0;
  const burnTop = piles?.burnTop ?? null;
  // Only cards still in the hand count; stale selections are ignored.
  const selectedCards = orderedHand.filter((c) => selected.has(c._id as CardId));
  const isMyTurn = table.turnPlayerId === playerId;

  // Aiming at the mini table: the selection goes exactly where the tap says.
  const takeSelection = (): ReadonlyArray<CardId> => {
    const cardIds = selectedCards.map((c) => c._id as CardId);
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
                hand.map((c) => c._id as CardId),
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
          <div className="hand-strip" ref={stripRef}>
            {orderedHand.map((card, index) => {
              const isDragged = drag !== null && drag.cardId === card._id;
              const isThrowing = isDragged && drag.dy < -THROW_DISTANCE;
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
                    // never via its old slot.
                    left: isDragged
                      ? 12 + drag.startIndex * slot + drag.dx
                      : 12 + index * slot,
                    zIndex: isDragged ? 100 : index,
                    transform: isDragged
                      ? `translateY(${Math.min(0, drag.dy)}px) rotate(${
                          drag.dx / 20
                        }deg)`
                      : selected.has(card._id as CardId)
                        ? "translateY(-24px)"
                        : undefined,
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
                    selected={selected.has(card._id as CardId)}
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
                      selectedCards.map((c) => c._id as CardId),
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
                    playCard(selectedCards[0]!._id as CardId, table.config.playFaceUp)
                  }
                >
                  {t(lang, "player.play")}
                </button>
              )}
              {canPlayToBoard && selectedCards.length === 1 && (
                <button
                  className="btn btn-big"
                  onClick={() => playCard(selectedCards[0]!._id as CardId, false)}
                >
                  {t(lang, "player.playFaceDown")}
                </button>
              )}
              {table.config.burnPile && selectedCards.length === 1 && (
                <button
                  className={`btn btn-big${canPlayToBoard ? "" : " btn-primary"}`}
                  onClick={() => {
                    const cardId = selectedCards[0]!._id as CardId;
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
