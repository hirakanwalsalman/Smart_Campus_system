"use client";

import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "working", label: "Working" },
  { value: "faulty", label: "Faulty" },
  { value: "under_repair", label: "Under repair" },
  { value: "retired", label: "Retired" },
];

const CATEGORY_SUGGESTIONS = [
  "Computer",
  "Projector",
  "Fan",
  "Light",
  "Wi-Fi",
  "Laboratory Equipment",
  "Other",
];

export default function EquipmentForm({
  initialValues,
  onSubmit,
  submitLabel,
  saving,
  error,
}) {
  const [values, setValues] = useState(initialValues);

  function handleChange(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      code: values.code.trim(),
      name: values.name.trim(),
      category: values.category.trim(),
      location: values.location.trim(),
      status: values.status,
    });
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Equipment ID (must be unique)</label>
        <input
          name="code"
          required
          placeholder="e.g. PRJ-001"
          value={values.code}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          name="name"
          required
          placeholder="e.g. Epson Projector"
          value={values.name}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Category</label>
        <input
          name="category"
          required
          list="category-list"
          placeholder="Pick a suggestion or type your own"
          value={values.category}
          onChange={handleChange}
          className={inputClass}
        />
        <datalist id="category-list">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="block text-sm font-medium">Location</label>
        <input
          name="location"
          required
          placeholder="e.g. Lab 3, Block B"
          value={values.location}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Status</label>
        <select
          name="status"
          value={values.status}
          onChange={handleChange}
          className={inputClass}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}