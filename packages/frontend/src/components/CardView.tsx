interface CardViewProps {
  rank: string;
  suit: string;
  faceUp: boolean;
  width: number;
  selected?: boolean;
  /** Four-color deck: ♥ red, ♦ blue, ♣ green, ♠ black. */
  fourColor?: boolean;
}

const suitClass = (suit: string, fourColor: boolean): string => {
  if (fourColor) {
    switch (suit) {
      case "♥":
        return "card-red";
      case "♦":
        return "card-blue";
      case "♣":
        return "card-green";
      default:
        return "card-black";
    }
  }
  return suit === "♥" || suit === "♦" ? "card-red" : "card-black";
};

/**
 * A card that turns over with a quick rotateY animation (mirrored through
 * its vertical centre) whenever `faceUp` changes — both faces are always
 * rendered, so the browser can animate between them.
 */
export const FlipCard = ({
  rank,
  suit,
  faceUp,
  width,
  fourColor,
}: Omit<CardViewProps, "selected">) => (
  <div className="flip-card" style={{ width, height: width * 1.4 }}>
    <div className={`flip-card-inner${faceUp ? "" : " flip-card-down"}`}>
      <div className="flip-card-face">
        <CardView
          rank={rank}
          suit={suit}
          faceUp={true}
          width={width}
          fourColor={fourColor}
        />
      </div>
      <div className="flip-card-face flip-card-backside">
        <CardView rank="" suit="" faceUp={false} width={width} />
      </div>
    </div>
  </div>
);

export const CardView = ({
  rank,
  suit,
  faceUp,
  width,
  selected,
  fourColor,
}: CardViewProps) => {
  const height = width * 1.4;
  if (!faceUp) {
    return (
      <div
        className={`card card-back${selected ? " card-selected" : ""}`}
        style={{ width, height }}
      />
    );
  }
  const joker = rank === "JOKER";
  return (
    <div
      className={`card card-face ${suitClass(suit, fourColor ?? false)}${
        selected ? " card-selected" : ""
      }`}
      style={{ width, height, fontSize: width * 0.28 }}
    >
      <div className="card-corner card-corner-tl">
        <span>{joker ? "J" : rank}</span>
        <span>{joker ? "★" : suit}</span>
      </div>
      <div className="card-center" style={{ fontSize: width * 0.5 }}>
        {joker ? "🃏" : suit}
      </div>
      <div className="card-corner card-corner-br">
        <span>{joker ? "J" : rank}</span>
        <span>{joker ? "★" : suit}</span>
      </div>
    </div>
  );
};
