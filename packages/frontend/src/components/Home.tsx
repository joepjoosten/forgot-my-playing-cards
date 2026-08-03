import { useState } from "react";
import { navigate } from "../route";
import { langFromParam, languages, t, type Language } from "../i18n";

export const Home = ({ params }: { params?: URLSearchParams }) => {
  // Landing screen: pick a table to join or make a new one. The language chosen
  // here is carried over to whichever screen you open next.
  const [lang, setLang] = useState(() => langFromParam(params?.get("lang")));

  const go = (path: string) => {
    const query = new URLSearchParams();
    query.set("lang", lang);
    // Keep the dev flag alive so the local test page keeps working.
    if (params?.get("dev") === "1") query.set("dev", "1");
    navigate(`/${path}?${query.toString()}`);
  };

  return (
    <div className="page home-page">
      <header className="home-bar">
        <h1 className="home-bar-title">🃏 Forgot My Playing Cards</h1>
        <select
          className="lang-select home-bar-lang"
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
          aria-label={t(lang, "home.language")}
        >
          {languages.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </header>

      <div className="home-tiles">
        <button className="home-tile" onClick={() => go("joincode")}>
          <span className="home-tile-icon">🚪</span>
          <span className="home-tile-label">{t(lang, "home.tileJoin")}</span>
          <span className="home-tile-sub">{t(lang, "home.tileJoinSub")}</span>
        </button>
        <button className="home-tile" onClick={() => go("create")}>
          <span className="home-tile-icon">➕</span>
          <span className="home-tile-label">{t(lang, "home.tileCreate")}</span>
          <span className="home-tile-sub">{t(lang, "home.tileCreateSub")}</span>
        </button>
      </div>

      {/* Room for later: recent tables, rules, a strip of small tabs, … */}
      <div className="home-extra" />
    </div>
  );
};
