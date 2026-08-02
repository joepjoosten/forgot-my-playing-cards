# 🃏 Forgot My Playing Cards

A shared, realtime card table for playing **any** card game. The table never
knows the rules — it only handles the *way* of playing: how many decks, how to
shuffle (riffle, overhand, cut, perfect random), how many cards to deal, and
which piles live on the board (a stock pile to draw from, a burn pile to
discard to).

- A **table** runs on a TV / tablet / laptop in the middle.
- **Players** join by scanning a QR code with their phone.
- Each player sees their own hand on their phone, can sort it by dragging and
  *throw* cards onto the table with an upward flick.
- On the table, cards and players can be dragged around freely; players can be
  snapped into a circle when a round starts.

Everything is synchronized in realtime through [Convex](https://convex.dev).

## Stack

| Piece | Tech |
| --- | --- |
| Backend (`packages/backend`) | Convex functions, [Effect](https://effect.website) **v4 beta** for the deck building / shuffling / dealing programs |
| Frontend (`packages/frontend`) | React 19 + Vite, [`@effect-atom/atom-react`](https://github.com/tim-smart/effect-atom) (Effect v3) for state, `qrcode` for joining |
| Hosting | GitHub Pages (frontend) + Convex Cloud (backend), deployed by GitHub Actions |

> **Why two Effect versions?** `@effect-atom/atom-react` currently peers on
> Effect v3. The root of the workspace pins `effect@^3` (hoisted, used by the
> frontend), while `packages/backend` depends on `effect@4.0.0-beta.x`, which
> npm nests under `packages/backend/node_modules`. Both sides import plain
> `"effect"` and get the right version.

## Local development

```sh
npm install
npm run dev
```

`npm run dev` starts `convex dev` (which asks you to log in the first time and
writes `.env.local` with your dev deployment URL) plus the Vite dev server.

Then open:

- `http://localhost:5173/dev.html` — **the local multi-player test page**: the
  table in one iframe and two players in separate iframes (each its own
  session). Use *＋ Add player* for more.
- `http://localhost:5173/` — create a table normally.

## Deployment (GitHub Pages + Convex)

Pushing to `main` runs `.github/workflows/deploy.yml`, which:

1. deploys the Convex functions (`npx convex deploy`),
2. builds the frontend with the production Convex URL injected,
3. publishes `packages/frontend/dist` to GitHub Pages.

One-time repository setup:

1. **Settings → Pages** → *Build and deployment* → Source: **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add secret
   `CONVEX_DEPLOY_KEY` — generate it in the
   [Convex dashboard](https://dashboard.convex.dev) under
   *Project settings → Deploy keys* (production deploy key).

The production Convex deployment URL
(`https://clear-loris-51.eu-west-1.convex.cloud`) is committed in `.env` as the
default frontend target; `convex dev` overrides it locally via `.env.local`.

## How a table works

1. **Create a table** — choose decks, jokers, shuffle style + passes, cards
   dealt per player, and which piles exist. No rules are enforced, ever.
2. **Players scan the QR code** and join on their phones.
3. **Deal & start** — decks are built and shuffled by an Effect program
   (seeded, deterministic per round), every player gets their cards, the rest
   becomes the stock pile (or is scattered face-down on the board if the table
   has no stock pile), and players are arranged in a circle.
4. **Play** — phones: drag to sort, flick up to throw a card on the table,
   draw from stock, take or discard to the burn pile. Table: drag cards and
   players around, tap a card to flip it, gather all played cards to the burn
   pile or under the stock, start the next round.

## Repository layout

```
convex.json               → points the Convex CLI at packages/backend/convex
packages/
  backend/convex/         → schema + queries/mutations (tables, players, cards)
  backend/convex/lib/     → Effect v4 programs: decks, shuffles, dealing
  frontend/src/           → React app (table view, player view, join, home)
  frontend/dev.html       → local multi-iframe test page
.github/workflows/        → CI + Pages/Convex deployment
```
