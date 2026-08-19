/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cards from "../cards.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_deck from "../lib/deck.js";
import type * as lib_layout from "../lib/layout.js";
import type * as lib_zones from "../lib/zones.js";
import type * as players from "../players.js";
import type * as tables from "../tables.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cards: typeof cards;
  cleanup: typeof cleanup;
  crons: typeof crons;
  events: typeof events;
  "lib/activity": typeof lib_activity;
  "lib/deck": typeof lib_deck;
  "lib/layout": typeof lib_layout;
  "lib/zones": typeof lib_zones;
  players: typeof players;
  tables: typeof tables;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
