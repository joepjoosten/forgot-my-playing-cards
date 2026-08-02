import { useState } from "react";
import { api } from "@backend/convex/_generated/api";
import { convex } from "../convex";
import { navigate } from "../route";
import { defaultConfig, type TableConfig } from "../model";

const shuffleOptions = [
  { value: "riffle", label: "Riffle shuffle" },
  { value: "overhand", label: "Overhand shuffle" },
  { value: "fisher-yates", label: "Perfect random" },
  { value: "cut", label: "Cut only" },
  { value: "none", label: "No shuffle" },
] as const;

export const Home = () => {
  const [name, setName] = useState("My table");
  const [config, setConfig] = useState<TableConfig>(defaultConfig);
  const [creating, setCreating] = useState(false);

  const patch = (partial: Partial<TableConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const tableId = await convex.mutation(api.tables.create, {
        name: name.trim() === "" ? "Card table" : name.trim(),
        config,
      });
      navigate(`/table/${tableId}`);
    } catch (error) {
      console.error(error);
      setCreating(false);
    }
  };

  return (
    <div className="page home-page">
      <h1 className="app-title">🃏 Forgot My Playing Cards</h1>
      <p className="app-subtitle">
        A shared card table for any game — the table handles decks, shuffling
        and dealing, you bring the rules.
      </p>

      <div className="panel">
        <label className="field">
          <span>Table name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday night rummy"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Decks</span>
            <NumberStepper
              value={config.deckCount}
              min={1}
              max={8}
              onChange={(deckCount) => patch({ deckCount })}
            />
          </label>
          <label className="field">
            <span>Jokers / deck</span>
            <NumberStepper
              value={config.jokersPerDeck}
              min={0}
              max={4}
              onChange={(jokersPerDeck) => patch({ jokersPerDeck })}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Shuffle</span>
            <select
              value={config.shuffle}
              onChange={(e) =>
                patch({ shuffle: e.target.value as TableConfig["shuffle"] })
              }
            >
              {shuffleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Passes</span>
            <NumberStepper
              value={config.shufflePasses}
              min={1}
              max={20}
              onChange={(shufflePasses) => patch({ shufflePasses })}
            />
          </label>
        </div>

        <label className="field">
          <span>Cards dealt per player</span>
          <NumberStepper
            value={config.dealPerPlayer}
            min={0}
            max={30}
            onChange={(dealPerPlayer) => patch({ dealPerPlayer })}
          />
        </label>

        <div className="field-row toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.stockPile}
              onChange={(e) => patch({ stockPile: e.target.checked })}
            />
            <span>Stock pile (draw cards)</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.burnPile}
              onChange={(e) => patch({ burnPile: e.target.checked })}
            />
            <span>Burn pile (discard)</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.playFaceUp}
              onChange={(e) => patch({ playFaceUp: e.target.checked })}
            />
            <span>Play cards face up</span>
          </label>
        </div>

        <button className="btn btn-primary btn-big" onClick={create} disabled={creating}>
          {creating ? "Creating…" : "Create table"}
        </button>
      </div>

      <p className="hint">
        Open the table on a TV or tablet in the middle, then everyone joins by
        scanning the QR code with their phone.
      </p>
    </div>
  );
};

const NumberStepper = ({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => (
  <div className="stepper">
    <button
      type="button"
      className="btn stepper-btn"
      onClick={() => onChange(Math.max(min, value - 1))}
    >
      −
    </button>
    <span className="stepper-value">{value}</span>
    <button
      type="button"
      className="btn stepper-btn"
      onClick={() => onChange(Math.min(max, value + 1))}
    >
      +
    </button>
  </div>
);
