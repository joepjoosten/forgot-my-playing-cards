import { useState, type ReactNode } from "react";
import { api } from "@backend/convex/_generated/api";
import { convex } from "../convex";
import { navigate } from "../route";
import { defaultConfig, type TableConfig } from "../model";
import { presets, matchingPresetId, type Preset } from "../presets";
import { langFromParam, languages, t, type Language } from "../i18n";

const shuffleKinds = ["riffle", "overhand", "fisher-yates", "cut", "none"] as const;
const deckTypes = ["standard", "uno"] as const;

export const CreateTable = ({ params }: { params?: URLSearchParams }) => {
  // The creating client's browser language (or the one carried over from the
  // landing screen) is the starting point; the switcher below changes this
  // screen live and becomes the table language.
  const [lang, setLang] = useState(() => langFromParam(params?.get("lang")));
  const [name, setName] = useState(() =>
    t(langFromParam(params?.get("lang")), "home.defaultTableName"),
  );
  const [config, setConfig] = useState<TableConfig>(defaultConfig);
  const [creating, setCreating] = useState(false);
  // Which accordion sections are expanded. Cards is open to start with.
  const [open, setOpen] = useState<Record<string, boolean>>({ cards: true });

  const isUno = config.deckType === "uno";
  // Highlight a preset only while the config still matches it exactly; any
  // manual tweak below makes the config diverge and clears the highlight.
  const activePreset = matchingPresetId(config);

  const toggle = (id: string) =>
    setOpen((o) => ({ ...o, [id]: o[id] !== true }));

  const patch = (partial: Partial<TableConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  // Presets fill only the settings, never the table name.
  const applyPreset = (p: Preset) => setConfig(p.config);

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
      // dev.html hosts this form in an iframe (#/create?dev=1) and spawns
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
    <div className="page">
      <div className="screen-head">
        <button className="btn back-btn" onClick={() => navigate("/")}>
          {t(lang, "common.back")}
        </button>
        <h1 className="screen-title">{t(lang, "home.tileCreate")}</h1>
      </div>

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
      </div>

      <div className="panel preset-panel">
        <span className="panel-title">{t(lang, "home.presets")}</span>
        <div className="preset-row">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`preset-chip${activePreset === p.id ? " is-active" : ""}`}
              onClick={() => applyPreset(p)}
            >
              <span className="preset-chip-icon">{p.icon}</span>
              <span>{t(lang, p.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel accordion">
        <Section
          id="cards"
          title={t(lang, "home.sectionCards")}
          open={open.cards === true}
          onToggle={toggle}
        >
          <label className="field">
            <span>{t(lang, "home.deckType")}</span>
            <select
              value={config.deckType ?? "standard"}
              onChange={(e) =>
                patch({ deckType: e.target.value as TableConfig["deckType"] })
              }
            >
              {deckTypes.map((kind) => (
                <option key={kind} value={kind}>
                  {t(lang, kind === "uno" ? "home.deckUno" : "home.deckStandard")}
                </option>
              ))}
            </select>
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
            {!isUno && (
              <label className="field">
                <span>{t(lang, "home.jokersPerDeck")}</span>
                <NumberStepper
                  value={config.jokersPerDeck}
                  min={0}
                  max={4}
                  onChange={(jokersPerDeck) => patch({ jokersPerDeck })}
                />
              </label>
            )}
          </div>

          {isUno ? (
            <p className="section-note">{t(lang, "home.unoNote")}</p>
          ) : (
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
          )}
        </Section>

        <Section
          id="shuffle"
          title={t(lang, "home.sectionShuffle")}
          open={open.shuffle === true}
          onToggle={toggle}
        >
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

          <label className="field">
            <span>{t(lang, "home.dealPerPlayer")}</span>
            <NumberStepper
              value={config.dealPerPlayer}
              min={0}
              max={30}
              onChange={(dealPerPlayer) => patch({ dealPerPlayer })}
            />
          </label>
        </Section>

        <Section
          id="board"
          title={t(lang, "home.sectionBoard")}
          open={open.board === true}
          onToggle={toggle}
        >
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
        </Section>
      </div>

      <button className="btn btn-primary btn-big create-btn" onClick={create} disabled={creating}>
        {creating ? t(lang, "home.creating") : t(lang, "home.create")}
      </button>

      <p className="hint">{t(lang, "home.hint")}</p>
    </div>
  );
};

const Section = ({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) => (
  <div className={`accordion-item${open ? " is-open" : ""}`}>
    <button
      type="button"
      className="accordion-header"
      aria-expanded={open}
      onClick={() => onToggle(id)}
    >
      <span>{title}</span>
      <span className="accordion-chevron">▾</span>
    </button>
    {open && <div className="accordion-body">{children}</div>}
  </div>
);

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
