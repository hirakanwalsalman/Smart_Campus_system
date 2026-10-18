// Builds the downloadable PDF reports inside the browser.
// No server is involved and there is no cost per PDF.

import { daysUntil, dueText, formatDateOnly, todayString } from "@/lib/dates";

const DAY = 24 * 60 * 60 * 1000;
const MARGIN = 14;
const BLUE = [37, 99, 235];
const SLATE = [71, 85, 105];

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
};
const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };
const EQUIPMENT_STATUS_LABELS = {
  working: "Working",
  faulty: "Faulty",
  under_repair: "Under repair",
  retired: "Retired",
};

// ---------- small helpers ----------

// PDF fonts only support basic Latin letters, so other characters become "?"
function clean(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\u0000-\u00FF]/g, "?");
}

function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateOnly(value) {
  return value ? formatDateOnly(value) : "-";
}

function repeatText(days) {
  return days ? `Every ${days} days` : "One time";
}

function daysBetween(start, end) {
  return (new Date(end) - new Date(start)) / DAY;
}

function averageResolutionDays(complaints) {
  const resolved = complaints.filter(
    (c) => c.status === "resolved" && c.resolved_at
  );
  if (resolved.length === 0) return null;
  return (
    resolved.reduce((sum, c) => sum + daysBetween(c.created_at, c.resolved_at), 0) /
    resolved.length
  );
}

function fileName(base) {
  return `${base}-${todayString()}.pdf`;
}

// ---------- the PDF building blocks ----------

async function loadLibraries() {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default;
  const autoTable = autoTableModule.default ?? autoTableModule.autoTable;
  return { jsPDF, autoTable };
}

async function startDocument({ title, subtitle, generatedBy, landscape }) {
  const { jsPDF, autoTable } = await loadLibraries();
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLUE);
  doc.text("Smart Campus Maintenance", MARGIN, 14);

  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(clean(title), MARGIN, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);

  let y = 30;
  if (subtitle) {
    doc.text(clean(subtitle), MARGIN, y);
    y += 5;
  }
  doc.text(
    `Generated on ${fmtDateTime(new Date())} by ${clean(generatedBy)}`,
    MARGIN,
    y
  );
  y += 4;

  doc.setDrawColor(203, 213, 225);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);

  return { doc, autoTable, y: y + 8, pageWidth };
}

// Starts a new page if there is not enough room left on this one
function ensureSpace(ctx, needed) {
  const pageHeight = ctx.doc.internal.pageSize.getHeight();
  if (ctx.y + needed > pageHeight - 18) {
    ctx.doc.addPage();
    ctx.y = 18;
  }
}

function addHeading(ctx, text) {
  ensureSpace(ctx, 30);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(13);
  ctx.doc.setTextColor(15, 23, 42);
  ctx.doc.text(clean(text), MARGIN, ctx.y);
  ctx.y += 6;
}

function addParagraph(ctx, text) {
  const maxWidth = ctx.pageWidth - MARGIN * 2;
  const lines = ctx.doc.splitTextToSize(clean(text), maxWidth);
  ensureSpace(ctx, lines.length * 4.5 + 4);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(...SLATE);
  ctx.doc.text(lines, MARGIN, ctx.y);
  ctx.y += lines.length * 4.5 + 4;
}

function runTable(ctx, options) {
  let lastY = ctx.y;
  ctx.autoTable(ctx.doc, {
    ...options,
    startY: ctx.y,
    margin: { top: 18, bottom: 18, left: MARGIN, right: MARGIN },
    didDrawPage: (data) => {
      lastY = data.cursor?.y ?? lastY;
    },
  });
  ctx.y = (ctx.doc.lastAutoTable?.finalY ?? lastY) + 8;
}

// A simple two-column list such as "Complaints reported | 120"
function addKeyValues(ctx, rows) {
  runTable(ctx, {
    body: rows.map(([label, value]) => [clean(label), clean(value)]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.5, textColor: [15, 23, 42] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 75 } },
  });
}

