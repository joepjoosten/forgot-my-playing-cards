import { useAtomValue } from "@effect-atom/atom-react";
import { routeAtom } from "./route";
import { Home } from "./components/Home";
import { DevNew } from "./components/DevNew";
import { TableView } from "./components/TableView";
import { JoinPage } from "./components/JoinPage";
import { PlayerView } from "./components/PlayerView";
import type { PlayerId, TableId } from "./model";

export const App = () => {
  const route = useAtomValue(routeAtom);

  switch (route.kind) {
    case "home":
      return <Home />;
    case "dev-new":
      return <DevNew />;
    case "table":
      return <TableView tableId={route.tableId as TableId} />;
    case "join":
      return <JoinPage tableId={route.tableId as TableId} params={route.params} />;
    case "play":
      return (
        <PlayerView
          tableId={route.tableId as TableId}
          playerId={route.playerId as PlayerId}
        />
      );
  }
};
