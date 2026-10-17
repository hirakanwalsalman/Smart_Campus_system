"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";

const ROLE_OPTIONS = [
  { value: "student", label: "Student/Staff" },
  { value: "technician", label: "Technician" },
  { value: "admin", label: "Admin" },
];

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

export default function UsersPage() {
  const { loading, profile } = useProfile();
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    async function loadUsers() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .order("created_at", { ascending: true });

      if (error) {
        setError("Could not load users: " + error.message);
      } else {
        setUsers(data);
      }
      setFetching(false);
    }
    loadUsers();
  }, [isAdmin]);

  async function handleRoleChange(user, newRole) {
    if (newRole === "admin") {
      const ok = window.confirm(
        `Make ${user.full_name || user.email} an admin? Admins can manage all equipment, complaints and users.`
      );
      if (!ok) return;
    }

    setUpdatingId(user.id);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", user.id)
      .select("id, full_name, email, role, created_at");

    setUpdatingId(null);

    if (error) {
      setError("Could not change the role: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nothing was updated. You may not have permission.");
      return;
    }

    setUsers((current) =>
      current.map((u) => (u.id === user.id ? data[0] : u))
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="rounded-xl bg-white p-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
          Only admins can manage users.
        </p>
      </div>
    );
  }

  const searchText = search.trim().toLowerCase();
  const visible = users.filter(
    (u) =>
      searchText === "" ||
      (u.full_name ?? "").toLowerCase().includes(searchText) ||
      (u.email ?? "").toLowerCase().includes(searchText)
  );

  const countRole = (role) => users.filter((u) => u.role === role).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-blue-700">Users</h1>
      <p className="mt-1 text-slate-600">
        Change a person&apos;s role to let them work as a technician or admin.
        You cannot change your own role.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">
          Total: {users.length}
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">
          Admins: {countRole("admin")}
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">
          Technicians: {countRole("technician")}
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">
          Students/Staff: {countRole("student")}
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="relative mt-4 w-full sm:w-80">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {fetching && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Loading users...
                </td>
              </tr>
            )}
            {!fetching && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No users match your search.
                </td>
              </tr>
            )}
            {visible.map((user) => {
              const isSelf = user.id === profile.id;
              return (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {user.full_name || "(no name)"}
                    {isSelf && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-slate-700">
                        {ROLE_LABELS[user.role]}
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}