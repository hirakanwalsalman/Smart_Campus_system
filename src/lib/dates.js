// Small helpers for dates that have no time of day (like due dates).

// Today's date as text, in the browser's own time zone: 2026-10-17
export function todayString() {
  return new Date().toLocaleDateString("en-CA");
}

// How many days from today until the given date (negative means it has passed)
export function daysUntil(dateString) {
  const today = new Date(todayString() + "T00:00:00");
  const due = new Date(dateString + "T00:00:00");
  return Math.round((due - today) / 86400000);
}

// 17 Oct 2026
export function formatDateOnly(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "Overdue by 3 days", "Due tomorrow", "Due in 12 days"
export function dueText(days) {
  if (days < 0) return `Overdue by ${-days} day${-days === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}