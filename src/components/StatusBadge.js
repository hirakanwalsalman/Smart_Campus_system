// One place that defines the colours and labels for every status badge.
const STYLES = {
  complaint: {
    pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
    in_progress: { label: "In progress", className: "bg-blue-100 text-blue-800" },
    resolved: { label: "Resolved", className: "bg-green-100 text-green-800" },
  },
  priority: {
    low: { label: "Low priority", className: "bg-slate-100 text-slate-700" },
    medium: { label: "Medium priority", className: "bg-yellow-100 text-yellow-800" },
    high: { label: "High priority", className: "bg-red-100 text-red-800" },
  },
  equipment: {
    working: { label: "Working", className: "bg-green-100 text-green-800" },
    faulty: { label: "Faulty", className: "bg-red-100 text-red-800" },
    under_repair: { label: "Under repair", className: "bg-amber-100 text-amber-800" },
    retired: { label: "Retired", className: "bg-slate-200 text-slate-700" },
  },
};

export default function StatusBadge({ type, value }) {
  const style = STYLES[type]?.[value];
  const label = style?.label ?? value;
  const className = style?.className ?? "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}