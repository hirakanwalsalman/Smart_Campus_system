"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CirclePlus,
  CircleCheck,
  LoaderCircle,
  Trash2,
  Repeat,
  CalendarDays,
  FileDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { downloadMaintenanceReport } from "@/lib/pdf";

const DUE_SOON_DAYS = 14;

const REPEAT_OPTIONS = [
  { value: "", label: "One time only" },
  { value: "30", label: "Every 30 days" },
  { value: "90", label: "Every 90 days" },
  { value: "180", label: "Every 6 months (180 days)" },
  { value: "365", label: "Every year (365 days)" },
];

const GROUP_STYLES = {
  overdue: { title: "Overdue", border: "border-red-500", badge: "bg-red-100 text-red-800" },
  soon: { title: "Due soon", border: "border-amber-400", badge: "bg-amber-100 text-amber-800" },
  upcoming: { title: "Upcoming", border: "border-blue-400", badge: "bg-blue-100 text-blue-800" },
  finished: { title: "Finished", border: "border-slate-300", badge: "bg-slate-200 text-slate-700" },
};

const EMPTY_FORM = {
  equipment_id: "",
  title: "",
  description: "",
  interval_days: "",
  next_due: "",
  assigned_to: "",
};

function repeatLabel(days) {
  if (!days) return "One time";
  const found = REPEAT_OPTIONS.find((o) => o.value === String(days));
  return found ? found.label : `Every ${days} days`;
}

function todayString() {
  return new Date().toLocaleDateString("en-CA"); // looks like 2026-10-17
}

function daysUntil(dateString) {
  const today = new Date(todayString() + "T00:00:00");
  const due = new Date(dateString + "T00:00:00");
  return Math.round((due - today) / 86400000);
}

