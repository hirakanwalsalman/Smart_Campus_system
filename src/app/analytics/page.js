"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ClipboardList, CircleCheck, Timer, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import StatCard from "@/components/StatCard";

const DAY = 24 * 60 * 60 * 1000;

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

const STATUS_COLORS = {
  Pending: "#f59e0b",
  "In progress": "#3b82f6",
  Resolved: "#22c55e",
};

const BLUE = "#2563eb";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-GB",
    { month: "short", year: "2-digit" }
  );
}

function buildMonthKeys(start, end) {
  const keys = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (d <= last) {
    keys.push(monthKey(d));
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

// The database returns at most 1000 rows per request, so we ask page by page
async function fetchAllComplaints(supabase) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const { data, error } = await supabase
      .from("complaints")
      .select(
        "id, status, priority, created_at, resolved_at, equipment_id, equipment(code, name, category)"
      )
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Turns the raw complaints into the numbers the charts need
function analyse(complaints, range) {
  const now = new Date();
  const cutoff =
    range === "all" ? null : new Date(now.getTime() - Number(range) * DAY);

  const list = complaints.filter(
    (c) => !cutoff || new Date(c.created_at) >= cutoff
  );

  // Status counts
  const statusCounts = { pending: 0, in_progress: 0, resolved: 0 };
  list.forEach((c) => {
    if (statusCounts[c.status] !== undefined) statusCounts[c.status] += 1;
  });

  // Resolution times (resolved complaints only)
  const resolvedWithDates = list.filter(
    (c) => c.status === "resolved" && c.resolved_at
  );
  const daysToResolve = (c) =>
    (new Date(c.resolved_at) - new Date(c.created_at)) / DAY;
  const avgResolution =
    resolvedWithDates.length > 0
      ? resolvedWithDates.reduce((sum, c) => sum + daysToResolve(c), 0) /
        resolvedWithDates.length
      : null;

  // Per month
  let start = cutoff;
  if (!start) {
    start =
      list.length > 0
        ? new Date(Math.min(...list.map((c) => new Date(c.created_at).getTime())))
        : now;
  }
  const keys = buildMonthKeys(start, now);
  const received = {};
  const resolvedPerMonth = {};
  list.forEach((c) => {
    const k = monthKey(new Date(c.created_at));
    received[k] = (received[k] ?? 0) + 1;
    if (c.resolved_at) {
      const rk = monthKey(new Date(c.resolved_at));
      resolvedPerMonth[rk] = (resolvedPerMonth[rk] ?? 0) + 1;
    }
  });
  const perMonth = keys.map((k) => ({
    month: monthLabel(k),
    Received: received[k] ?? 0,
    Resolved: resolvedPerMonth[k] ?? 0,
  }));

  // By category
  const categoryMap = {};
  list.forEach((c) => {
    const category = c.equipment?.category ?? "Unknown";
    if (!categoryMap[category]) {
      categoryMap[category] = { category, count: 0, days: 0, resolved: 0 };
    }
    categoryMap[category].count += 1;
    if (c.status === "resolved" && c.resolved_at) {
      categoryMap[category].days += daysToResolve(c);
      categoryMap[category].resolved += 1;
    }
  });
  const categories = Object.values(categoryMap);
  const byCategory = [...categories]
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ category: c.category, Complaints: c.count }));
  const resolutionByCategory = categories
    .filter((c) => c.resolved > 0)
    .map((c) => ({
      category: c.category,
      "Average days": Number((c.days / c.resolved).toFixed(1)),
    }))
    .sort((a, b) => b["Average days"] - a["Average days"]);

  // By equipment (recurring faults and estimated downtime)
  const equipmentMap = {};
  list.forEach((c) => {
    const key = c.equipment_id;
    if (!equipmentMap[key]) {
      equipmentMap[key] = {
        label: c.equipment?.code ?? "?",
        name: c.equipment?.name ?? "",
        count: 0,
        downtime: 0,
      };
    }
    equipmentMap[key].count += 1;
    const end = c.resolved_at ? new Date(c.resolved_at) : now;
    equipmentMap[key].downtime += (end - new Date(c.created_at)) / DAY;
  });
  const equipmentList = Object.values(equipmentMap);

  const topByComplaints = [...equipmentList]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e) => ({ label: e.label, name: e.name, Complaints: e.count }));

  const topByDowntime = [...equipmentList]
    .sort((a, b) => b.downtime - a.downtime)
    .slice(0, 10)
    .map((e) => ({
      label: e.label,
      name: e.name,
      "Days open": Number(e.downtime.toFixed(1)),
    }));

  const recurringCount = equipmentList.filter((e) => e.count >= 3).length;

  return {
    total: list.length,
    statusCounts,
    avgResolution,
    perMonth,
    byCategory,
    resolutionByCategory,
    topByComplaints,
    topByDowntime,
    recurringCount,
  };
}

