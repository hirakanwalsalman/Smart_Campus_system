"use client";

import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  downloadComplaintsReport,
  downloadEquipmentReport,
  downloadMaintenanceReport,
} from "@/lib/pdf";

const DAY = 24 * 60 * 60 * 1000;

const REPORTS = [
  {
    key: "complaints",
    title: "Complaints report",
    text: "A summary, a category chart and a table of every complaint reported in the selected period. Reporter names are not included.",
  },
  {
    key: "equipment",
    title: "Equipment report",
    text: "The equipment register with each item's status, complaints, last maintenance and next due date, plus the recurring-fault and downtime rankings.",
  },
  {
    key: "maintenance",
    title: "Maintenance report",
    text: "Overdue and upcoming maintenance tasks, and the maintenance completed in the selected period.",
  },
];

// The database returns at most 1000 rows per request, so we ask page by page
async function fetchAll(buildQuery) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export default function ReportsPanel({ range, rangeLabel, generatedBy }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function handleDownload(key) {
    setBusy(key);
    setError("");

    try {
      const supabase = createClient();
      const cutoff =
        range === "all" ? null : new Date(Date.now() - Number(range) * DAY);
      const cutoffIso = cutoff ? cutoff.toISOString() : null;
      const cutoffDate = cutoff ? cutoff.toLocaleDateString("en-CA") : null;

      if (key === "complaints") {
        const complaints = await fetchAll(() => {
          let query = supabase
            .from("complaints")
            .select(
              "id, description, priority, status, created_at, resolved_at, equipment_id, equipment(code, name, category)"
            )
            .order("created_at", { ascending: false })
            .order("id", { ascending: true });
          if (cutoffIso) query = query.gte("created_at", cutoffIso);
          return query;
        });

        await downloadComplaintsReport({ complaints, rangeLabel, generatedBy });
      }

      if (key === "equipment") {
        const [equipment, complaints, tasks, logs] = await Promise.all([
          fetchAll(() =>
            supabase
              .from("equipment")
              .select("id, code, name, category, location, status, created_at")
              .order("code", { ascending: true })
          ),
          fetchAll(() => {
            let query = supabase
              .from("complaints")
              .select("id, status, created_at, resolved_at, equipment_id")
              .order("created_at", { ascending: false })
              .order("id", { ascending: true });
            if (cutoffIso) query = query.gte("created_at", cutoffIso);
            return query;
          }),
          fetchAll(() =>
            supabase
              .from("maintenance_tasks")
              .select("id, equipment_id, title, next_due, interval_days, active")
              .order("next_due", { ascending: true })
              .order("id", { ascending: true })
          ),
          fetchAll(() =>
            supabase
              .from("maintenance_logs")
              .select("id, equipment_id, completed_on")
              .order("completed_on", { ascending: false })
              .order("id", { ascending: true })
          ),
        ]);

        await downloadEquipmentReport({
          equipment,
          complaints,
          tasks,
          logs,
          rangeLabel,
          generatedBy,
        });
      }

      if (key === "maintenance") {
        const [tasks, logs, people] = await Promise.all([
          fetchAll(() =>
            supabase
              .from("maintenance_tasks")
              .select(
                "id, title, interval_days, next_due, active, assigned_to, equipment(code, name)"
              )
              .order("next_due", { ascending: true })
              .order("id", { ascending: true })
          ),
          fetchAll(() => {
            let query = supabase
              .from("maintenance_logs")
              .select(
                "id, completed_by, completed_on, note, maintenance_tasks(title), equipment(code, name)"
              )
              .order("completed_on", { ascending: false })
              .order("id", { ascending: true });
            if (cutoffDate) query = query.gte("completed_on", cutoffDate);
            return query;
          }),
          fetchAll(() =>
            supabase
              .from("profiles")
              .select("id, full_name")
              .order("id", { ascending: true })
          ),
        ]);

        const names = {};
        people.forEach((p) => {
          names[p.id] = p.full_name;
        });

        await downloadMaintenanceReport({
          tasks,
          logs,
          names,
          rangeLabel,
          generatedBy,
        });
      }
    } catch (e) {
      setError("Could not create the PDF: " + (e?.message ?? "unknown error"));
    }

    setBusy(null);
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold">Download PDF reports</h2>
      <p className="mt-1 text-sm text-slate-600">
        Period for complaints and completed maintenance: {rangeLabel}. The PDFs
        are created in your browser, so nothing is uploaded.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {REPORTS.map((report) => (
          <div
            key={report.key}
            className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div>
              <h3 className="font-semibold">{report.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{report.text}</p>
            </div>
            <button
              onClick={() => handleDownload(report.key)}
              disabled={busy !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === report.key ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <FileDown size={16} />
              )}
              {busy === report.key ? "Creating PDF..." : "Download PDF"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
