import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convex, convexQuery } from "../convex";
import { navigate } from "../route";
import { detectLanguage, t } from "../i18n";
import { storedNameKey, storedPlayerKey, type PlayerId, type TableId } from "../model";

export const JoinPage = ({
  tableId,
  params,
}: {
  tableId: TableId;
  params: URLSearchParams;
}) => {
  const table = useAtomValue(convexQuery(api.tables.get, { tableId }));
  const [name, setName] = useState(
    () => params.get("name") ?? localStorage.getItem(storedNameKey) ?? "",
  );
  const [joining, setJoining] = useState(false);
  // Scanning the QR again (or refreshing) must not create a second player:
  // with a stored player for this table, the form stays hidden while we
  // check the server and hop straight back into that session. The dev
  // harness (auto=1) skips this — its iframes share localStorage.
  const [rejoining, setRejoining] = useState(
    () =>
      params.get("auto") !== "1" &&
      localStorage.getItem(storedPlayerKey(tableId)) !== null,
  );
  const autoRef = useRef(false);

  useEffect(() => {
    if (!rejoining) return;
    const existing = localStorage.getItem(storedPlayerKey(tableId));
    if (existing === null) {
      setRejoining(false);
      return;
    }
    convex
      .query(api.players.get, { playerId: existing as PlayerId })
      .then((player) => {
        if (player !== null && player.tableId === tableId) {
          navigate(`/play/${tableId}/${existing}`);
        } else {
          // The stored player is gone (left, or the table was cleaned up).
          localStorage.removeItem(storedPlayerKey(tableId));
          setRejoining(false);
        }
      })
      .catch(() => {
        localStorage.removeItem(storedPlayerKey(tableId));
        setRejoining(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = async (joinName: string) => {
    if (joining) return;
    setJoining(true);
    try {
      const trimmed = joinName.trim();
      const playerId = await convex.mutation(api.players.join, {
        tableId,
        name:
          trimmed === ""
            ? t(table?.language ?? detectLanguage(), "join.defaultPlayerName")
            : trimmed,
      });
      localStorage.setItem(storedPlayerKey(tableId), playerId);
      if (trimmed !== "") localStorage.setItem(storedNameKey, trimmed);
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

  if (table === undefined || rejoining) {
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
      </div>
    </div>
  );
};
