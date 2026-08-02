import { useState } from "react";
import { api } from "@backend/convex/_generated/api";
import { convex } from "../convex";
import { navigate } from "../route";
import { defaultConfig, type TableConfig } from "../model";
import { detectLanguage, languages, t, type Language } from "../i18n";

const shuffleKinds = ["riffle", "overhand", "fisher-yates", "cut", "none"] as const;

export const Home = ({ params }: { params?: URLSearchParams }) => {
  // The creating client's browser language is the starting point; the
  // switcher below changes this screen live and becomes the table language.
  const [lang, setLang] = useState(detectLanguage);
  const [name, setName] = useState(() => t(detectLanguage(), "home.defaultTableName"));
  const [config, setConfig] = useState<TableConfig>(defaultConfig);
  const [creating, setCreating] = useState(false);

  const patch = (partial: Partial<TableConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  const switchLanguage = (next: Language) => {
    // Carry the untouched default table name over to the new language.
    if (name === t(lang, "home.defaultTableName")) {
      setName(t(next, "home.defaultTableName"));
    }
    setLang(next);
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const tableId = await convex.mutation(api.tables.create, {
        name: name.trim() === "" ? t(lang, "home.fallbackTableName") : name.trim(),
        config,
        language: lang,
      });
      // dev.html hosts this form in an iframe (#/?dev=1) and spawns
      // player iframes once it learns the new table's id.
      if (params?.get("dev") === "1") {
        window.parent?.postMessage({ type: "fmpc:table-created", tableId }, "*");
      }
      navigate(`/table/${tableId}`);
    } catch (error) {
      console.error(error);
      setCreating(false);
    }
  };

  return (
    <div className="page home-page">
      <h1 className="app-title">🃏 Forgot My Playing Cards</h1>
      <p className="app-subtitle">{t(lang, "home.subtitle")}</p>

      <div className="panel">
        <label className="field">
          <span>🌐 {t(lang, "home.language")}</span>
          <select
            value={lang}
            onChange={(e) => switchLanguage(e.target.value as Language)}
          >
            {languages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t(lang, "home.tableName")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(lang, "home.tableNamePlaceholder")}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>{t(lang, "home.decks")}</span>
            <NumberStepper
              value={config.deckCount}
              min={1}
              max={8}
              onChange={(deckCount) => patch({ deckCount })}
            />
          </label>
          <label className="field">
            <span>{t(lang, "home.jokersPerDeck")}</span>
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
            <span>{t(lang, "home.shuffle")}</span>
            <select
              value={config.shuffle}
              onChange={(e) =>
                patch({ shuffle: e.target.value as TableConfig["shuffle"] })
              }
            >
              {shuffleKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {t(lang, `home.shuffle.${kind}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t(lang, "home.passes")}</span>
            <NumberStepper
              value={config.shufflePasses}
              min={1}
              max={20}
              onChange={(shufflePasses) => patch({ shufflePasses })}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{t(lang, "home.dealPerPlayer")}</span>
            <NumberStepper
              value={config.dealPerPlayer}
              min={0}
              max={30}
              onChange={(dealPerPlayer) => patch({ dealPerPlayer })}
            />
          </label>
          <label className="field">
            <span>{t(lang, "home.cardColors")}</span>
            <select
              value={config.fourColor === true ? "4" : "2"}
              onChange={(e) => patch({ fourColor: e.target.value === "4" })}
            >
              <option value="2">{t(lang, "home.colors2")}</option>
              <option value="4">{t(lang, "home.colors4")}</option>
            </select>
          </label>
        </div>

        <div className="field-row toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.stockPile}
              onChange={(e) => patch({ stockPile: e.target.checked })}
            />
            <span>{t(lang, "home.stockPile")}</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.burnPile}
              disabled={config.playToBoard === false}
              onChange={(e) => patch({ burnPile: e.target.checked })}
            />
            <span>{t(lang, "home.burnPile")}</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.playToBoard !== false}
              onChange={(e) =>
                // Burn-only tables need the burn pile: cards must go somewhere.
                patch(
                  e.target.checked
                    ? { playToBoard: true }
                    : { playToBoard: false, burnPile: true },
                )
              }
            />
            <span>{t(lang, "home.playToBoard")}</span>
          </label>
          {config.playToBoard !== false && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.playFaceUp}
                onChange={(e) => patch({ playFaceUp: e.target.checked })}
              />
              <span>{t(lang, "home.playFaceUp")}</span>
            </label>
          )}
        </div>

        <button className="btn btn-primary btn-big" onClick={create} disabled={creating}>
          {creating ? t(lang, "home.creating") : t(lang, "home.create")}
        </button>
      </div>

      <p className="hint">{t(lang, "home.hint")}</p>
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
