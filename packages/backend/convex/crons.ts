import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep hourly; a table untouched for a day is deleted with all its
// players, cards and events.
crons.interval("cleanup stale tables", { hours: 1 }, internal.cleanup.staleTables, {});

export default crons;
