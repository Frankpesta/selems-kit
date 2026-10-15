import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Schedules are in UTC; Lagos is UTC+1 all year (docs/04 "Crons").
const crons = cronJobs();

crons.hourly("flagLateArrivals", { minuteUTC: 5 }, internal.jobs.flagLateArrivals, {});
crons.daily("preArrivalReminders", { hourUTC: 8, minuteUTC: 0 }, internal.jobs.preArrivalReminders, {});
crons.daily("reviewRequests", { hourUTC: 11, minuteUTC: 0 }, internal.jobs.reviewRequests, {});
crons.daily("expireInvites", { hourUTC: 2, minuteUTC: 0 }, internal.jobs.expireInvites, {});

export default crons;
