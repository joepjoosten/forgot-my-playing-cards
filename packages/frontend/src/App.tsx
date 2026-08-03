import { useAtomValue } from "@effect/atom-react";
import { routeAtom } from "./route";
import { Home } from "./components/Home";
import { CreateTable } from "./components/CreateTable";
import { JoinTable } from "./components/JoinTable";
import { TableView } from "./components/TableView";
import { JoinPage } from "./components/JoinPage";
import { PlayerView } from "./components/PlayerView";
import type { PlayerId, TableId } from "./model";

export const App = () => {
  const route = useAtomValue(routeAtom);

  switch (route.kind) {
    case "home":
      return <Home params={route.params} />;
    case "create":
      return <CreateTable params={route.params} />;
    case "joincode":
      return <JoinTable params={route.params} />;
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