function addTable(ctx, { head, body, columnStyles, emptyText }) {
  if (body.length === 0) {
    addParagraph(ctx, emptyText ?? "Nothing to show.");
    return;
  }
  runTable(ctx, {
    head: [head],
    body: body.map((row) => row.map((cell) => clean(cell))),
    theme: "striped",
    headStyles: { fillColor: BLUE, textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak" },
    columnStyles: columnStyles ?? {},
    showHead: "everyPage",
  });
}

// A simple horizontal bar chart drawn with rectangles
function addBarChart(ctx, title, data) {
  if (data.length === 0) return;
  const rowHeight = 8;
  addHeading(ctx, title);
  ensureSpace(ctx, data.length * rowHeight + 4);

  const labelWidth = 60;
  const maxBarWidth = ctx.pageWidth - MARGIN * 2 - labelWidth - 20;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  data.forEach((row) => {
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(15, 23, 42);
    ctx.doc.text(clean(row.label), MARGIN, ctx.y + 4);

    const width = Math.max((row.value / maxValue) * maxBarWidth, 0.5);
    ctx.doc.setFillColor(...BLUE);
    ctx.doc.rect(MARGIN + labelWidth, ctx.y, width, 5, "F");
    ctx.doc.text(String(row.value), MARGIN + labelWidth + width + 2, ctx.y + 4);

    ctx.y += rowHeight;
  });
  ctx.y += 4;
}

// Adds page numbers to every page, then downloads the file
function finishDocument(ctx, name) {
  const { doc } = ctx;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text("Smart Campus Maintenance", MARGIN, height - 8);
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 8, {
      align: "right",
    });
  }
  doc.save(fileName(name));
}

// ---------- report 1: complaints ----------

export async function downloadComplaintsReport({
  complaints,
  rangeLabel,
  generatedBy,
}) {
  const ctx = await startDocument({
    title: "Complaints report",
    subtitle: `Period: ${rangeLabel}`,
    generatedBy,
    landscape: true,
  });

  const countBy = (key, value) =>
    complaints.filter((c) => c[key] === value).length;
  const average = averageResolutionDays(complaints);

  addHeading(ctx, "Summary");
  addKeyValues(ctx, [
    ["Complaints reported", complaints.length],
    [
      "Pending / In progress / Resolved",
      `${countBy("status", "pending")} / ${countBy("status", "in_progress")} / ${countBy("status", "resolved")}`,
    ],
    [
      "High / Medium / Low priority",
      `${countBy("priority", "high")} / ${countBy("priority", "medium")} / ${countBy("priority", "low")}`,
    ],
    [
      "Unresolved high-priority complaints",
      complaints.filter((c) => c.priority === "high" && c.status !== "resolved")
        .length,
    ],
    [
      "Average time to resolve",
      average === null ? "-" : `${average.toFixed(1)} days`,
    ],
  ]);

  const byCategory = {};
  complaints.forEach((c) => {
    const category = c.equipment?.category ?? "Unknown";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  });
  addBarChart(
    ctx,
    "Complaints by category",
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }))
  );

  addHeading(ctx, "All complaints in this period");
  addTable(ctx, {
    head: [
      "Reported",
      "Equipment",
      "Category",
      "Description",
      "Priority",
      "Status",
      "Resolved",
    ],
    body: complaints.map((c) => [
      fmtDate(c.created_at),
      `${c.equipment?.code ?? ""} ${c.equipment?.name ?? ""}`.trim(),
      c.equipment?.category ?? "",
      c.description,
      PRIORITY_LABELS[c.priority] ?? c.priority,
      STATUS_LABELS[c.status] ?? c.status,
      fmtDate(c.resolved_at),
    ]),
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 52 },
      2: { cellWidth: 32 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 20 },
      5: { cellWidth: 24 },
      6: { cellWidth: 24 },
    },
    emptyText: "No complaints were reported in this period.",
  });

  finishDocument(ctx, "complaints-report");
}

// ---------- report 2: equipment ----------

