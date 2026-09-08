"use server";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";
import { getBranding } from "@/lib/actions/branding";
import { uploadStaffReportToDrive } from "@/lib/actions/drive";
import type { EvaluationItem, SalaryCourseLine } from "@/lib/actions/pay";

const ALLOWED_CONTRACT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_CONTRACT_BYTES = 10 * 1024 * 1024;

function requireHrOrAdmin(role: string | undefined) {
  if (role !== "hr" && role !== "admin") throw new Error("Not authorized");
}

async function requireContractEligibleStaff(staffId: string, orgId: string) {
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role, org_id").eq("id", staffId).maybeSingle();
  if (!target || target.org_id !== orgId) throw new Error("Staff member not found in your organization");
  if (target.role !== "assistant" && target.role !== "head") throw new Error("Contracts are only for assistants and heads");
}

export type StaffContractVersion = {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedByName: string | null;
};

// Full version history is kept — unlike salary receipts, a contract can be
// renewed/amended over time and HR may need to look back at an old version,
// not just the current one. "Current" is simply the most recent upload.
export async function uploadStaffContract(staffId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  requireHrOrAdmin(profile.role);
  await requireContractEligibleStaff(staffId, profile.org.id);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_CONTRACT_TYPES.includes(file.type)) throw new Error("Contract must be a PDF, Word document, PNG, JPG or WEBP file");
  if (file.size > MAX_CONTRACT_BYTES) throw new Error("Contract must be under 10MB");

  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${profile.org.id}/${staffId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage.from("contracts").upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await admin
    .from("staff_contracts")
    .insert({ org_id: profile.org.id, staff_id: staffId, path, file_name: file.name, uploaded_by: profile.id });
  if (error) throw new Error(error.message);

  await logActivity("staff", `Uploaded a contract for ${await staffName(staffId)}`);
}

async function staffName(staffId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", staffId).maybeSingle();
  return data?.full_name ?? "a staff member";
}

export async function listStaffContracts(staffId: string): Promise<StaffContractVersion[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  requireHrOrAdmin(profile.role);
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_contracts")
    .select("id, file_name, created_at, profiles!staff_contracts_uploaded_by_fkey(full_name)")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const uploader = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { id: row.id, fileName: row.file_name, uploadedAt: row.created_at, uploadedByName: uploader?.full_name ?? null };
  });
}

