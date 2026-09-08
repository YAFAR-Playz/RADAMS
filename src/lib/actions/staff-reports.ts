"use server";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";
import { getBranding, getPlatformDefaultBranding, getStaffReportBrandingPreference } from "@/lib/actions/branding";
import { uploadStaffReportToDrive } from "@/lib/actions/drive";
import { currencySymbol } from "@/lib/currency";
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
  // salary_lines' own RLS only allows finance/admin (plus the payee
  // themself) to read it — HR was never granted that, since payroll detail
  // is normally Finance's domain. This action already enforces its own
  // hr-or-admin check above, so it deliberately reads via the admin client
  // rather than hitting that RLS wall and silently coming back empty for
  // HR (which looked exactly like "no salary history" for a real staff
  // member who genuinely has salary lines).
  const admin = createAdminClient();
  const supabase = await createClient();

  const [{ data: target }, { data: lines }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", staffId).maybeSingle(),
    // Unreleased salary is still provisional/editable by Finance — only
    // released periods count toward what this report can show, so the
    // picker's period range never promises a course/month the PDF won't
    // actually include.
    admin.from("salary_lines").select("offering_id, period").eq("payee_id", staffId).not("offering_id", "is", null).not("released_at", "is", null),
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

  // salary_lines/evaluations RLS only allows finance/admin (plus the
  // person themself) to read — not HR — so these go through the admin
  // client, same reasoning as getStaffCoursesForReport above. Only
  // released rows: unreleased salary is still provisional/editable by
  // Finance and shouldn't appear in a document handed to/about the
  // staff member.
  const [{ data: lines }, { data: evalRows }, { data: offeringRows }] = await Promise.all([
    admin
      .from("salary_lines")
      .select(
        "period, offering_id, method, basis, base, bonus, deduction, bonus_reason, deduction_reason, course_offerings!salary_lines_offering_id_fkey(session, unit, courses(name))"
      )
      .eq("payee_id", staffId)
      .in("offering_id", offeringIds)
      .not("released_at", "is", null)
      .order("period", { ascending: true }),
    admin.from("evaluations").select("offering_id, period, evaluation_lines(kind, category, note, amount)").eq("assistant_id", staffId).in("offering_id", offeringIds),
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
    ? await admin.from("salary_receipts").select("period, path").eq("payee_id", staffId).in("period", periodList)
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

type Color = [number, number, number];
const WHITE: Color = [1, 1, 1];
const TEXT_DARK: Color = [0.09, 0.11, 0.16];
const TEXT_MUTED: Color = [0.42, 0.46, 0.53];
const BORDER: Color = [0.88, 0.9, 0.93];
const OK: Color = [0.09, 0.5, 0.24];
const DANGER: Color = [0.72, 0.11, 0.11];
const DEFAULT_ACCENT: Color = [0.145, 0.388, 0.922];

function hexToColor(hex: string | null | undefined): Color {
  const clean = (hex ?? "").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (full.length !== 6 || Number.isNaN(parseInt(full, 16))) return DEFAULT_ACCENT;
  const num = parseInt(full, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function mix(a: Color, b: Color, t: number): Color {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// pdf-lib's standard Helvetica font only supports WinAnsi encoding (Latin-1
// plus a handful of Windows-1252 "smart punctuation" code points) and
// THROWS — crashing the whole report, not just misrendering one glyph —
// on anything else. This data comes from free-text fields real people
// type (names, categories, notes), so a stray curly quote, minus sign
// (−, distinct from a plain hyphen), emoji, or non-Latin script would
// otherwise take down every report until someone found and edited that
// one row. Replaces anything outside the safe range with "?" instead.
const WINANSI_SAFE_EXTRAS = new Set([0x2018, 0x2019, 0x201c, 0x201d, 0x2013, 0x2014, 0x2026, 0x2022, 0x00a0]);
function sanitizePdfText(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 63;
    out += (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_SAFE_EXTRAS.has(code) ? ch : "?";
  }
  return out;
}

// A logo URL comes from branding (Supabase Storage or wherever it's
// hosted) — fetched here rather than passed in as bytes since the caller
// only has the URL, and a broken/unreachable logo shouldn't fail report
// generation, just render without one.
async function fetchLogoBytes(logoUrl: string | null): Promise<{ bytes: Uint8Array; mime: "image/png" | "image/jpeg" } | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const mime = contentType.includes("png") ? "image/png" : contentType.includes("jpg") || contentType.includes("jpeg") ? "image/jpeg" : null;
    if (!mime) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

// Small stateful cursor over a growing pdf-lib document, themed with the
// org's brand color and logo — keeps the report assembly code below
// readable (draw calls just say what to draw structurally: a banner, a
// table, a line of text; this handles paginating and re-drawing table
// headers once the cursor runs out of room).
class ReportCanvas {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  accent: Color;
  accentTint: Color;
  logo: { image: PDFImage; ratio: number } | null;
  orgName: string;
  // Only pages this canvas itself drew — an appended contract/receipt's own
  // copied-in pages must never get a footer stamped over their own content.
  ownPages: PDFPage[] = [];

  private constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, accent: Color, logo: { image: PDFImage; ratio: number } | null, orgName: string) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.accent = accent;
    this.accentTint = mix(accent, WHITE, 0.88);
    this.logo = logo;
    this.orgName = sanitizePdfText(orgName);
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.ownPages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create(orgName: string, accentHex: string, logoFile: { bytes: Uint8Array; mime: "image/png" | "image/jpeg" } | null): Promise<ReportCanvas> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let logo: { image: PDFImage; ratio: number } | null = null;
    if (logoFile) {
      try {
        const image = logoFile.mime === "image/png" ? await doc.embedPng(logoFile.bytes) : await doc.embedJpg(logoFile.bytes);
        logo = { image, ratio: image.height / image.width };
      } catch {
        logo = null;
      }
    }
    return new ReportCanvas(doc, font, bold, hexToColor(accentHex), logo, orgName);
  }

  // A slim brand-colored rule at the top of every page after the cover —
  // a light, consistent "this document is themed" touch without repeating
  // the full cover band on every page.
  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.ownPages.push(this.page);
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 5, width: PAGE_WIDTH, height: 5, color: rgb(...this.accent) });
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < MARGIN) this.newPage();
  }

  // Cover header — a thin brand bar (same rule every other page gets) then a
  // plain bordered card holding the logo, a title, and a subtitle line.
  // Mirrors the org's existing "Salary Details" PDF style (thin top bar,
  // white card with logo + title) rather than a big solid color band.
  coverHeader(title: string, subtitle: string) {
    title = sanitizePdfText(title);
    subtitle = sanitizePdfText(subtitle);
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: rgb(...this.accent) });
    const top = PAGE_HEIGHT - 22;
    const height = 92;
    this.page.drawRectangle({ x: MARGIN, y: top - height, width: PAGE_WIDTH - MARGIN * 2, height, color: rgb(...WHITE), borderColor: rgb(...BORDER), borderWidth: 1 });
    let textX = MARGIN + 22;
    if (this.logo) {
      const logoH = 52;
      const logoW = logoH / this.logo.ratio;
      this.page.drawImage(this.logo.image, { x: MARGIN + 18, y: top - height / 2 - logoH / 2, width: logoW, height: logoH });
      textX = MARGIN + 18 + logoW + 18;
    }
    this.page.drawText(title, { x: textX, y: top - 40, size: 18, font: this.bold, color: rgb(...this.accent) });
    this.page.drawText(subtitle, { x: textX, y: top - 60, size: 10, font: this.font, color: rgb(...TEXT_MUTED) });
    this.y = top - height - 20;
  }

  // A real rounded rectangle with an actual border, via a single SVG path
  // (pdf-lib has no native corner-radius rectangle, but drawSvgPath renders
  // one clean continuous stroke — verified by rendering and visually
  // inspecting the output before relying on it here). `y` is the shape's
  // bottom edge in PDF space; the path itself is authored top-down (SVG
  // convention) with `height` as its own local origin.
  roundedRect(x: number, y: number, width: number, height: number, radius: number, opts: { fill?: Color; borderColor?: Color; borderWidth?: number } = {}) {
    const r = Math.min(radius, width / 2, height / 2);
    const path = `M${r},0 H${width - r} Q${width},0 ${width},${r} V${height - r} Q${width},${height} ${width - r},${height} H${r} Q0,${height} 0,${height - r} V${r} Q0,0 ${r},0 Z`;
    this.page.drawSvgPath(path, {
      x,
      y: y + height,
      color: opts.fill ? rgb(...opts.fill) : undefined,
      borderColor: opts.borderColor ? rgb(...opts.borderColor) : undefined,
      borderWidth: opts.borderColor ? (opts.borderWidth ?? 1) : undefined,
    });
  }

  // A fully-rounded "stadium" pill — the salary-breakdown value chips.
  pill(x: number, y: number, width: number, height: number, fill: Color, borderColor?: Color) {
    this.roundedRect(x, y, width, height, height / 2, { fill, borderColor, borderWidth: borderColor ? 1 : undefined });
  }

  // A bold heading with a colored underline (this org's own existing PDF
  // style for section breaks — h3{color; border-bottom} — rather than a
  // heavy full-width color band, which read as too "webpage-y" next to the
  // rest of this document's plain white background).
  heading(text: string, size = 14) {
    text = sanitizePdfText(text);
    this.ensureSpace(size + 10);
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font: this.bold, color: rgb(...this.accent) });
    this.y -= 5;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 1.5, color: rgb(...this.accent) });
    this.y -= 14;
  }

  // Small accent-colored uppercase label used above every card/section,
  // matching the reference sheet's blue "SALARY BREAKDOWN" / "ASSISTANT
  // DETAILS" style headings.
  sectionLabel(text: string, gap = 8) {
    this.ensureSpace(11 + gap);
    this.page.drawText(sanitizePdfText(text).toUpperCase(), { x: MARGIN, y: this.y, size: 9.5, font: this.bold, color: rgb(...this.accent) });
    this.y -= 11 + gap;
  }

  // One "Label ⋯ [ pill value ]" row — solid uses the full accent color
  // with white bold text (the Total Salary row); otherwise a light tint
  // with dark text, matching every other breakdown row.
  // "Label ⋯ [ pill value ]" — a light bordered pill with dark text for a
  // normal row, or a solid accent pill with white text for the Total row
  // (matching the org's existing salary PDF: pale pill values, solid pill
  // only for the grand total).
  breakdownRow(label: string, value: string, opts: { solid?: boolean } = {}) {
    label = sanitizePdfText(label);
    value = sanitizePdfText(value);
    const rowHeight = 28;
    const pillWidth = 130;
    this.ensureSpace(rowHeight + 6);
    const pillX = PAGE_WIDTH - MARGIN - pillWidth;
    this.page.drawText(label, { x: MARGIN, y: this.y - rowHeight / 2 - 4, size: opts.solid ? 11 : 10, font: this.bold, color: rgb(...TEXT_DARK) });
    this.pill(pillX, this.y - rowHeight, pillWidth, rowHeight, opts.solid ? this.accent : this.accentTint, opts.solid ? undefined : BORDER);
    const valueSize = opts.solid ? 11.5 : 10.5;
    const valueColor = opts.solid ? WHITE : TEXT_DARK;
    const w = this.bold.widthOfTextAtSize(value, valueSize);
    this.page.drawText(value, { x: pillX + (pillWidth - w) / 2, y: this.y - rowHeight / 2 - valueSize / 2.8, size: valueSize, font: this.bold, color: rgb(...valueColor) });
    this.y -= rowHeight + 6;
  }

  // A labeled note box for free text that can run long (basis strings,
  // bonus/deduction reasons) — its own full-width line rather than crammed
  // into a fixed-width table cell, which is what caused real overlap before.
  noteBox(label: string, text: string) {
    label = sanitizePdfText(label);
    text = sanitizePdfText(text);
    const padding = 12;
    const labelH = 9;
    const contentWidth = PAGE_WIDTH - MARGIN * 2 - padding * 2;
    const lines = this.wrap(text, 9.5, false, contentWidth);
    const height = labelH + 6 + lines.length * 13 + padding * 2 - 4;
    this.ensureSpace(height + 10);
    const top = this.y;
    this.roundedRect(MARGIN, top - height, PAGE_WIDTH - MARGIN * 2, height, 8, { fill: [0.98, 0.985, 0.995], borderColor: BORDER });
    this.page.drawText(label.toUpperCase(), { x: MARGIN + padding, y: top - padding - labelH + 2, size: 8, font: this.bold, color: rgb(...this.accent) });
    let ly = top - padding - labelH - 10;
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN + padding, y: ly, size: 9.5, font: this.font, color: rgb(...TEXT_DARK) });
      ly -= 13;
    }
    this.y = top - height - 10;
  }

  // A blue-labeled, bordered card of "left text ⋯ right value" rows
  // separated by thin rules — the extra-work / deduction breakdown lists.
  listRows(label: string, items: { left: string; right: string; color?: Color }[]) {
    if (!items.length) return;
    this.sectionLabel(label, 6);
    const padding = 10;
    const valueColW = 70;
    const leftWidth = PAGE_WIDTH - MARGIN * 2 - padding * 2 - valueColW - 10;
    const rowHeights = items.map((item) => Math.max(20, this.wrap(sanitizePdfText(item.left), 9.5, false, leftWidth).length * 13 + 7));
    const height = rowHeights.reduce((s, h) => s + h, 0) + padding * 2 - 4;
    this.ensureSpace(height + 8);
    const top = this.y;
    this.roundedRect(MARGIN, top - height, PAGE_WIDTH - MARGIN * 2, height, 8, { fill: WHITE, borderColor: BORDER });

    let ly = top - padding;
    items.forEach((rawItem, i) => {
      const item = { ...rawItem, left: sanitizePdfText(rawItem.left), right: sanitizePdfText(rawItem.right) };
      const lines = this.wrap(item.left, 9.5, false, leftWidth);
      const rowHeight = rowHeights[i];
      if (i > 0) {
        this.page.drawLine({ start: { x: MARGIN + padding, y: ly }, end: { x: PAGE_WIDTH - MARGIN - padding, y: ly }, thickness: 0.5, color: rgb(...BORDER) });
      }
      lines.forEach((line, li) => {
        this.page.drawText(line, { x: MARGIN + padding, y: ly - 13 - li * 13, size: 9.5, font: this.font, color: rgb(...TEXT_DARK) });
      });
      const valSize = 10;
      const w = this.bold.widthOfTextAtSize(item.right, valSize);
      this.page.drawText(item.right, { x: PAGE_WIDTH - MARGIN - padding - w, y: ly - 13, size: valSize, font: this.bold, color: rgb(...(item.color ?? TEXT_DARK)) });
      ly -= rowHeight;
    });
    this.y = top - height - 10;
  }

  // A 2-per-row grid of light bordered rounded boxes — small gray uppercase
  // label, bold value below — for the cover's staff-details block.
  detailGrid(items: { label: string; value: string; full?: boolean }[]) {
    const gap = 10;
    const padding = 12;
    const minBoxH = 42;
    const halfWidth = (PAGE_WIDTH - MARGIN * 2 - gap) / 2;
    // Height is driven by how many lines the value actually wraps to (e.g.
    // "Courses" listing several long names) — a fixed height let a second
    // wrapped line spill out past the box's own background before.
    const linesFor = (value: string, width: number) => this.wrap(sanitizePdfText(value), 10.5, true, width - padding * 2).slice(0, 3);
    const boxHeightFor = (lineCount: number) => Math.max(minBoxH, 28 + lineCount * 13);

    let i = 0;
    while (i < items.length) {
      const item = items[i];
      if (item.full) {
        const lines = linesFor(item.value, PAGE_WIDTH - MARGIN * 2);
        const boxH = boxHeightFor(lines.length);
        this.ensureSpace(boxH + gap);
        this.drawDetailBox(MARGIN, this.y - boxH, PAGE_WIDTH - MARGIN * 2, boxH, item.label, lines);
        this.y -= boxH + gap;
        i += 1;
      } else {
        const next = items[i + 1] && !items[i + 1].full ? items[i + 1] : null;
        const lines = linesFor(item.value, halfWidth);
        const nextLines = next ? linesFor(next.value, halfWidth) : [];
        const boxH = boxHeightFor(Math.max(lines.length, nextLines.length));
        this.ensureSpace(boxH + gap);
        this.drawDetailBox(MARGIN, this.y - boxH, halfWidth, boxH, item.label, lines);
        if (next) this.drawDetailBox(MARGIN + halfWidth + gap, this.y - boxH, halfWidth, boxH, next.label, nextLines);
        this.y -= boxH + gap;
        i += next ? 2 : 1;
      }
    }
  }

  private drawDetailBox(x: number, y: number, width: number, height: number, label: string, valueLines: string[]) {
    label = sanitizePdfText(label);
    this.roundedRect(x, y, width, height, 8, { fill: [0.975, 0.98, 0.988], borderColor: BORDER });
    const padding = 12;
    this.page.drawText(label.toUpperCase(), { x: x + padding, y: y + height - 17, size: 7.5, font: this.bold, color: rgb(...TEXT_MUTED) });
    valueLines.forEach((line, i) => {
      this.page.drawText(line, { x: x + padding, y: y + height - 32 - i * 13, size: 10.5, font: this.bold, color: rgb(...TEXT_DARK) });
    });
  }

  wrap(text: string, size: number, bold = false, maxWidth = PAGE_WIDTH - MARGIN * 2): string[] {
    text = sanitizePdfText(text);
    const font = bold ? this.bold : this.font;
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

  text(value: string, opts: { size?: number; bold?: boolean; gap?: number; color?: Color; indent?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.font;
    const color = rgb(...(opts.color ?? TEXT_DARK));
    const x = MARGIN + (opts.indent ?? 0);
    for (const line of this.wrap(value, size, opts.bold, PAGE_WIDTH - MARGIN * 2 - (opts.indent ?? 0))) {
      this.ensureSpace(size + 4);
      this.page.drawText(line, { x, y: this.y, size, font, color });
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 0;
  }

  finalizeFooters() {
    const total = this.ownPages.length;
    this.ownPages.forEach((p, i) => {
      p.drawText(`${this.orgName}  ·  Page ${i + 1} of ${total}`, { x: MARGIN, y: 24, size: 8.5, font: this.font, color: rgb(...TEXT_MUTED) });
    });
  }
}

// Appends `file`'s content as its own page(s): real pages copied in if it's
// a PDF, or a single full-bleed page if it's an image. A branded banner
// page comes first so it's clear what the following pages are.
async function appendFileSection(canvas: ReportCanvas, label: string, file: EmbeddableFile) {
  canvas.newPage();
  canvas.heading(label);
  canvas.text(file.fileName, { size: 10, color: TEXT_MUTED, gap: 8 });

  if (file.mimeType === "application/pdf") {
    try {
      const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const pages = await canvas.doc.copyPages(src, src.getPageIndices());
      for (const p of pages) canvas.doc.addPage(p);
    } catch {
      canvas.text("(Couldn't read this PDF file to embed it here — it's still on file in the app.)", { color: DANGER });
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
      canvas.text("(Couldn't read this image file to embed it here — it's still on file in the app.)", { color: DANGER });
    }
    return;
  }
  canvas.text("(This file type can't be embedded in the PDF — it's still on file in the app.)", { color: TEXT_MUTED });
}

// Follows the org's existing "Salary Details" PDF style: a bordered header
// card, boxed detail grids with small gray labels, and label+pill rows for
// money values, rather than a cramped table — the previous table layout let
// a long basis string (e.g. "Fixed base + 50 papers checked · prorated
// 26/31 — joined 2026-07-05") draw straight over the numeric columns next
// to it, since a single-line table cell has no wrapping. Free text (basis,
// bonus/deduction reasons) now always gets its own full-width box instead.
async function buildStaffReportPdf(
  data: StaffReportData,
  orgName: string,
  accentHex: string,
  currency: string,
  logo: { bytes: Uint8Array; mime: "image/png" | "image/jpeg" } | null
): Promise<Uint8Array> {
  const money = (n: number) => `${currency}${n.toLocaleString()}`;
  const canvas = await ReportCanvas.create(orgName, accentHex, logo);
  canvas.coverHeader("Staff Report", `${data.name} · ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}`);

  canvas.sectionLabel("Staff details");
  const details: { label: string; value: string; full?: boolean }[] = [
    { label: "Email", value: data.email },
    { label: "Phone", value: data.phone ?? "—" },
    ...(data.hiredAt ? [{ label: "Hired", value: new Date(data.hiredAt).toLocaleDateString() }] : []),
    ...(data.leftAt ? [{ label: "Left", value: new Date(data.leftAt).toLocaleDateString() }] : []),
    { label: "Courses", value: data.offeringLabels.join(", "), full: true },
  ];
  canvas.detailGrid(details);
  canvas.y -= 6;

  if (data.periods.length === 0) {
    canvas.text("No released salary history found for the selected course(s).", { color: TEXT_MUTED });
  }

  for (const p of data.periods) {
    canvas.heading(periodLabel(p.period), 15);

    for (const c of p.courses) {
      canvas.text(c.course, { size: 12.5, bold: true, color: TEXT_DARK, gap: 8 });
      canvas.sectionLabel("Salary breakdown", 6);
      canvas.breakdownRow("Base Salary", money(c.base));
      canvas.breakdownRow("Bonus", money(c.bonus));
      canvas.breakdownRow("Deductions", money(c.deduction));
      canvas.y -= 2;
      canvas.breakdownRow("Total Salary", money(c.subtotal), { solid: true });
      canvas.y -= 6;

      if (c.basis) canvas.noteBox("Basis", c.basis);
      if (c.bonusReason) canvas.noteBox("Bonus reason", c.bonusReason);
      if (c.deductionReason) canvas.noteBox("Deduction reason", c.deductionReason);

      canvas.listRows(
        "Extra work",
        c.extraItems.map((item) => ({ left: `${item.category ?? "Extra"}${item.note ? ` — ${item.note}` : ""}`, right: `+${money(item.amount)}`, color: OK }))
      );
      canvas.listRows(
        "Deductions breakdown",
        c.deductionItems.map((item) => ({ left: `${item.category ?? "Deduction"}${item.note ? ` — ${item.note}` : ""}`, right: `-${money(item.amount)}`, color: DANGER }))
      );
      canvas.y -= 14;
    }

    const receipt = data.receiptsByPeriod[p.period];
    canvas.text(receipt ? "Receipt on file for this period (attached later in this document)." : "No receipt uploaded for this period.", {
      size: 9,
      color: TEXT_MUTED,
      gap: 6,
    });
  }

  if (data.contract) {
    await appendFileSection(canvas, "Contract", data.contract);
  } else {
    canvas.newPage();
    canvas.heading("Contract");
    canvas.text("No contract has been uploaded for this staff member yet.", { color: TEXT_MUTED });
  }

  for (const p of data.periods) {
    const receipt = data.receiptsByPeriod[p.period];
    if (receipt) await appendFileSection(canvas, `Receipt — ${periodLabel(p.period)}`, receipt);
  }

  canvas.finalizeFooters();
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

  const admin = createAdminClient();
  const [data, usePlatformBranding, { data: orgRow }] = await Promise.all([
    getStaffReportData(staffId, offeringIds),
    getStaffReportBrandingPreference(),
    admin.from("organizations").select("currency").eq("id", profile.org.id).single(),
  ]);
  const branding = usePlatformBranding ? await getPlatformDefaultBranding() : await getBranding();
  const orgName = branding?.name ?? profile.org.name ?? "RadAMS";
  const logo = await fetchLogoBytes(branding?.logoUrl ?? null);
  const pdfBytes = await buildStaffReportPdf(data, orgName, branding?.primary ?? "#2563eb", currencySymbol(orgRow?.currency), logo);

  const path = `${profile.org.id}/${staffId}/${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage.from("staff-reports").upload(path, Buffer.from(pdfBytes), { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: signed, error: signError } = await admin.storage.from("staff-reports").createSignedUrl(path, 60 * 5);
  if (signError || !signed) throw new Error(signError?.message ?? "Couldn't prepare the report for download");

  const fileName = `${data.name} - Staff Report.pdf`;
  const monthYearFolder = MONTH_YEAR_FOLDER_LABEL();
  const { data: adminRows } = await admin.from("profiles").select("email").eq("org_id", profile.org.id).eq("role", "admin").is("left_at", null);
  const adminEmails = (adminRows ?? []).map((r) => r.email).filter((e): e is string => !!e);

  const driveResult = await uploadStaffReportToDrive({
    orgName,
    monthYearFolder,
    staffName: data.name,
    fileName,
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    adminEmails,
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