export async function downloadEquipmentReport({
  equipment,
  complaints,
  tasks,
  logs,
  rangeLabel,
  generatedBy,
}) {
  const ctx = await startDocument({
    title: "Equipment report",
    subtitle: `Complaint period: ${rangeLabel}`,
    generatedBy,
    landscape: true,
  });

  const activeTasks = tasks.filter((t) => t.active);
  const overdue = activeTasks.filter((t) => daysUntil(t.next_due) < 0).length;
  const countStatus = (status) =>
    equipment.filter((e) => e.status === status).length;

  // Work out the numbers for each piece of equipment
  const now = new Date();
  const stats = {};
  equipment.forEach((e) => {
    stats[e.id] = { count: 0, downtime: 0, lastMaintenance: null, nextDue: null };
  });
  complaints.forEach((c) => {
    const s = stats[c.equipment_id];
    if (!s) return;
    s.count += 1;
    const end = c.resolved_at ? new Date(c.resolved_at) : now;
    s.downtime += (end - new Date(c.created_at)) / DAY;
  });
  logs.forEach((l) => {
    const s = stats[l.equipment_id];
    if (!s) return;
    if (!s.lastMaintenance || l.completed_on > s.lastMaintenance) {
      s.lastMaintenance = l.completed_on;
    }
  });
  activeTasks.forEach((t) => {
    const s = stats[t.equipment_id];
    if (!s) return;
    if (!s.nextDue || t.next_due < s.nextDue) s.nextDue = t.next_due;
  });

  addHeading(ctx, "Summary");
  addKeyValues(ctx, [
    ["Equipment registered", equipment.length],
    [
      "Working / Faulty / Under repair / Retired",
      `${countStatus("working")} / ${countStatus("faulty")} / ${countStatus("under_repair")} / ${countStatus("retired")}`,
    ],
    ["Complaints in this period", complaints.length],
    ["Maintenance tasks overdue", overdue],
  ]);

  const withStats = equipment.map((e) => ({ ...e, ...stats[e.id] }));

  addHeading(ctx, "Recurring faults: top 10 equipment by complaints");
  addTable(ctx, {
    head: ["Rank", "ID", "Name", "Category", "Complaints"],
    body: [...withStats]
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((e, i) => [i + 1, e.code, e.name, e.category, e.count]),
    columnStyles: { 0: { cellWidth: 16 }, 4: { cellWidth: 28 } },
    emptyText: "No complaints in this period.",
  });

  addHeading(ctx, "Estimated downtime: top 10 equipment");
  addParagraph(
    ctx,
    "Estimate: total days that complaints stayed open (from report to resolution, or to today if still open)."
  );
  addTable(ctx, {
    head: ["Rank", "ID", "Name", "Category", "Days open"],
    body: [...withStats]
      .filter((e) => e.downtime > 0)
      .sort((a, b) => b.downtime - a.downtime)
      .slice(0, 10)
      .map((e, i) => [i + 1, e.code, e.name, e.category, e.downtime.toFixed(1)]),
    columnStyles: { 0: { cellWidth: 16 }, 4: { cellWidth: 28 } },
    emptyText: "No complaints in this period.",
  });

  addHeading(ctx, "Equipment register");
  addTable(ctx, {
    head: [
      "ID",
      "Name",
      "Category",
      "Location",
      "Status",
      "Complaints",
      "Last maintenance",
      "Next maintenance due",
    ],
    body: [...withStats]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((e) => [
        e.code,
        e.name,
        e.category,
        e.location,
        EQUIPMENT_STATUS_LABELS[e.status] ?? e.status,
        e.count,
        fmtDateOnly(e.lastMaintenance),
        fmtDateOnly(e.nextDue),
      ]),
    columnStyles: {
      0: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 30 },
      7: { cellWidth: 34 },
    },
    emptyText: "No equipment registered.",
  });

  finishDocument(ctx, "equipment-report");
}

// ---------- report 3: maintenance ----------

export async function downloadMaintenanceReport({
  tasks,
  logs,
  names,
  rangeLabel,
  generatedBy,
}) {
  const ctx = await startDocument({
    title: "Maintenance report",
    subtitle: `Completed maintenance period: ${rangeLabel}`,
    generatedBy,
    landscape: true,
  });

  const activeTasks = tasks
    .filter((t) => t.active)
    .sort((a, b) => a.next_due.localeCompare(b.next_due));
  const overdue = activeTasks.filter((t) => daysUntil(t.next_due) < 0).length;
  const dueSoon = activeTasks.filter((t) => {
    const days = daysUntil(t.next_due);
    return days >= 0 && days <= 14;
  }).length;

  addHeading(ctx, "Summary");
  addKeyValues(ctx, [
    ["Active maintenance tasks", activeTasks.length],
    ["Overdue", overdue],
    ["Due within 14 days", dueSoon],
    ["Completed in this period", logs.length],
  ]);

  addHeading(ctx, "Scheduled maintenance (overdue first)");
  addTable(ctx, {
    head: ["Equipment", "Task", "Repeats", "Due date", "Status", "Assigned to"],
    body: activeTasks.map((t) => [
      `${t.equipment?.code ?? ""} ${t.equipment?.name ?? ""}`.trim(),
      t.title,
      repeatText(t.interval_days),
      fmtDateOnly(t.next_due),
      dueText(daysUntil(t.next_due)),
      t.assigned_to ? names[t.assigned_to] ?? "A technician" : "Unassigned",
    ]),
    columnStyles: { 1: { cellWidth: 70 } },
    emptyText: "No maintenance is scheduled.",
  });

  addHeading(ctx, "Completed in this period");
  addTable(ctx, {
    head: ["Completed", "Equipment", "Task", "Completed by", "Note"],
    body: logs.map((l) => [
      fmtDateOnly(l.completed_on),
      `${l.equipment?.code ?? ""} ${l.equipment?.name ?? ""}`.trim(),
      l.maintenance_tasks?.title ?? "",
      names[l.completed_by] ?? "A technician",
      l.note ?? "",
    ]),
    columnStyles: {
      0: { cellWidth: 26 },
      4: { cellWidth: 80 },
    },
    emptyText: "No maintenance was completed in this period.",
  });

  finishDocument(ctx, "maintenance-report");
}