export async function getStaffContractUrl(contractId: string): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data: contract } = await supabase.from("staff_contracts").select("path").eq("id", contractId).maybeSingle();
  if (!contract) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("contracts").createSignedUrl(contract.path, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteStaffContract(contractId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  requireHrOrAdmin(profile.role);
  const admin = createAdminClient();

  const { data: contract } = await admin.from("staff_contracts").select("path, org_id").eq("id", contractId).maybeSingle();
  if (!contract || contract.org_id !== profile.org.id) throw new Error("Contract not found");

  await admin.storage.from("contracts").remove([contract.path]);
  const { error } = await admin.from("staff_contracts").delete().eq("id", contractId);
  if (error) throw new Error(error.message);
}

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export type StaffReportCourseOption = {
  offeringId: string;
  label: string;
  active: boolean;
  firstPeriod: string;
  lastPeriod: string;
};

// Every course this staff member has ever been paid for, from salary_lines
// (which persists forever — see removeAssistantFromOffering/removeStaffMember
// in staff.ts, neither ever touches salary_lines). offering_assistants/
// offering_heads are hard-deleted the moment someone's taken off a course, so
// they can only tell us who's CURRENTLY linked, not history — used here only
// to badge a course "left" vs "active".
export async function getStaffCoursesForReport(staffId: string): Promise<StaffReportCourseOption[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  requireHrOrAdmin(profile.role);
  const supabase = await createClient();

  const [{ data: target }, { data: lines }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", staffId).maybeSingle(),
    supabase.from("salary_lines").select("offering_id, period").eq("payee_id", staffId).not("offering_id", "is", null),
  ]);
  if (!target) return [];

  const byOffering = new Map<string, { first: string; last: string }>();
  for (const l of lines ?? []) {
    if (!l.offering_id) continue;
    const entry = byOffering.get(l.offering_id);
    if (!entry) byOffering.set(l.offering_id, { first: l.period, last: l.period });
    else {
      if (l.period < entry.first) entry.first = l.period;
      if (l.period > entry.last) entry.last = l.period;
    }
  }
  const offeringIds = Array.from(byOffering.keys());
  if (!offeringIds.length) return [];

  const [{ data: offeringRows }, { data: activeLinks }] = await Promise.all([
    supabase.from("course_offerings").select("id, session, unit, courses(name)").in("id", offeringIds),
    target.role === "head"
      ? supabase.from("offering_heads").select("offering_id").eq("head_id", staffId).in("offering_id", offeringIds)
      : supabase.from("offering_assistants").select("offering_id").eq("assistant_id", staffId).in("offering_id", offeringIds),
  ]);
  const activeIds = new Set((activeLinks ?? []).map((r) => r.offering_id));
  const offeringById = new Map((offeringRows ?? []).map((o) => [o.id, o]));

  return offeringIds
    .map((id) => {
      const entry = byOffering.get(id)!;
      return { offeringId: id, label: offeringLabel(offeringById.get(id) ?? null), active: activeIds.has(id), firstPeriod: entry.first, lastPeriod: entry.last };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function guessMimeType(path: string): string {
  switch (path.split(".").pop()?.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

type EmbeddableFile = { fileName: string; bytes: Uint8Array; mimeType: string };

export type StaffReportPeriod = { period: string; courses: SalaryCourseLine[] };

export type StaffReportData = {
  staffId: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
  hiredAt: string | null;
  leftAt: string | null;
  offeringLabels: string[];
  periods: StaffReportPeriod[];
  contract: EmbeddableFile | null;
  receiptsByPeriod: Record<string, EmbeddableFile>;
};

// Mirrors getMyPay's shape (pay.ts) so the report matches what the Pay tab
// itself shows — but across every period for the chosen offerings at once,
// and without getMyPay's `released` gate: HR/admin already see everything in
// Finance's own Salaries tab regardless of release status, so this shouldn't
// withhold anything either.
export async function getStaffReportData(staffId: string, offeringIds: string[]): Promise<StaffReportData> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  requireHrOrAdmin(profile.role);
  if (!offeringIds.length) throw new Error("Pick at least one course to include");
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("full_name, role, email, phone, hired_at, left_at")
    .eq("id", staffId)
    .maybeSingle();
  if (!staffProfile) throw new Error("Staff member not found");

  const [{ data: lines }, { data: evalRows }, { data: offeringRows }] = await Promise.all([
    supabase
      .from("salary_lines")
      .select(
        "period, offering_id, method, basis, base, bonus, deduction, bonus_reason, deduction_reason, course_offerings!salary_lines_offering_id_fkey(session, unit, courses(name))"
      )
      .eq("payee_id", staffId)
      .in("offering_id", offeringIds)
      .order("period", { ascending: true }),
    supabase.from("evaluations").select("offering_id, period, evaluation_lines(kind, category, note, amount)").eq("assistant_id", staffId).in("offering_id", offeringIds),
    supabase.from("course_offerings").select("id, session, unit, courses(name)").in("id", offeringIds),
  ]);

  const evalByKey = new Map<string, { extras: EvaluationItem[]; deductions: EvaluationItem[] }>();
  for (const ev of evalRows ?? []) {
    const evLines = Array.isArray(ev.evaluation_lines) ? ev.evaluation_lines : [];
    const toItem = (l: (typeof evLines)[number]) => ({ category: l.category, note: l.note, amount: Number(l.amount) });
    evalByKey.set(`${ev.offering_id}::${ev.period}`, {
      extras: evLines.filter((l) => l.kind === "extra").map(toItem),
      deductions: evLines.filter((l) => l.kind === "deduction").map(toItem),
    });
  }

  const periodsMap = new Map<string, SalaryCourseLine[]>();
  for (const l of lines ?? []) {
    const offering = Array.isArray(l.course_offerings) ? l.course_offerings[0] : l.course_offerings;
    const base = Number(l.base);
    const bonus = Number(l.bonus);
    const deduction = Number(l.deduction);
    const evalItems = l.offering_id ? evalByKey.get(`${l.offering_id}::${l.period}`) : undefined;
    const courseLine: SalaryCourseLine = {
      course: offeringLabel(offering),
      method: l.method,
      basis: l.basis,
      base,
      bonus,
      deduction,
      bonusReason: l.bonus_reason,
      deductionReason: l.deduction_reason,
      extraItems: evalItems?.extras ?? [],
      deductionItems: evalItems?.deductions ?? [],
      subtotal: base + bonus - deduction,
    };
    const list = periodsMap.get(l.period) ?? [];
    list.push(courseLine);
    periodsMap.set(l.period, list);
  }
  const periods = Array.from(periodsMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([period, courses]) => ({ period, courses }));

  const periodList = Array.from(periodsMap.keys());
  const { data: receiptRows } = periodList.length
    ? await supabase.from("salary_receipts").select("period, path").eq("payee_id", staffId).in("period", periodList)
    : { data: [] as { period: string; path: string }[] };

  const receiptsByPeriod: Record<string, EmbeddableFile> = {};
  for (const r of receiptRows ?? []) {
    const { data: blob } = await admin.storage.from("receipts").download(r.path);
    if (!blob) continue;
    receiptsByPeriod[r.period] = { fileName: r.path.split("/").pop() ?? r.path, bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: guessMimeType(r.path) };
  }

  const { data: contractRow } = await supabase
    .from("staff_contracts")
    .select("path, file_name")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let contract: EmbeddableFile | null = null;
  if (contractRow) {
    const { data: blob } = await admin.storage.from("contracts").download(contractRow.path);
    if (blob) contract = { fileName: contractRow.file_name, bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: guessMimeType(contractRow.path) };
  }

  const offeringById = new Map((offeringRows ?? []).map((o) => [o.id, o]));
  const offeringLabels = offeringIds.map((id) => offeringLabel(offeringById.get(id) ?? null));

  return {
    staffId,
    name: staffProfile.full_name,
    role: staffProfile.role,
    email: staffProfile.email,
    phone: staffProfile.phone,
    hiredAt: staffProfile.hired_at,
    leftAt: staffProfile.left_at,
    offeringLabels,
    periods,
    contract,
    receiptsByPeriod,
  };
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

// Small stateful cursor over a growing pdf-lib document — keeps the report
// assembly code below readable (draw calls just say what to draw, this
// handles wrapping to a new page once the cursor runs out of room).
class ReportCanvas {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;

  private constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create(): Promise<ReportCanvas> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return new ReportCanvas(doc, font, bold);
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < MARGIN) this.newPage();
  }

  wrap(text: string, size: number, bold = false): string[] {
    const font = bold ? this.bold : this.font;
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  text(value: string, opts: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.font;
    const color = opts.color ? rgb(...opts.color) : rgb(0.06, 0.09, 0.16);
    for (const line of this.wrap(value, size, opts.bold)) {
      this.ensureSpace(size + 4);
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color });
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 0;
  }

  row(cells: { text: string; x: number; bold?: boolean; size?: number; color?: [number, number, number] }[], gap = 4) {
    const height = Math.max(...cells.map((c) => c.size ?? 10.5));
    this.ensureSpace(height + gap);
    for (const c of cells) {
      const size = c.size ?? 10.5;
      const font = c.bold ? this.bold : this.font;
      const color = c.color ? rgb(...c.color) : rgb(0.06, 0.09, 0.16);
      this.page.drawText(c.text, { x: c.x, y: this.y, size, font, color });
    }
    this.y -= height + gap;
  }

  divider(gap = 10) {
    this.ensureSpace(gap + 2);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: rgb(0.85, 0.87, 0.91),
    });
    this.y -= gap;
  }
}

// Appends `file`'s content as its own page(s): real pages copied in if it's
// a PDF, or a single full-bleed page if it's an image. A labeled divider
// page comes first so it's clear what the following pages are.
async function appendFileSection(canvas: ReportCanvas, label: string, file: EmbeddableFile) {
  canvas.newPage();
  canvas.text(label, { size: 15, bold: true, gap: 10 });
  canvas.text(file.fileName, { size: 10, color: [0.4, 0.44, 0.51] });

  if (file.mimeType === "application/pdf") {
    try {
      const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const pages = await canvas.doc.copyPages(src, src.getPageIndices());
      for (const p of pages) canvas.doc.addPage(p);
    } catch {
      canvas.text("(Couldn't read this PDF file to embed it here — it's still on file in the app.)", { color: [0.72, 0.11, 0.11] });
    }
    return;
  }
  if (file.mimeType === "image/png" || file.mimeType === "image/jpeg") {
    try {
      const image = file.mimeType === "image/png" ? await canvas.doc.embedPng(file.bytes) : await canvas.doc.embedJpg(file.bytes);
      const maxWidth = PAGE_WIDTH - MARGIN * 2;
      const maxHeight = PAGE_HEIGHT - MARGIN * 2;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const page = canvas.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: (PAGE_WIDTH - w) / 2, y: (PAGE_HEIGHT - h) / 2, width: w, height: h });
    } catch {
      canvas.text("(Couldn't read this image file to embed it here — it's still on file in the app.)", { color: [0.72, 0.11, 0.11] });
    }
    return;
  }
  canvas.text("(This file type can't be embedded in the PDF — it's still on file in the app.)", { color: [0.4, 0.44, 0.51] });
}