function formatDate(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dueText(days) {
  if (days < 0) return `Overdue by ${-days} day${-days === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function groupOf(task) {
  if (!task.active) return "finished";
  const days = daysUntil(task.next_due);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "upcoming";
}

const LOG_SELECT =
  "id, completed_by, completed_on, note, maintenance_tasks(title), equipment(code, name)";

export default function MaintenancePage() {
  const { loading, profile } = useProfile();
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [equipment, setEquipment] = useState([]); // admin only
  const [technicians, setTechnicians] = useState([]); // admin only
  const [names, setNames] = useState({}); // admin only
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);
  const [doneOpenId, setDoneOpenId] = useState(null);
  const [doneNote, setDoneNote] = useState("");
  const [completingId, setCompletingId] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const role = profile?.role;
  const isAdmin = role === "admin";
  const allowed = role === "admin" || role === "technician";

  useEffect(() => {
    if (!profile || !allowed) return;

    async function loadAll() {
      const supabase = createClient();

      const { data: taskData, error: taskError } = await supabase
        .from("maintenance_tasks")
        .select("*, equipment(code, name, location)")
        .order("next_due", { ascending: true });

      if (taskError) {
        setError("Could not load tasks: " + taskError.message);
        setFetching(false);
        return;
      }
      setTasks(taskData);

      const { data: logData } = await supabase
        .from("maintenance_logs")
        .select(LOG_SELECT)
        .order("completed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      setLogs(logData ?? []);

      if (profile.role === "admin") {
        const { data: equipmentData } = await supabase
          .from("equipment")
          .select("id, code, name, status")
          .neq("status", "retired")
          .order("code");
        setEquipment(equipmentData ?? []);

        const { data: people } = await supabase
          .from("profiles")
          .select("id, full_name, role");
        const nameMap = {};
        (people ?? []).forEach((p) => {
          nameMap[p.id] = p.full_name;
        });
        setNames(nameMap);
        setTechnicians((people ?? []).filter((p) => p.role === "technician"));
      }

      setFetching(false);
    }
    loadAll();
  }, [profile, allowed]);

  function updateForm(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    if (!form.equipment_id) {
      setError("Please choose the equipment.");
      return;
    }
    if (form.title.trim().length < 3) {
      setError("Please give the task a title of at least 3 characters.");
      return;
    }
    if (!form.next_due) {
      setError("Please choose the first due date.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .insert({
        equipment_id: form.equipment_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        interval_days: form.interval_days === "" ? null : Number(form.interval_days),
        next_due: form.next_due,
        assigned_to: form.assigned_to || null,
      })
      .select("*, equipment(code, name, location)");
    setSaving(false);

    if (error) {
      setError("Could not add the task: " + error.message);
      return;
    }

    setTasks((current) =>
      [...current, data[0]].sort((a, b) => a.next_due.localeCompare(b.next_due))
    );
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleAssign(taskId, technicianId) {
    setUpdatingId(taskId);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .update({ assigned_to: technicianId === "" ? null : technicianId })
      .eq("id", taskId)
      .select("*, equipment(code, name, location)");
    setUpdatingId(null);

    if (error) {
      setError("Could not assign the task: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nothing was updated. You may not have permission.");
      return;
    }
    setTasks((current) => current.map((t) => (t.id === taskId ? data[0] : t)));
  }

  async function handleDelete(task) {
    const ok = window.confirm(
      `Delete the task "${task.title}"? Its completion log will be deleted too.`
    );
    if (!ok) return;

    setUpdatingId(task.id);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .delete()
      .eq("id", task.id)
      .select("id");
    setUpdatingId(null);

    if (error) {
      setError("Could not delete the task: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nothing was deleted. You may not have permission.");
      return;
    }
    setTasks((current) => current.filter((t) => t.id !== task.id));
  }

  async function handleComplete(task) {
    setCompletingId(task.id);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.rpc("complete_maintenance_task", {
      p_task_id: task.id,
      p_note: doneNote,
    });

    if (error) {
      setCompletingId(null);
      setError("Could not mark the task done: " + error.message);
      return;
    }

    // Keep the equipment details, take the new dates and status
    setTasks((current) =>
      current
        .map((t) => (t.id === task.id ? { ...t, ...data } : t))
        .sort((a, b) => a.next_due.localeCompare(b.next_due))
    );

    const { data: logData } = await supabase
      .from("maintenance_logs")
      .select(LOG_SELECT)
      .order("completed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    setLogs(logData ?? []);

    setCompletingId(null);
    setDoneOpenId(null);
    setDoneNote("");
  }

  // Downloads a PDF of the tasks you can see, plus every completion on record
  async function handleDownloadPdf() {
    setPdfBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: allLogs, error: logError } = await supabase
        .from("maintenance_logs")
        .select(LOG_SELECT)
        .order("completed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (logError) throw logError;

      // Technicians can only see their own name, so other people show as "A technician"
      const pdfNames = isAdmin ? names : { [profile.id]: profile.full_name };

      await downloadMaintenanceReport({
        tasks,
        logs: allLogs ?? [],
        names: pdfNames,
        rangeLabel: "All time",
        generatedBy: profile?.full_name ?? "User",
        title: isAdmin ? "Maintenance report" : "My maintenance report",
        fileBase: isAdmin ? "maintenance-report" : "my-maintenance-report",
      });
    } catch (e) {
      setError("Could not create the PDF: " + (e?.message ?? "unknown error"));
    }
    setPdfBusy(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="rounded-xl bg-white p-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
          The maintenance schedule is available to admins and technicians.
        </p>
      </div>
    );
  }

  // Sort the tasks into groups
  const grouped = { overdue: [], soon: [], upcoming: [], finished: [] };
  tasks.forEach((task) => grouped[groupOf(task)].push(task));

  const activeCount =
    grouped.overdue.length + grouped.soon.length + grouped.upcoming.length;

  const filterButtons = [
    { value: "all", label: "All active", count: activeCount },
    { value: "overdue", label: "Overdue", count: grouped.overdue.length },
    { value: "soon", label: "Due soon", count: grouped.soon.length },
    { value: "upcoming", label: "Upcoming", count: grouped.upcoming.length },
    { value: "finished", label: "Finished", count: grouped.finished.length },
  ];

  const sectionsToShow =
    filter === "all" ? ["overdue", "soon", "upcoming"] : [filter];

  function assigneeText(task) {
    if (!isAdmin) return "Assigned to you";
    if (!task.assigned_to) return "Unassigned";
    return `Assigned to ${names[task.assigned_to] ?? "a technician"}`;
  }

  function completerLabel(log) {
    if (log.completed_by === profile.id) return "You";
    if (isAdmin) return names[log.completed_by] ?? "Unknown";
    return "A technician";
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-700">Maintenance schedule</h1>
          <p className="mt-1 text-slate-600">
            {isAdmin
              ? "Plan preventive maintenance and calibration checks for your equipment."
              : "These are the maintenance tasks assigned to you."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={pdfBusy || fetching}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            {pdfBusy ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <FileDown size={16} />
            )}
            {pdfBusy ? "Creating PDF..." : "Download PDF"}
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <CirclePlus size={16} />
              {showForm ? "Close form" : "Add task"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add task form (admin) */}
      {isAdmin && showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <h2 className="font-semibold">New maintenance task</h2>

          <div>
            <label className="block text-sm font-medium">Equipment</label>
            <select
              name="equipment_id"
              value={form.equipment_id}
              onChange={updateForm}
              className={inputClass}
            >
              <option value="">Select equipment...</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Task title</label>
            <input
              name="title"
              placeholder="e.g. Calibration check"
              value={form.title}
              onChange={updateForm}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Details (optional)</label>
            <textarea
              name="description"
              rows={2}
              placeholder="What exactly should be checked or done?"
              value={form.description}
              onChange={updateForm}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Repeats</label>
              <select
                name="interval_days"
                value={form.interval_days}
                onChange={updateForm}
                className={inputClass}
              >
                {REPEAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">First due date</label>
              <input
                type="date"
                name="next_due"
                value={form.next_due}
                onChange={updateForm}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Assign to (optional)</label>
              <select
                name="assigned_to"
                value={form.assigned_to}
                onChange={updateForm}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            {saving ? "Saving..." : "Save task"}
          </button>
        </form>
      )}

      {/* Filter buttons */}
      <div className="mt-6 flex flex-wrap gap-2">
        {filterButtons.map((button) => (
          <button
            key={button.value}
            onClick={() => setFilter(button.value)}
            className={`rounded-full px-4 py-1 text-sm font-medium ${
              filter === button.value
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 shadow hover:bg-slate-100"
            }`}
          >
            {button.label} ({button.count})
          </button>
        ))}
      </div>

      {/* Task lists */}
      {fetching ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {filter === "all" && activeCount === 0 && (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
              {isAdmin
                ? "No active maintenance tasks. Use Add task to schedule one."
                : "No maintenance tasks are assigned to you."}
            </p>
          )}

          {sectionsToShow.map((section) => {
            const list = grouped[section];
            const style = GROUP_STYLES[section];

            if (list.length === 0 && filter === "all") return null;

            return (
              <section key={section}>
                <h2 className="mb-3 font-semibold">
                  {style.title} ({list.length})
                </h2>

                {list.length === 0 && (
                  <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    Nothing here.
                  </p>
                )}

                <ul className="space-y-3">
                  {list.map((task) => {
                    const canComplete =
                      task.active && (isAdmin || task.assigned_to === profile.id);

                    return (
                      <li
                        key={task.id}
                        className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ring-1 ring-slate-200 ${style.border}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{task.title}</p>
                            <Link
                              href={`/equipment/${task.equipment_id}`}
                              className="text-sm text-blue-700 hover:underline"
                            >
                              {task.equipment?.code} - {task.equipment?.name}
                            </Link>
                            <span className="text-sm text-slate-500">
                              {" "}
                              ({task.equipment?.location})
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${style.badge}`}
                          >
                            {section === "finished"
                              ? "Finished"
                              : dueText(daysUntil(task.next_due))}
                          </span>
                        </div>

                        {task.description && (
                          <p className="mt-2 text-sm text-slate-700">
                            {task.description}
                          </p>
                        )}

                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={14} />
                            {section === "finished"
                              ? `Last due ${formatDate(task.next_due)}`
                              : `Due ${formatDate(task.next_due)}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Repeat size={14} />
                            {repeatLabel(task.interval_days)}
                          </span>
                          <span>{assigneeText(task)}</span>
                        </p>

                        {/* Actions */}
                        {(canComplete || isAdmin) && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                            {canComplete && doneOpenId !== task.id && (
                              <button
                                onClick={() => {
                                  setDoneOpenId(task.id);
                                  setDoneNote("");
                                }}
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                              >
                                <CircleCheck size={16} />
                                Mark done
                              </button>
                            )}

                            {isAdmin && task.active && (
                              <div>
                                <label className="mr-2 text-sm font-medium">
                                  Assign to:
                                </label>
                                <select
                                  value={task.assigned_to ?? ""}
                                  disabled={updatingId === task.id}
                                  onChange={(e) =>
                                    handleAssign(task.id, e.target.value)
                                  }
                                  className={selectClass}
                                >
                                  <option value="">Unassigned</option>
                                  {technicians.map((tech) => (
                                    <option key={tech.id} value={tech.id}>
                                      {tech.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(task)}
                                disabled={updatingId === task.id}
                                className="flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            )}
                          </div>
                        )}

                        {/* Mark done form */}
                        {doneOpenId === task.id && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            <label className="block text-sm font-medium">
                              Note (optional)
                            </label>
                            <textarea
                              rows={2}
                              maxLength={1000}
                              placeholder="What did you check or do?"
                              value={doneNote}
                              onChange={(e) => setDoneNote(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <div className="mt-2 flex gap-3">
                              <button
                                onClick={() => handleComplete(task)}
                                disabled={completingId === task.id}
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                {completingId === task.id && (
                                  <LoaderCircle size={16} className="animate-spin" />
                                )}
                                Confirm done
                              </button>
                              <button
                                onClick={() => setDoneOpenId(null)}
                                className="text-sm text-slate-600 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {task.interval_days
                                ? `The next due date will move to ${task.interval_days} days from today.`
                                : "This is a one-time task, so it will be marked as finished."}
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Recent completions */}
      {!fetching && (
        <div className="mt-10 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Recent completions</h2>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nothing has been completed yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {logs.map((log) => (
                <li key={log.id} className="py-3">
                  <p className="text-sm font-medium">
                    {log.maintenance_tasks?.title}{" "}
                    <span className="font-normal text-slate-500">
                      on {log.equipment?.code} - {log.equipment?.name}
                    </span>
                  </p>
                  {log.note && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {log.note}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {completerLabel(log)} | {formatDate(log.completed_on)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
