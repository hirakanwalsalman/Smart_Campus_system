"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";

const STATUS_LABELS = {
  working: "Working",
  faulty: "Faulty",
  under_repair: "Under repair",
  retired: "Retired",
};

const STATUS_STYLES = {
  working: "bg-green-100 text-green-800",
  faulty: "bg-red-100 text-red-800",
  under_repair: "bg-amber-100 text-amber-800",
  retired: "bg-slate-200 text-slate-700",
};

export default function EquipmentPage() {
  const { loading, profile } = useProfile();
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  // Search and filter settings
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!profile) return;

    async function loadEquipment() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("code");

      if (error) {
        setError("Could not load equipment: " + error.message);
      } else {
        setItems(data);
      }
      setFetching(false);
    }
    loadEquipment();
  }, [profile]);

  if (loading) {
    return <main className="p-6">Loading...</main>;
  }

  const isAdmin = profile?.role === "admin";

  // Build the list of categories from the data itself
  const categories = [...new Set(items.map((item) => item.category))].sort();

  // Apply the search and filters
  const searchText = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchText === "" ||
      item.code.toLowerCase().includes(searchText) ||
      item.name.toLowerCase().includes(searchText) ||
      item.location.toLowerCase().includes(searchText);
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filtersActive =
    search !== "" || categoryFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-blue-700">Equipment</h1>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
          {isAdmin && (
            <Link
              href="/equipment/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add equipment
            </Link>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Search and filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by ID, name or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} w-full sm:w-72`}
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={inputClass}
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={inputClass}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {!fetching && (
        <p className="mt-3 text-sm text-slate-500">
          Showing {filteredItems.length} of {items.length} items
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {!fetching && items.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No equipment yet.
                </td>
              </tr>
            )}
            {!fetching && items.length > 0 && filteredItems.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No equipment matches your search.
                </td>
              </tr>
            )}
            {filteredItems.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{item.code}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3">{item.category}</td>
                <td className="px-4 py-3">{item.location}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <Link
                      href={`/equipment/${item.id}/edit`}
                      className="text-blue-700 underline"
                    >
                      Edit
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}