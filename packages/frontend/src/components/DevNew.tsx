import { useEffect, useRef } from "react";
import { api } from "@backend/convex/_generated/api";
import { convex } from "../convex";
import { navigate } from "../route";
import { defaultConfig } from "../model";
import { detectLanguage, t } from "../i18n";

/**
 * Used by dev.html: creates a fresh table, tells the parent window about it
 * (so it can spawn player iframes) and turns into the table view.
 */
export const DevNew = () => {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    convex
      .mutation(api.tables.create, {
        name: "Dev table",
        config: { ...defaultConfig, dealPerPlayer: 7 },
        language: detectLanguage(),
      })
      .then((tableId) => {
        window.parent?.postMessage({ type: "fmpc:table-created", tableId }, "*");
        navigate(`/table/${tableId}`);
      })
      .catch(console.error);
  }, []);

  return <div className="page center">{t(detectLanguage(), "dev.creating")}</div>;
};
