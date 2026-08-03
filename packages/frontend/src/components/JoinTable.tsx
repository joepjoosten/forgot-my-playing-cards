import { useState } from "react";
import { api } from "@backend/convex/_generated/api";
import { convex } from "../convex";
import { navigate } from "../route";
import { langFromParam, t } from "../i18n";

export const JoinTable = ({ params }: { params?: URLSearchParams }) => {
  const [lang] = useState(() => langFromParam(params?.get("lang")));
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const joinByCode = async () => {
    if (lookingUp || joinCode.trim() === "") return;
    setLookingUp(true);
    setJoinError(false);
    try {
      const found = await convex.query(api.tables.byCode, { code: joinCode });
      if (found === null) {
        setJoinError(true);
      } else {
        navigate(`/join/${found._id}`);
      }
    } catch (error) {
      console.error(error);
      setJoinError(true);
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="page">
      <div className="screen-head">
        <button className="btn back-btn" onClick={() => navigate("/")}>
          {t(lang, "common.back")}
        </button>
        <h1 className="screen-title">{t(lang, "home.tileJoin")}</h1>
      </div>

      <div className="panel">
        <span className="panel-title">{t(lang, "home.joinTitle")}</span>
        <div className="join-code-row">
          <input
            className="join-code-input"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setJoinError(false);
            }}
            placeholder={t(lang, "home.joinCode")}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void joinByCode();
            }}
          />
          <button
            className="btn btn-primary btn-big"
            disabled={lookingUp || joinCode.trim() === ""}
            onClick={() => void joinByCode()}
          >
            {t(lang, "home.joinGo")}
          </button>
        </div>
        {joinError && <p className="join-error">{t(lang, "home.codeNotFound")}</p>}
      </div>

      <p className="hint">{t(lang, "home.hint")}</p>
    </div>
  );
};
