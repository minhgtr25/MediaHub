import { Router } from "express";
import { z } from "zod";
import { db, result } from "./db.js";
import { send } from "./utils/response.js";

export const publicVisitRoutes = Router();
export const adminVisitRoutes = Router();

const visitPayload = z.object({ session_id: z.uuid() }).strict();
const visitFilters = z
  .object({ period: z.enum(["day", "week"]).default("day") })
  .strict();

function vietnamDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateFromIso(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function isoFromDate(day: Date) {
  return day.toISOString().slice(0, 10);
}

function mondayOf(day: string) {
  const date = dateFromIso(day);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return isoFromDate(date);
}

publicVisitRoutes.post("/visits", async (req, res) => {
  const { session_id } = visitPayload.parse(req.body);
  const recorded = await result(
    db.rpc("record_site_visit", { visitor_session: session_id }),
  );
  send(res, { recorded });
});

adminVisitRoutes.get("/visit-analytics", async (req, res) => {
  const { period } = visitFilters.parse(req.query);
  const today = vietnamDay();
  const first = dateFromIso(period === "week" ? mondayOf(today) : today);
  first.setUTCDate(first.getUTCDate() - (period === "week" ? 77 : 29));
  const dailyResult = await result(
    db.rpc("admin_visit_daily", {
      from_day: isoFromDate(first),
      through_day: today,
    }),
  );
  const daily = dailyResult ?? [];
  const points =
    period === "day"
      ? daily.map((row) => ({
          start: row.visit_day,
          real: Number(row.visits),
          demo: Number(row.demo_visits),
        }))
      : Array.from(
          daily
            .reduce((groups, row) => {
              const start = mondayOf(row.visit_day);
              const point = groups.get(start) ?? { start, real: 0, demo: 0 };
              point.real += Number(row.visits);
              point.demo += Number(row.demo_visits);
              groups.set(start, point);
              return groups;
            }, new Map<string, { start: string; real: number; demo: number }>())
            .values(),
        );
  send(res, {
    period,
    timezone: "Asia/Ho_Chi_Minh",
    points,
    total_real: points.reduce((sum, point) => sum + point.real, 0),
    current_real: points.at(-1)?.real ?? 0,
    total_demo: points.reduce((sum, point) => sum + point.demo, 0),
  });
});
