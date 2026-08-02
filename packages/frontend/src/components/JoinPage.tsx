import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convex, convexQuery } from "../convex";
import { navigate } from "../route";
import { detectLanguage, t } from "../i18n";
import { storedPlayerKey, type TableId } from "../model";

export const JoinPage = ({
  tableId,
  params,
}: {
  tableId: TableId;
  params: URLSearchParams;
}) => {
  const table = useAtomValue(convexQuery(api.tables.get, { tableId }));
  const [name, setName] = useState(params.get("name") ?? "");
  const [joining, setJoining] = useState(false);
  const autoRef = useRef(false);

  const existing = localStorage.getItem(storedPlayerKey(tableId));

  const join = async (joinName: string) => {
    if (joining) return;
    setJoining(true);
    try {
      const playerId = await convex.mutation(api.players.join, {
        tableId,
        name:
          joinName.trim() === ""
            ? t(table?.language ?? detectLanguage(), "join.defaultPlayerName")
            : joinName.trim(),
      });
      localStorage.setItem(storedPlayerKey(tableId), playerId);
      navigate(`/play/${tableId}/${playerId}`);
    } catch (error) {
      console.error(error);
      setJoining(false);
    }
  };

  // dev.html joins players automatically: #/join/<id>?name=Player%201&auto=1
  useEffect(() => {
    if (params.get("auto") === "1" && !autoRef.current) {
      autoRef.current = true;
      void join(params.get("name") ?? "Player");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (table === undefined) {
    return <div className="page center">{t(detectLanguage(), "table.loading")}</div>;
  }
  if (table === null) {
    return <div className="page center">{t(detectLanguage(), "table.gone")}</div>;
  }

  const lang = table.language ?? "en";

  return (
    <div className="page join-page">
      <h1 className="app-title">🃏 {table.name}</h1>
      <div className="panel">
        <label className="field">
          <span>{t(lang, "join.yourName")}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(lang, "join.yourName")}
            onKeyDown={(e) => {
              if (e.key === "Enter") void join(name);
            }}
          />
        </label>
        <button
          className="btn btn-primary btn-big"
          disabled={joining}
          onClick={() => void join(name)}
        >
          {joining ? t(lang, "join.joining") : t(lang, "join.join")}
        </button>
        {existing !== null && (
          <button
            className="btn btn-big"
            onClick={() => navigate(`/play/${tableId}/${existing}`)}
          >
            {t(lang, "join.continue")}
          </button>
        )}
      </div>
    </div>
  );
};
