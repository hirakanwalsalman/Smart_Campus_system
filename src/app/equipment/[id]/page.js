"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  ClipboardList,
  CalendarClock,
  CalendarCheck,
  CircleCheck,
  Timer,
  TriangleAlert,
  Inbox,
  Repeat,
  FileDown,
  LoaderCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { daysUntil, dueText, formatDateOnly } from "@/lib/dates";
import { downloadEquipmentHistoryReport } from "@/lib/pdf";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

const BORDER_BY_STATUS = {
  pending: "border-amber-400",
  in_progress: "border-blue-400",
  resolved: "border-green-500",
};

const DUE_SOON_DAYS = 14;

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dueBadgeClass(days) {
  if (days < 0) return "bg-red-100 text-red-800";
  if (days <= DUE_SOON_DAYS) return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

export default function EquipmentDetailPage() {
  const { id } = useParams();
  const { loading, profile } = useProfile();
  const [item, setItem] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [notes, setNotes] = useState({}); // complaint id -> list of notes
  const [tasks, setTasks] = useState([]); // scheduled maintenance
  const [logs, setLogs] = useState([]); // completed maintenance
  const [names, setNames] = useState({}); // user id -> full name (admin only)
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;

    async function loadAll() {
      const supabase = createClient();

      // 1. The equipment itself
      const { data: equipmentData, error: equipmentError } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id)
        .single();

      if (equipmentError) {
        setError("Could not load this equipment: " + equipmentError.message);
        setFetching(false);
        return;
      }
      setItem(equipmentData);

      // 2. Its complaints (the database only returns the ones you may see)
      const { data: complaintData, error: complaintError } = await supabase
        .from("complaints")
        .select("id, description, priority, status, created_at, resolved_at")
        .eq("equipment_id", id)
        .order("created_at", { ascending: false });

      if (complaintError) {
        setError("Could not load the history: " + complaintError.message);
        setFetching(false);
        return;
      }
      const list = complaintData ?? [];
      setComplaints(list);

      // 3. The repair notes for those complaints
      if (list.length > 0) {
        const { data: noteData } = await supabase
          .from("repair_notes")
          .select("id, complaint_id, author_id, note, created_at")
          .in(
            "complaint_id",
            list.map((c) => c.id)
          )
          .order("created_at", { ascending: true });

        const grouped = {};
        (noteData ?? []).forEach((n) => {
          if (!grouped[n.complaint_id]) grouped[n.complaint_id] = [];
          grouped[n.complaint_id].push(n);
        });
        setNotes(grouped);
      }

      // 4. Maintenance schedule and log (admins and technicians only)
      if (profile.role === "admin" || profile.role === "technician") {
        const { data: taskData } = await supabase
          .from("maintenance_tasks")
          .select("id, title, description, interval_days, next_due, active")
          .eq("equipment_id", id)
          .order("next_due", { ascending: true });
        setTasks(taskData ?? []);

        const { data: logData } = await supabase
          .from("maintenance_logs")
          .select("id, completed_by, completed_on, note, maintenance_tasks(title)")
          .eq("equipment_id", id)
          .order("completed_on", { ascending: false })
          .order("created_at", { ascending: false });
        setLogs(logData ?? []);
      }

      // 5. Admins can see who wrote each note
      if (profile.role === "admin") {
        const { data: people } = await supabase
          .from("profiles")
          .select("id, full_name");
        const nameMap = {};
        (people ?? []).forEach((p) => {
          nameMap[p.id] = p.full_name;
        });
        setNames(nameMap);
      }

      setFetching(false);
    }
    loadAll();
  }, [profile, id]);

  if (loading || fetching) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error || "Equipment not found."}
        </p>
        <Link href="/equipment" className="mt-4 inline-block text-blue-700 underline">
          Back to equipment list
        </Link>
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";
  const canSeeMaintenance = isAdmin || profile?.role === "technician";
  const activeTasks = tasks.filter((t) => t.active);

  // Statistics
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const total = complaints.length;
  const recent = complaints.filter(
    (c) => new Date(c.created_at).getTime() >= ninetyDaysAgo
  ).length;
  const resolvedList = complaints.filter(
    (c) => c.status === "resolved" && c.resolved_at
  );
  const resolvedCount = complaints.filter((c) => c.status === "resolved").length;
  const averageDays =
    resolvedList.length > 0
      ? resolvedList.reduce(
          (sum, c) =>
            sum +
            (new Date(c.resolved_at).getTime() -
              new Date(c.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          0
        ) / resolvedList.length
      : null;

  const recurring = recent >= 3;

  function authorLabel(note) {
    if (note.author_id === profile?.id) return "You";
    if (isAdmin) return names[note.author_id] ?? "Unknown";
    return "Maintenance team";
  }

  function completerLabel(log) {
    if (log.completed_by === profile?.id) return "You";
    if (isAdmin) return names[log.completed_by] ?? "Unknown";
    return "A technician";
  }

  async function handleDownloadPdf() {
    setPdfBusy(true);
    setError("");
    try {
      await downloadEquipmentHistoryReport({
        item,
        complaints,
        notes,
        tasks: activeTasks,
        logs,
        generatedBy: profile?.full_name ?? "User",
        showMaintenance: canSeeMaintenance,
        authorLabel,
        completerLabel,
      });
    } catch (e) {
      setError("Could not create the PDF: " + (e?.message ?? "unknown error"));
    }
    setPdfBusy(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ArrowLeft size={16} />
        Back to equipment
      </Link>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Equipment details */}
      <div className="mt-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{item.code}</p>
            <h1 className="text-2xl font-bold">{item.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge type="equipment" value={item.status} />
            <button
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-60"
            >
              {pdfBusy ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              {pdfBusy ? "Creating PDF..." : "Download PDF"}
            </button>
            {isAdmin && (
              <Link
                href={`/equipment/${item.id}/edit`}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
              >
                <Pencil size={14} />
                Edit
              </Link>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Category</dt>
            <dd className="font-medium">{item.category}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Location</dt>
            <dd className="font-medium">{item.location}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Added to the register</dt>
            <dd className="font-medium">{formatDate(item.created_at)}</dd>
          </div>
        </dl>
      </div>

      {/* Recurring fault warning */}
      {recurring && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">Recurring faults:</span> {recent}{" "}
            complaints in the last 90 days. Consider a full inspection or
            replacement.
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Complaints in total" value={total} tone="slate" />
        <StatCard icon={CalendarClock} label="Last 90 days" value={recent} tone={recurring ? "red" : "blue"} />
        <StatCard icon={CircleCheck} label="Resolved" value={resolvedCount} tone="green" />
        <StatCard
          icon={Timer}
          label="Average time to resolve"
          value={averageDays === null ? "-" : `${averageDays.toFixed(1)} days`}
          tone="amber"
        />
      </div>

      {/* Scheduled maintenance (admins and technicians) */}
      {canSeeMaintenance && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarCheck size={20} className="text-blue-600" />
              Scheduled maintenance
            </h2>
            <Link
              href="/maintenance"
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              {isAdmin ? "Manage the schedule" : "Go to my tasks"}
            </Link>
          </div>

          {activeTasks.length === 0 ? (
            <p className="mt-3 rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              No maintenance is scheduled for this equipment.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {activeTasks.map((task) => {
                const days = daysUntil(task.next_due);
                return (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                  >
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 text-sm text-slate-600">
                          {task.description}
                        </p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-slate-500">
                        <span>Due {formatDateOnly(task.next_due)}</span>
                        <span className="flex items-center gap-1">
                          <Repeat size={12} />
                          {task.interval_days
                            ? `Every ${task.interval_days} days`
                            : "One time"}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${dueBadgeClass(days)}`}
                    >
                      {dueText(days)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {logs.length > 0 && (
            <div className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="font-medium">Completed maintenance</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {logs.map((log) => (
                  <li key={log.id} className="py-3">
                    <p className="text-sm font-medium">
                      {log.maintenance_tasks?.title}
                    </p>
                    {log.note && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {log.note}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {completerLabel(log)} | {formatDateOnly(log.completed_on)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Complaint history */}
      <h2 className="mt-8 text-lg font-semibold">
        {isAdmin ? "Complaint history" : "Your complaints about this equipment"}
      </h2>
      {!isAdmin && (
        <p className="mt-1 text-sm text-slate-500">
          You can only see complaints that you reported or that are assigned to
          you.
        </p>
      )}

      {complaints.length === 0 ? (
        <div className="mt-4 rounded-xl bg-white py-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Inbox size={32} className="mx-auto text-slate-400" />
          <p className="mt-2">No complaints recorded for this equipment.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {complaints.map((complaint) => {
            const noteList = notes[complaint.id] ?? [];
            return (
              <li
                key={complaint.id}
                className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ring-1 ring-slate-200 ${BORDER_BY_STATUS[complaint.status]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    Reported on {formatDate(complaint.created_at)}
                    {complaint.resolved_at
                      ? ` | Resolved on ${formatDate(complaint.resolved_at)}`
                      : ""}
                  </p>
                  <div className="flex gap-2">
                    <StatusBadge type="priority" value={complaint.priority} />
                    <StatusBadge type="complaint" value={complaint.status} />
                  </div>
                </div>

                <p className="mt-2 text-slate-800">{complaint.description}</p>

                {noteList.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {noteList.map((note) => (
                      <div key={note.id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="whitespace-pre-wrap text-sm text-slate-800">
                          {note.note}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Repair note | {authorLabel(note)} |{" "}
                          {formatDateTime(note.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
