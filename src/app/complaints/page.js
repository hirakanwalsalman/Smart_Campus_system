"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import StatusBadge from "@/components/StatusBadge";

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ComplaintsPage() {
  const { loading, profile } = useProfile();
  const [complaints, setComplaints] = useState([]);
  const [names, setNames] = useState({}); // user id -> full name (admin only)
  const [technicians, setTechnicians] = useState([]); // admin only
  const [photoUrls, setPhotoUrls] = useState({}); // photo path -> temporary link
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!profile) return;

    async function loadComplaints() {
      const supabase = createClient();

      // 1. Load the complaints, together with their equipment details
      const { data, error } = await supabase
        .from("complaints")
        .select("*, equipment(code, name, location)")
        .order("created_at", { ascending: false });

      if (error) {
        setError("Could not load complaints: " + error.message);
        setFetching(false);
        return;
      }
      setComplaints(data);

      // 2. Photos are private, so ask for temporary links (valid for 1 hour)
      const paths = data.map((c) => c.photo_path).filter(Boolean);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("complaint-photos")
          .createSignedUrls(paths, 3600);

        const urlMap = {};
        (signed ?? []).forEach((item) => {
          if (item.signedUrl) urlMap[item.path] = item.signedUrl;
        });
        setPhotoUrls(urlMap);
      }

      // 3. Admins also load people's names and the list of technicians
      if (profile.role === "admin") {
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
    loadComplaints();
  }, [profile]);

  function replaceComplaint(updated) {
    setComplaints((current) =>
      current.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  async function handleStatusChange(id, newStatus) {
    setUpdatingId(id);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("complaints")
      .update({ status: newStatus })
      .eq("id", id)
      .select("*, equipment(code, name, location)");

    setUpdatingId(null);

    if (error) {
      setError("Could not update the status: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nothing was updated. You may not have permission.");
      return;
    }
    replaceComplaint(data[0]);
  }

  async function handleAssign(id, technicianId) {
    setUpdatingId(id);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("complaints")
      .update({ assigned_to: technicianId === "" ? null : technicianId })
      .eq("id", id)
      .select("*, equipment(code, name, location)");

    setUpdatingId(null);

    if (error) {
      setError("Could not assign the complaint: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nothing was updated. You may not have permission.");
      return;
    }
    replaceComplaint(data[0]);
  }

  if (loading) {
    return <main className="p-6">Loading...</main>;
  }

  const isAdmin = profile?.role === "admin";
  const title = isAdmin
    ? "All complaints"
    : profile?.role === "technician"
    ? "Assigned complaints"
    : "My complaints";

  const counts = {
    all: complaints.length,
    pending: complaints.filter((c) => c.status === "pending").length,
    in_progress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  };

  const visible =
    filter === "all" ? complaints : complaints.filter((c) => c.status === filter);

  const filterButtons = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" },
  ];

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-blue-700">{title}</h1>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
          <Link
            href="/report"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Report an issue
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Status filter buttons */}
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
            {button.label} ({counts[button.value]})
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {!fetching && visible.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow">
            {complaints.length === 0
              ? "No complaints yet."
              : "No complaints with this status."}
          </p>
        )}

        {visible.map((complaint) => (
          <div key={complaint.id} className="rounded-xl bg-white p-5 shadow">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {complaint.equipment?.code} - {complaint.equipment?.name}
                </p>
                <p className="text-sm text-slate-500">
                  {complaint.equipment?.location}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge type="priority" value={complaint.priority} />
                <StatusBadge type="complaint" value={complaint.status} />
              </div>
            </div>

            <p className="mt-3 text-slate-700">{complaint.description}</p>

            {photoUrls[complaint.photo_path] && (
              <a
                href={photoUrls[complaint.photo_path]}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block"
              >
                <img
                  src={photoUrls[complaint.photo_path]}
                  alt="Photo of the problem"
                  className="h-24 w-24 rounded-lg object-cover"
                />
              </a>
            )}

            <p className="mt-3 text-xs text-slate-500">
              Reported on {formatDate(complaint.created_at)}
              {isAdmin && names[complaint.reported_by]
                ? ` by ${names[complaint.reported_by]}`
                : ""}
              {complaint.resolved_at
                ? ` | Resolved on ${formatDate(complaint.resolved_at)}`
                : ""}
            </p>

            {/* What the assignment looks like to non-admins */}
            {!isAdmin && complaint.assigned_to && (
              <p className="mt-1 text-xs text-slate-500">
                A technician is assigned to this complaint.
              </p>
            )}

            {/* Admin controls */}
            {isAdmin && (
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <label className="mr-2 text-sm font-medium">Assign to:</label>
                  <select
                    value={complaint.assigned_to ?? ""}
                    disabled={updatingId === complaint.id}
                    onChange={(e) => handleAssign(complaint.id, e.target.value)}
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

                <div>
                  <label className="mr-2 text-sm font-medium">
                    Change status:
                  </label>
                  <select
                    value={complaint.status}
                    disabled={updatingId === complaint.id}
                    onChange={(e) =>
                      handleStatusChange(complaint.id, e.target.value)
                    }
                    className={selectClass}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdmin && !fetching && technicians.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            There are no technicians yet. Open the Users page and change
            someone&apos;s role to Technician.
          </p>
        )}
      </div>
    </main>
  );
}