async function buildStaffReportPdf(data: StaffReportData, orgName: string, generatedByName: string): Promise<Uint8Array> {
  const canvas = await ReportCanvas.create();

  canvas.text(orgName, { size: 12, color: [0.4, 0.44, 0.51], gap: 2 });
  canvas.text("Staff Report", { size: 20, bold: true, gap: 14 });

  canvas.text(data.name, { size: 14, bold: true, gap: 2 });
  canvas.text(data.role.charAt(0).toUpperCase() + data.role.slice(1), { size: 11, color: [0.4, 0.44, 0.51], gap: 8 });
  canvas.text(`Email: ${data.email}`, { size: 10.5 });
  if (data.phone) canvas.text(`Phone: ${data.phone}`, { size: 10.5 });
  if (data.hiredAt) canvas.text(`Hired: ${new Date(data.hiredAt).toLocaleDateString()}`, { size: 10.5 });
  if (data.leftAt) canvas.text(`Left: ${new Date(data.leftAt).toLocaleDateString()}`, { size: 10.5, color: [0.72, 0.11, 0.11] });
  canvas.text(`Courses covered: ${data.offeringLabels.join(", ")}`, { size: 10.5, gap: 4 });
  canvas.text(`Generated by ${generatedByName} on ${new Date().toLocaleDateString()}`, { size: 9.5, color: [0.4, 0.44, 0.51] });

  if (data.periods.length === 0) {
    canvas.divider(14);
    canvas.text("No salary history found for the selected course(s).", { color: [0.4, 0.44, 0.51] });
  }

  for (const p of data.periods) {
    canvas.divider(14);
    canvas.text(periodLabel(p.period), { size: 14, bold: true, gap: 8 });

    for (const c of p.courses) {
      canvas.text(c.course, { size: 11.5, bold: true, gap: 2 });
      if (c.basis) canvas.text(c.basis, { size: 10, color: [0.4, 0.44, 0.51] });
      canvas.row(
        [
          { text: `Base: ${c.base.toLocaleString()}`, x: MARGIN },
          { text: `Bonus: ${c.bonus.toLocaleString()}`, x: MARGIN + 130 },
          { text: `Deduction: ${c.deduction.toLocaleString()}`, x: MARGIN + 260 },
          { text: `Subtotal: ${c.subtotal.toLocaleString()}`, x: MARGIN + 400, bold: true },
        ],
        6
      );
      if (c.bonusReason) canvas.text(`Bonus reason: ${c.bonusReason}`, { size: 9.5, color: [0.4, 0.44, 0.51] });
      if (c.deductionReason) canvas.text(`Deduction reason: ${c.deductionReason}`, { size: 9.5, color: [0.4, 0.44, 0.51] });
      for (const item of c.extraItems) {
        canvas.text(`+ ${item.category ?? "Extra"}${item.note ? ` — ${item.note}` : ""} (${item.amount.toLocaleString()})`, { size: 9.5, color: [0.09, 0.5, 0.24] });
      }
      for (const item of c.deductionItems) {
        canvas.text(`- ${item.category ?? "Deduction"}${item.note ? ` — ${item.note}` : ""} (${item.amount.toLocaleString()})`, { size: 9.5, color: [0.72, 0.11, 0.11] });
      }
      canvas.y -= 6;
    }

    const receipt = data.receiptsByPeriod[p.period];
    canvas.text(receipt ? "Receipt on file for this period (attached later in this document)." : "No receipt uploaded for this period.", {
      size: 9.5,
      color: [0.4, 0.44, 0.51],
      gap: 4,
    });
  }

  if (data.contract) {
    await appendFileSection(canvas, "Contract", data.contract);
  } else {
    canvas.newPage();
    canvas.text("Contract", { size: 15, bold: true, gap: 8 });
    canvas.text("No contract has been uploaded for this staff member yet.", { color: [0.4, 0.44, 0.51] });
  }

  for (const p of data.periods) {
    const receipt = data.receiptsByPeriod[p.period];
    if (receipt) await appendFileSection(canvas, `Receipt — ${periodLabel(p.period)}`, receipt);
  }

  return canvas.doc.save();
}

