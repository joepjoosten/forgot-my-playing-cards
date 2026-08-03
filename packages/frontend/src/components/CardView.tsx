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

/** UNO cards carry their colour in `suit`; these are its background colours. */
const UNO_BG: Record<string, string> = {
  red: "#d32f2f",
  yellow: "#f2b807",
  green: "#2e9e4f",
  blue: "#2072cf",
  wild: "#1c1c1e",
};

const isUnoSuit = (suit: string): boolean => suit in UNO_BG;

const unoGlyph = (rank: string): string => {
  switch (rank) {
    case "skip":
      return "⊘";
    case "reverse":
      return "⇄";
    case "wild":
      return "★";
    case "+2":
      return "+2";
    case "+4":
      return "+4";
    default:
      return rank; // 0-9
  }
};

const UnoCard = ({
  rank,
  suit,
  width,
  height,
  selected,
}: {
  rank: string;
  suit: string;
  width: number;
  height: number;
  selected?: boolean;
}) => {
  const glyph = unoGlyph(rank);
  // Every glyph is white with a dark outline (see CSS) so it reads on any
  // colour, including yellow and the black wild card.
  return (
    <div
      className={`card card-face card-uno${selected ? " card-selected" : ""}`}
      style={{
        width,
        height,
        background: UNO_BG[suit],
        color: "#fff",
        fontSize: width * 0.28,
      }}
    >
      {/* The tilted centre ellipse: white for coloured cards, the four-colour
          wheel for wilds. */}
      <div className={suit === "wild" ? "card-uno-wheel" : "card-uno-oval"} />
      <div className="card-corner card-corner-tl">
        <span>{glyph}</span>
      </div>
      <div className="card-uno-center" style={{ fontSize: width * 0.55 }}>
        {glyph}
      </div>
      <div className="card-corner card-corner-br">
        <span>{glyph}</span>
      </div>
    </div>
  );
};

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
  if (isUnoSuit(suit)) {
    return (
      <UnoCard
        rank={rank}
        suit={suit}
        width={width}
        height={height}
        selected={selected}
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