// ---------- report 4: one equipment's history ----------

export async function downloadEquipmentHistoryReport({
  item,
  complaints,
  notes,
  tasks,
  logs,
  generatedBy,
  showMaintenance,
  authorLabel,
  completerLabel,
}) {
  const ctx = await startDocument({
    title: `${item.code} - ${item.name}`,
    subtitle: "Equipment history report",
    generatedBy,
    landscape: false,
  });

  const ninetyDaysAgo = Date.now() - 90 * DAY;
  const recent = complaints.filter(
    (c) => new Date(c.created_at).getTime() >= ninetyDaysAgo
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === "resolved").length;
  const average = averageResolutionDays(complaints);

  addHeading(ctx, "Details");
  addKeyValues(ctx, [
    ["Equipment ID", item.code],
    ["Name", item.name],
    ["Category", item.category],
    ["Location", item.location],
    ["Status", EQUIPMENT_STATUS_LABELS[item.status] ?? item.status],
    ["Added to the register", fmtDate(item.created_at)],
  ]);

  addHeading(ctx, "Statistics");
  addKeyValues(ctx, [
    ["Complaints in total", complaints.length],
    ["Complaints in the last 90 days", recent],
    ["Resolved complaints", resolvedCount],
    [
      "Average time to resolve",
      average === null ? "-" : `${average.toFixed(1)} days`,
    ],
  ]);
  if (recent >= 3) {
    addParagraph(
      ctx,
      `Recurring faults: ${recent} complaints in the last 90 days. Consider a full inspection or replacement.`
    );
  }

  if (showMaintenance) {
    addHeading(ctx, "Scheduled maintenance");
    addTable(ctx, {
      head: ["Task", "Repeats", "Next due", "Status"],
      body: tasks.map((t) => [
        t.title,
        repeatText(t.interval_days),
        fmtDateOnly(t.next_due),
        dueText(daysUntil(t.next_due)),
      ]),
      emptyText: "No maintenance is scheduled for this equipment.",
    });

    if (logs.length > 0) {
      addHeading(ctx, "Completed maintenance");
      addTable(ctx, {
        head: ["Completed", "Task", "Completed by", "Note"],
        body: logs.map((l) => [
          fmtDateOnly(l.completed_on),
          l.maintenance_tasks?.title ?? "",
          completerLabel(l),
          l.note ?? "",
        ]),
        columnStyles: { 0: { cellWidth: 26 }, 3: { cellWidth: 70 } },
      });
    }
  }

  addHeading(ctx, "Complaint history");
  addTable(ctx, {
    head: ["Reported", "Resolved", "Priority", "Status", "Details"],
    body: complaints.map((c) => {
      const noteList = notes[c.id] ?? [];
      const noteText =
        noteList.length > 0
          ? "\n\nRepair notes:\n" +
            noteList
              .map(
                (n) =>
                  `- ${n.note} (${authorLabel(n)}, ${fmtDateTime(n.created_at)})`
              )
              .join("\n")
          : "";
      return [
        fmtDate(c.created_at),
        fmtDate(c.resolved_at),
        PRIORITY_LABELS[c.priority] ?? c.priority,
        STATUS_LABELS[c.status] ?? c.status,
        c.description + noteText,
      ];
    }),
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 24 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: "auto" },
    },
    emptyText: "No complaints recorded for this equipment.",
  });

  finishDocument(ctx, `equipment-${item.code}`);
}
