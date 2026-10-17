const TONES = {
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

export default function StatCard({ icon: Icon, label, value, tone = "blue" }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
      >
        <Icon size={24} />
      </span>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
}