function ChartCard({ title, note, empty, children }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      <div className="mt-4 h-72">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// Shows "PC-001 - Dell OptiPlex Desktop" when you hover over a bar
function equipmentTooltipLabel(label, payload) {
  const name = payload?.[0]?.payload?.name;
  return name ? `${label} - ${name}` : label;
}

export default function AnalyticsPage() {
  const { loading, profile } = useProfile();
  const [complaints, setComplaints] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("365");

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    async function load() {
      try {
        const supabase = createClient();
        const data = await fetchAllComplaints(supabase);
        setComplaints(data);
      } catch (e) {
        setError("Could not load the data: " + e.message);
      }
      setFetching(false);
    }
    load();
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="rounded-xl bg-white p-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
          Only admins can view analytics.
        </p>
      </div>
    );
  }

  const stats = analyse(complaints, range);
  const resolvedPercent =
    stats.total > 0
      ? Math.round((stats.statusCounts.resolved / stats.total) * 100)
      : 0;

  const statusData = [
    { name: "Pending", value: stats.statusCounts.pending },
    { name: "In progress", value: stats.statusCounts.in_progress },
    { name: "Resolved", value: stats.statusCounts.resolved },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-blue-700">Analytics</h1>
      <p className="mt-1 text-slate-600">
        See how many problems are reported, how fast they are fixed, and which
        equipment causes the most trouble.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Date filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        {RANGES.map((option) => (
          <button
            key={option.value}
            onClick={() => setRange(option.value)}
            className={`rounded-full px-4 py-1 text-sm font-medium ${
              range === option.value
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 shadow hover:bg-slate-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {fetching ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : stats.total === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          No complaints were reported in this period.
        </p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={ClipboardList} label="Complaints in this period" value={stats.total} tone="slate" />
            <StatCard icon={CircleCheck} label={`Resolved (${resolvedPercent}%)`} value={stats.statusCounts.resolved} tone="green" />
            <StatCard
              icon={Timer}
              label="Average time to resolve"
              value={stats.avgResolution === null ? "-" : `${stats.avgResolution.toFixed(1)} days`}
              tone="amber"
            />
            <StatCard icon={TriangleAlert} label="Equipment with 3+ complaints" value={stats.recurringCount} tone="red" />
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <ChartCard title="Complaints per month" empty={stats.perMonth.length === 0 ? "No data." : null}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.perMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Received" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Resolved" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Complaints by status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Complaints by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byCategory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" interval={0} angle={-25} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="Complaints" fill={BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Recurring faults: top 10 equipment"
              note="Equipment with the most complaints in this period."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topByComplaints} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={equipmentTooltipLabel} />
                  <Bar dataKey="Complaints" fill={RED} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Average resolution time by category"
              note="Days from report to resolution (resolved complaints only)."
              empty={stats.resolutionByCategory.length === 0 ? "No resolved complaints in this period." : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.resolutionByCategory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" interval={0} angle={-25} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="Average days" fill={AMBER} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Estimated downtime: top 10 equipment"
              note="Estimate: total days that complaints stayed open (from report to resolution, or to today if still open)."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topByDowntime} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={equipmentTooltipLabel} />
                  <Bar dataKey="Days open" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Charts cover complaints reported in the selected period. Average
            times use resolved complaints only. Downtime is an estimate based on
            how long complaints were open, not on exact equipment usage.
          </p>
        </>
      )}
    </div>
  );
}