// Parses a Zoom "Attendee Report" export — not a flat single-header CSV, but
// several sections (a 4-line summary block, then Host Details, Panelist
// Details, and Attendee Details, each with its own header row). Only
// Attendee Details rows are real students; Host/Panelist rows are staff and
// are skipped entirely by only ever reading from the Attendee Details
// section onward.

export type ParsedAttendee = {
  // The number inside "[ID: 1234]" appended to the attendee's Zoom display
  // name — an org using Attendance ID matching assigns this same id to a
  // student during import, so it's the match key here. Null when a row has
  // no bracket id at all (rare, but not impossible for a manual guest join).
  extractedId: string | null;
  name: string;
  email: string;
  // Summed across every join/leave segment for this email — a spotty
  // connection produces several rows per person, not one.
  minutesAttended: number;
};

export type ParsedZoomReport = { durationMinutes: number; attendees: ParsedAttendee[]; error: string | null };

// A real CSV-line tokenizer (quote-aware, handles embedded commas and
// escaped "" quotes) rather than a naive line.split(",") — Zoom's own quoted
// datetime fields don't happen to contain commas today, but a topic name or
// guest-entered name easily could, and getting this wrong would silently
// misalign every column after it.
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function findColumn(header: string[], name: string): number {
  return header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

export function parseZoomAttendanceCsv(text: string): ParsedZoomReport {
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 4) {
    return { durationMinutes: 0, attendees: [], error: "This doesn't look like a Zoom Attendee Report CSV." };
  }

  // Fixed by Zoom's own export format: line 3 (index 2) is the summary
  // header, line 4 (index 3) its one data row — read directly rather than
  // asking the user to type the session's length.
  const summaryHeader = parseCsvLine(lines[2]);
  const summaryData = parseCsvLine(lines[3]);
  const durationIdx = findColumn(summaryHeader, "Actual Duration (minutes)");
  if (durationIdx === -1) {
    return { durationMinutes: 0, attendees: [], error: "Couldn't find the session duration - make sure this is an unmodified Zoom Attendee Report export." };
  }
  const durationMinutes = parseInt((summaryData[durationIdx] ?? "").trim(), 10) || 0;

  const attendeeMarkerIdx = lines.findIndex((l) => l.trim() === "Attendee Details");
  if (attendeeMarkerIdx === -1 || attendeeMarkerIdx + 1 >= lines.length) {
    return { durationMinutes, attendees: [], error: 'Couldn\'t find the "Attendee Details" section in this file.' };
  }
  const attendeeHeader = parseCsvLine(lines[attendeeMarkerIdx + 1]);
  const idxAttended = findColumn(attendeeHeader, "Attended");
  const idxUserName = findColumn(attendeeHeader, "User Name (Original Name)");
  const idxLastName = findColumn(attendeeHeader, "Last Name");
  const idxEmail = findColumn(attendeeHeader, "Email");
  const idxMinutes = findColumn(attendeeHeader, "Time in Session (minutes)");
  if ([idxAttended, idxUserName, idxEmail, idxMinutes].some((i) => i === -1)) {
    return { durationMinutes, attendees: [], error: "This file's Attendee Details columns don't match what's expected - make sure it's an unmodified Zoom Attendee Report export." };
  }

  const ID_RE = /\[ID:\s*([^\]]+)\]/;
  const byEmail = new Map<string, { name: string; email: string; minutes: number; extractedId: string | null }>();
  for (let i = attendeeMarkerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = parseCsvLine(line);
    // A registrant who never actually joined shows "Attended: No" with
    // Join/Leave/Time-in-Session all literally "--" (read as 0 minutes
    // below) — still included rather than skipped, since 0 minutes against
    // any real session length naturally computes to "absent" through the
    // same threshold logic as everyone else, and leaving them out entirely
    // would silently hide that they were even in the file.
    const userName = (cells[idxUserName] ?? "").trim();
    const email = (cells[idxEmail] ?? "").trim().toLowerCase();
    if (!email) continue;
    const minutesRaw = (cells[idxMinutes] ?? "").trim();
    const minutes = minutesRaw === "--" || minutesRaw === "" ? 0 : parseInt(minutesRaw, 10) || 0;

    // Zoom doesn't consistently put the "[ID: 1234]" tag in the same field —
    // most rows carry it in User Name (Original Name), but a real export
    // showed a "did not attend" row with it in Last Name instead (User Name
    // was just a bare first name with no tag at all). Checking both covers
    // it without guessing further.
    const lastName = idxLastName !== -1 ? (cells[idxLastName] ?? "").trim() : "";
    const idMatch = userName.match(ID_RE) ?? lastName.match(ID_RE);
    const extractedId = idMatch ? idMatch[1].trim() : null;
    const cleanName =
      userName
        .replace(/\s*-?\s*\[ID:\s*[^\]]+\]/g, "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim() || userName;

    const existing = byEmail.get(email);
    if (existing) {
      existing.minutes += minutes;
      if (!existing.extractedId && extractedId) existing.extractedId = extractedId;
    } else {
      byEmail.set(email, { name: cleanName, email, minutes, extractedId });
    }
  }

  return {
    durationMinutes,
    attendees: Array.from(byEmail.values()).map((a) => ({ extractedId: a.extractedId, name: a.name, email: a.email, minutesAttended: a.minutes })),
    error: null,
  };
}

export type AttendanceStatusGuess = "present" | "late" | "absent";

// Thresholds are org-configurable (Organization settings, shown once
// Attendance ID matching is turned on) rather than fixed — every org's own
// definition of "counts as late" varies. The review step before committing
// always shows the computed status as an editable dropdown regardless, so a
// borderline call is never silently locked in.
//
// latePct is optional — an org that doesn't track a separate "late" cutoff
// leaves it unset, collapsing this to a binary present/absent call instead
// of the three-way present/late/absent split.
export function guessAttendanceStatus(minutesAttended: number, durationMinutes: number, presentPct: number, latePct: number | null): AttendanceStatusGuess {
  if (durationMinutes <= 0) return "absent";
  const pct = (minutesAttended / durationMinutes) * 100;
  if (pct >= presentPct) return "present";
  if (latePct !== null && pct >= latePct) return "late";
  return "absent";
}
