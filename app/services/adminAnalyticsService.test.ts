import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getAdminTotalRevenue,
  getAdminTotalEnrollments,
  getAdminTopEarningCourse,
} from "./adminAnalyticsService";

describe("adminAnalyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── getAdminTotalRevenue ───

  describe("getAdminTotalRevenue", () => {
    it("returns 0 when there are no purchases", () => {
      expect(getAdminTotalRevenue("all")).toBe(0);
    });

    it("sums all purchase prices across courses", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: "US" })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.instructor.id, courseId: base.course.id, pricePaid: 2999, country: "GB" })
        .run();
      expect(getAdminTotalRevenue("all")).toBe(7998);
    });

    it("filters by 30d period excluding old purchases", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 5);
      const old = new Date();
      old.setDate(old.getDate() - 60);

      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, country: "US", createdAt: recent.toISOString() })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.instructor.id, courseId: base.course.id, pricePaid: 3000, country: "US", createdAt: old.toISOString() })
        .run();

      expect(getAdminTotalRevenue("30d")).toBe(5000);
    });

    it("filters by 7d period", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 3);
      const older = new Date();
      older.setDate(older.getDate() - 10);

      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4000, country: "US", createdAt: recent.toISOString() })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.instructor.id, courseId: base.course.id, pricePaid: 6000, country: "US", createdAt: older.toISOString() })
        .run();

      expect(getAdminTotalRevenue("7d")).toBe(4000);
    });

    it("returns all revenue for 'all' period", () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 3);

      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 9999, country: "US", createdAt: old.toISOString() })
        .run();

      expect(getAdminTotalRevenue("all")).toBe(9999);
    });
  });

  // ─── getAdminTotalEnrollments ───

  describe("getAdminTotalEnrollments", () => {
    it("returns 0 when there are no enrollments", () => {
      expect(getAdminTotalEnrollments("all")).toBe(0);
    });

    it("counts all enrollments across courses", () => {
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.instructor.id, courseId: base.course.id })
        .run();
      expect(getAdminTotalEnrollments("all")).toBe(2);
    });

    it("filters enrollments by 30d period", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 10);
      const old = new Date();
      old.setDate(old.getDate() - 60);

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id, enrolledAt: recent.toISOString() })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.instructor.id, courseId: base.course.id, enrolledAt: old.toISOString() })
        .run();

      expect(getAdminTotalEnrollments("30d")).toBe(1);
    });
  });

  // ─── getAdminTopEarningCourse ───

  describe("getAdminTopEarningCourse", () => {
    it("returns null when there are no purchases", () => {
      expect(getAdminTopEarningCourse("all")).toBeNull();
    });

    it("returns the course with highest total revenue", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, country: "US" })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.instructor.id, courseId: course2.id, pricePaid: 8000, country: "US" })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: course2.id, pricePaid: 3000, country: "US" })
        .run();

      const top = getAdminTopEarningCourse("all");
      expect(top).not.toBeNull();
      expect(top!.courseId).toBe(course2.id);
      expect(top!.title).toBe("Second Course");
      expect(top!.revenue).toBe(11000);
    });

    it("filters by period when finding top earner", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 5);
      const old = new Date();
      old.setDate(old.getDate() - 60);

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Recent Course",
          slug: "recent-course",
          description: "A recent course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      // base.course has old revenue (outside 30d)
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 99000, country: "US", createdAt: old.toISOString() })
        .run();
      // course2 has recent revenue
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: course2.id, pricePaid: 5000, country: "US", createdAt: recent.toISOString() })
        .run();

      const top = getAdminTopEarningCourse("30d");
      expect(top).not.toBeNull();
      expect(top!.courseId).toBe(course2.id);
    });
  });
});
