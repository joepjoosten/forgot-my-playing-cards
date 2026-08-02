import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "@effect-atom/atom-react";
import { api } from "@backend/convex/_generated/api";
import { convex, convexQuery } from "../convex";
import { navigate } from "../route";
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
        name: joinName.trim() === "" ? "Player" : joinName.trim(),
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
    return <div className="page center">Loading table…</div>;
  }
  if (table === null) {
    return <div className="page center">This table no longer exists.</div>;
  }

  return (
    <div className="page join-page">
      <h1 className="app-title">🃏 {table.name}</h1>
      <div className="panel">
        <label className="field">
          <span>Your name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
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
          {joining ? "Joining…" : "Join table"}
        </button>
        {existing !== null && (
          <button
            className="btn btn-big"
            onClick={() => navigate(`/play/${tableId}/${existing}`)}
          >
            Continue previous session
          </button>
        )}
      </div>
    </div>
  );
};
