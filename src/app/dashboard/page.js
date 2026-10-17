"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FilePlus2,
  ClipboardList,
  Boxes,
  CirclePlus,
  Clock,
  Hourglass,
  CircleCheck,
  TriangleAlert,
  Flame,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

const ROLE_LABELS = {
  student: "Student/Staff",
  technician: "Technician",
  admin: "Admin",
};

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SkeletonCards({ count }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { loading, profile } = useProfile();
  const [complaints, setComplaints] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;

    async function loadData() {
      const supabase = createClient();

      const { data: complaintData, error: complaintError } = await supabase
        .from("complaints")
        .select(
          "id, status, priority, description, created_at, equipment(code, name)"
        )
        .order("created_at", { ascending: false });

      if (complaintError) {
        setError("Could not load complaints: " + complaintError.message);
      } else {
        setComplaints(complaintData);
      }

      // Only admins need the equipment numbers
      if (profile.role === "admin") {
        const { data: equipmentData } = await supabase
          .from("equipment")
          .select("id, status");
        setEquipment(equipmentData ?? []);
      }

      setFetching(false);
    }
    loadData();
  }, [profile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-6">
          <SkeletonCards count={4} />
        </div>
      </div>
    );
  }

  const role = profile?.role;
  const isAdmin = role === "admin";
  const isTechnician = role === "technician";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const countStatus = (status) =>
    complaints.filter((c) => c.status === status).length;
  const pending = countStatus("pending");
  const inProgress = countStatus("in_progress");
  const resolved = countStatus("resolved");
  const urgent = complaints.filter(
    (c) => c.priority === "high" && c.status !== "resolved"
  ).length;
  const needsAttention = equipment.filter(
    (e) => e.status === "faulty" || e.status === "under_repair"
  ).length;
  const recent = complaints.slice(0, 5);

  const complaintsLabel = isAdmin
    ? "All complaints"
    : isTechnician
    ? "Assigned complaints"
    : "My complaints";

  const subtitle = isAdmin
    ? "Here is an overview of equipment and complaints across the campus."
    : isTechnician
    ? "Here are the complaints assigned to you."
    : "Here is a summary of the issues you have reported.";

  const gridClass = isAdmin
    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          {ROLE_LABELS[role] ?? role}
        </span>
      </div>
      <p className="mt-1 text-slate-600">{subtitle}</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {!isTechnician && (
          <Link
            href="/report"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FilePlus2 size={16} />
            Report an issue
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/equipment/new"
            className="flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            <CirclePlus size={16} />
            Add equipment
          </Link>
        )}
        <Link
          href="/complaints"
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <ClipboardList size={16} />
          {complaintsLabel}
        </Link>
        <Link
          href="/equipment"
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <Boxes size={16} />
          Equipment
        </Link>
      </div>

      {/* Statistics */}
      <div className="mt-8">
        {fetching ? (
          <SkeletonCards count={isAdmin ? 6 : 4} />
        ) : isAdmin ? (
          <div className={gridClass}>
            <StatCard icon={Boxes} label="Total equipment" value={equipment.length} tone="blue" />
            <StatCard icon={TriangleAlert} label="Equipment needing attention" value={needsAttention} tone="red" />
            <StatCard icon={Flame} label="Urgent complaints (unresolved)" value={urgent} tone="red" />
            <StatCard icon={Clock} label="Pending complaints" value={pending} tone="amber" />
            <StatCard icon={Hourglass} label="In progress" value={inProgress} tone="blue" />
            <StatCard icon={CircleCheck} label="Resolved" value={resolved} tone="green" />
          </div>
        ) : (
          <div className={gridClass}>
            <StatCard
              icon={ClipboardList}
              label={isTechnician ? "Assigned to me" : "My complaints"}
              value={complaints.length}
              tone="slate"
            />
            <StatCard icon={Clock} label="Pending" value={pending} tone="amber" />
            <StatCard icon={Hourglass} label="In progress" value={inProgress} tone="blue" />
            <StatCard icon={CircleCheck} label="Resolved" value={resolved} tone="green" />
          </div>
        )}
      </div>

      {/* Recent complaints */}
      <div className="mt-8 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent complaints</h2>
          <Link href="/complaints" className="text-sm font-medium text-blue-700 hover:underline">
            View all
          </Link>
        </div>

        {fetching ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <Inbox size={32} className="mx-auto text-slate-400" />
            <p className="mt-2">
              {isTechnician
                ? "No complaints are assigned to you yet. Assigned jobs will appear here once admins can assign them (coming in Stage 2)."
                : "No complaints yet."}
            </p>
            {!isTechnician && (
              <Link
                href="/report"
                className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
              >
                Report an issue
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {recent.map((complaint) => (
              <li
                key={complaint.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {complaint.equipment?.code} - {complaint.equipment?.name}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {complaint.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {formatDate(complaint.created_at)}
                  </span>
                  <StatusBadge type="complaint" value={complaint.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}