import { Atom } from "@effect-atom/atom-react";

export type Route =
  | { kind: "home" }
  | { kind: "dev-new" }
  | { kind: "table"; tableId: string }
  | { kind: "join"; tableId: string; params: URLSearchParams }
  | { kind: "play"; tableId: string; playerId: string };

export const parseHash = (hash: string): Route => {
  const [path, search] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(search ?? "");
  const parts = (path ?? "").split("/").filter((p) => p.length > 0);

  switch (parts[0]) {
    case "dev-new":
      return { kind: "dev-new" };
    case "table":
      if (parts[1] !== undefined) return { kind: "table", tableId: parts[1] };
      break;
    case "join":
      if (parts[1] !== undefined)
        return { kind: "join", tableId: parts[1], params };
      break;
    case "play":
      if (parts[1] !== undefined && parts[2] !== undefined)
        return { kind: "play", tableId: parts[1], playerId: parts[2] };
      break;
  }
  return { kind: "home" };
};

export const routeAtom: Atom.Atom<Route> = Atom.make((get) => {
  const onHashChange = () => {
    get.setSelf(parseHash(window.location.hash));
  };
  window.addEventListener("hashchange", onHashChange);
  get.addFinalizer(() => window.removeEventListener("hashchange", onHashChange));
  return parseHash(window.location.hash);
});

export const navigate = (hash: string): void => {
  window.location.hash = hash;
};

/** Absolute link to a route, usable outside the app (QR codes). */
export const absoluteLink = (hash: string): string => {
  const base = new URL(".", window.location.href);
  return `${base.href}#${hash}`;
};
