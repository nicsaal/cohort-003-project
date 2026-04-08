import { Link } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getAdminTotalRevenue,
  getAdminTotalEnrollments,
  getAdminTopEarningCourse,
  isValidPeriod,
  type AnalyticsPeriod,
} from "~/services/adminAnalyticsService";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent } from "~/components/ui/card";
import { AlertTriangle, BarChart2, BookOpen, Users } from "lucide-react";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "12m", label: "12m" },
  { value: "all", label: "All" },
];

export function meta() {
  return [
    { title: "Analytics — Cadence Admin" },
    { name: "description", content: "Platform-wide analytics dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period") ?? "30d";
  const period: AnalyticsPeriod = isValidPeriod(rawPeriod) ? rawPeriod : "30d";

  const totalRevenue = getAdminTotalRevenue(period);
  const totalEnrollments = getAdminTotalEnrollments(period);
  const topCourse = getAdminTopEarningCourse(period);

  return { period, totalRevenue, totalEnrollments, topCourse };
}

export default function AdminAnalyticsPage({
  loaderData,
}: Route.ComponentProps) {
  const { period, totalRevenue, totalEnrollments, topCourse } = loaderData;
  const isEmpty = totalRevenue === 0 && totalEnrollments === 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide revenue and enrollment data
        </p>
      </div>

      {/* Time period tabs */}
      <div className="flex gap-1 rounded-md border border-border bg-muted p-1 w-fit">
        {PERIODS.map(({ value, label }) => (
          <Link
            key={value}
            to={`?period=${value}`}
            className={
              period === value
                ? "rounded px-3 py-1.5 text-sm font-medium bg-background shadow-sm text-foreground"
                : "rounded px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <BarChart2 className="size-10 text-muted-foreground/50 mb-3" />
          <h2 className="text-lg font-semibold">No data yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue and enrollment data will appear here once students start
            purchasing courses.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Total Revenue */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </span>
                <BookOpen className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-3xl font-bold">
                {formatPrice(totalRevenue)}
              </div>
            </CardContent>
          </Card>

          {/* Total Enrollments */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Enrollments
                </span>
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-3xl font-bold">{totalEnrollments}</div>
            </CardContent>
          </Card>

          {/* Top Earning Course */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Top Earning Course
                </span>
                <BarChart2 className="size-4 text-muted-foreground" />
              </div>
              {topCourse ? (
                <>
                  <div className="mt-2 text-lg font-bold leading-tight truncate">
                    {topCourse.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatPrice(topCourse.revenue)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  No purchases yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="size-10 text-destructive mb-3" />
        <h2 className="text-lg font-semibold">{error.status} Error</h2>
        <p className="text-sm text-muted-foreground mt-1">{error.data}</p>
      </div>
    );
  }
  return (
    <div className="p-12 text-center">
      <AlertTriangle className="size-10 text-destructive mb-3 mx-auto" />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
    </div>
  );
}
