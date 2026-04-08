import { gte, eq, sql, desc } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments, courses } from "~/db/schema";

// ─── Admin Analytics Service ───
// Platform-wide aggregation functions for the admin analytics dashboard.
// All functions accept a period string: "7d", "30d", "12m", or "all".

export type AnalyticsPeriod = "7d" | "30d" | "12m" | "all";

export function isValidPeriod(value: string): value is AnalyticsPeriod {
  return ["7d", "30d", "12m", "all"].includes(value);
}

function getPeriodCutoff(period: AnalyticsPeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "7d") {
    now.setDate(now.getDate() - 7);
  } else if (period === "30d") {
    now.setDate(now.getDate() - 30);
  } else if (period === "12m") {
    now.setMonth(now.getMonth() - 12);
  }
  return now.toISOString();
}

export function getAdminTotalRevenue(period: AnalyticsPeriod): number {
  const cutoff = getPeriodCutoff(period);
  const result = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(cutoff ? gte(purchases.createdAt, cutoff) : undefined)
    .get();
  return result?.total ?? 0;
}

export function getAdminTotalEnrollments(period: AnalyticsPeriod): number {
  const cutoff = getPeriodCutoff(period);
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(cutoff ? gte(enrollments.enrolledAt, cutoff) : undefined)
    .get();
  return result?.count ?? 0;
}

export type TopEarningCourse = {
  courseId: number;
  title: string;
  revenue: number;
};

export function getAdminTopEarningCourse(
  period: AnalyticsPeriod
): TopEarningCourse | null {
  const cutoff = getPeriodCutoff(period);
  const result = db
    .select({
      courseId: courses.id,
      title: courses.title,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(cutoff ? gte(purchases.createdAt, cutoff) : undefined)
    .groupBy(purchases.courseId)
    .orderBy(desc(sql<number>`sum(${purchases.pricePaid})`))
    .limit(1)
    .get();
  return result ?? null;
}