export type GeneratedStaffReport = {
  fileName: string;
  url: string;
  driveFolderUrl: string | null;
  driveFileUrl: string | null;
  driveError: string | null;
};

const MONTH_YEAR_FOLDER_LABEL = () => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Builds the merged PDF (summary tables + contract + receipts) and stages it
// in a private bucket, handing back a short-lived signed URL rather than the
// raw bytes — a report with a full contract plus several receipts embedded
// can run several MB, comfortably past Vercel's serverless response-size
// limit for a Server Action's return value. Same reasoning as
// getSalaryReceiptUrl/getStaffContractUrl already use for their own files.
// Also delivers the same PDF to Drive (root > org > current month-year — not
// the periods the report COVERS, always today's date) via the Apps Script
// bridge; a Drive failure doesn't fail the whole call since the signed-URL
// download still succeeded — it's reported back via driveError instead so
// the UI can show it without losing the download the user already has.
export async function generateStaffReport(staffId: string, offeringIds: string[]): Promise<GeneratedStaffReport> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  requireHrOrAdmin(profile.role);

  const [data, branding] = await Promise.all([getStaffReportData(staffId, offeringIds), getBranding()]);
  const orgName = branding?.name ?? profile.org.name ?? "RadAMS";
  const pdfBytes = await buildStaffReportPdf(data, orgName, profile.fullName);

  const admin = createAdminClient();
  const path = `${profile.org.id}/${staffId}/${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage.from("staff-reports").upload(path, Buffer.from(pdfBytes), { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: signed, error: signError } = await admin.storage.from("staff-reports").createSignedUrl(path, 60 * 5);
  if (signError || !signed) throw new Error(signError?.message ?? "Couldn't prepare the report for download");

  const fileName = `${data.name} - Staff Report.pdf`;
  const monthYearFolder = MONTH_YEAR_FOLDER_LABEL();
  const driveResult = await uploadStaffReportToDrive({
    orgName,
    monthYearFolder,
    staffName: data.name,
    fileName,
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
  });

  await admin.from("staff_report_generations").insert({
    org_id: profile.org.id,
    staff_id: staffId,
    generated_by: profile.id,
    offering_ids: offeringIds,
    periods_covered: data.periods.map((p) => p.period),
    month_year_folder: monthYearFolder,
    drive_folder_url: driveResult.ok ? (driveResult.folderUrl ?? null) : null,
    drive_file_url: driveResult.ok ? (driveResult.fileUrl ?? null) : null,
    status: driveResult.ok ? "ok" : "error",
    error_message: driveResult.ok ? null : driveResult.error,
  });

  return {
    fileName,
    url: signed.signedUrl,
    driveFolderUrl: driveResult.ok ? (driveResult.folderUrl ?? null) : null,
    driveFileUrl: driveResult.ok ? (driveResult.fileUrl ?? null) : null,
    driveError: driveResult.ok ? null : (driveResult.error ?? "Couldn't deliver the report to Drive"),
  };
}

export type StaffReportHistoryEntry = {
  id: string;
  generatedAt: string;
  generatedByName: string | null;
  periodsCovered: string[];
  monthYearFolder: string;
  driveFileUrl: string | null;
  status: "ok" | "error";
  errorMessage: string | null;
};

export async function listStaffReportHistory(staffId: string): Promise<StaffReportHistoryEntry[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  requireHrOrAdmin(profile.role);
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_report_generations")
    .select("id, generated_at, periods_covered, month_year_folder, drive_file_url, status, error_message, profiles!staff_report_generations_generated_by_fkey(full_name)")
    .eq("staff_id", staffId)
    .order("generated_at", { ascending: false });

  return (data ?? []).map((row) => {
    const generator = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      generatedAt: row.generated_at,
      generatedByName: generator?.full_name ?? null,
      periodsCovered: row.periods_covered ?? [],
      monthYearFolder: row.month_year_folder,
      driveFileUrl: row.drive_file_url,
      status: row.status as "ok" | "error",
      errorMessage: row.error_message,
    };
  });
}

export type BulkReportCandidate = { staffId: string; name: string; role: string; departed: boolean; offeringIds: string[] };

// Every assistant/head — active and departed — with their full ever-worked
// offering list precomputed, for the client-side bulk "Generate all" loop
// (kept as a plain listing rather than looping internally here, so a large
// org's bulk run doesn't risk one serverless function's execution-time
// limit — the client drives the loop itself, one person at a time, the same
// way academic-report-content.tsx's chunked Drive delivery already does).
export async function listStaffForBulkReport(): Promise<BulkReportCandidate[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  requireHrOrAdmin(profile.role);
  const supabase = await createClient();

  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name, role, left_at")
    .eq("org_id", profile.org.id)
    .in("role", ["assistant", "head"]);

  const candidates = await Promise.all(
    (staffRows ?? []).map(async (p) => {
      const courses = await getStaffCoursesForReport(p.id);
      return { staffId: p.id, name: p.full_name, role: p.role, departed: !!p.left_at, offeringIds: courses.map((c) => c.offeringId) };
    })
  );
  return candidates.filter((c) => c.offeringIds.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}
