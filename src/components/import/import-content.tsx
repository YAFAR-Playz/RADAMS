"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import { importStudents } from "@/lib/actions/import";

type FieldKey = "name" | "phone" | "email" | "guardianName" | "guardianPhone" | "ignore";

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: "name", label: "Student name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "guardianName", label: "Guardian name" },
  { value: "guardianPhone", label: "Guardian phone" },
  { value: "ignore", label: "— Ignore —" },
];

function guessField(header: string): FieldKey {
  const h = header.toLowerCase();
  if (h.includes("name") && h.includes("guardian")) return "guardianName";
  if (h.includes("name")) return "name";
  if (h.includes("guardian") && h.includes("phone")) return "guardianPhone";
  if (h.includes("phone") || h.includes("mobile")) return "phone";
  if (h.includes("email")) return "email";
  return "ignore";
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  const parseLine = (line: string) =>
    line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const headers = lines.length ? parseLine(lines[0]) : [];
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export function ImportContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
  }, []);

  const current = offerings?.find((o) => o.id === offeringId) ?? null;
  const offeringsLoading = offerings === null;

  function onFileSelected(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { headers, rows } = parseCsv(text);
      setHeaders(headers);
      setRawRows(rows);
      const initialMapping: Record<string, FieldKey> = {};
      headers.forEach((h) => (initialMapping[h] = guessField(h)));
      setMapping(initialMapping);
    };
    reader.readAsText(file);
  }

  function removeFile() {
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
  }

  const mappedRows = useMemo(() => {
    const idxByField: Partial<Record<FieldKey, number>> = {};
    headers.forEach((h, i) => {
      const field = mapping[h];
      if (field && field !== "ignore") idxByField[field] = i;
    });
    return rawRows.map((row, i) => {
      const name = idxByField.name != null ? row[idxByField.name] ?? "" : "";
      const phone = idxByField.phone != null ? row[idxByField.phone] ?? "" : "";
      const email = idxByField.email != null ? row[idxByField.email] ?? "" : "";
      const guardianName = idxByField.guardianName != null ? row[idxByField.guardianName] ?? "" : "";
      const guardianPhone = idxByField.guardianPhone != null ? row[idxByField.guardianPhone] ?? "" : "";
      const errorReason = !name.trim() ? "Missing student name" : !guardianPhone.trim() ? "Missing guardian phone" : null;
      return { n: i + 1, name, phone, email, guardianName, guardianPhone, error: errorReason };
    });
  }, [headers, rawRows, mapping]);

  const readyRows = mappedRows.filter((r) => !r.error);
  const errorRows = mappedRows.filter((r) => r.error);
  const visibleRows = onlyErrors ? errorRows : mappedRows;

  const STEPS = ["Upload", "Map columns", "Preview", "Done"];
  const hasFile = !!fileName;
  const nextOk = step === 0 ? hasFile && !!offeringId : step === 1 ? headers.length > 0 : true;

  async function onNext() {
    if (step === 2) {
      if (!offeringId) return;
      setImporting(true);
      try {
        const { imported } = await importStudents(
          offeringId,
          readyRows.map((r) => ({ name: r.name, phone: r.phone, email: r.email, guardianName: r.guardianName, guardianPhone: r.guardianPhone }))
        );
        setResult({ imported, errors: errorRows.length });
        setStep(3);
      } catch {
        setError("Couldn't import students — try again.");
      } finally {
        setImporting(false);
      }
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function onBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function onRestart() {
    setStep(0);
    removeFile();
    setResult(null);
  }

  function downloadErrorReport() {
    const lines = ["row,name,phone,email,guardian_name,guardian_phone,error"];
    for (const r of errorRows) {
      lines.push([r.n, r.name, r.phone, r.email, r.guardianName, r.guardianPhone, r.error].map((v) => `"${v ?? ""}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* HEADER + STEPPER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Registration</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Bulk import students</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Upload a CSV file, map its columns, then review before importing.</p>
        <div className="mt-[18px] flex flex-wrap items-center gap-y-[10px]">
          {STEPS.map((label, i) => {
            const done = i < step;
            const isCurrent = i === step;
            return (
              <div key={label} className="flex flex-none items-center">
                <div className="flex items-center gap-[9px] px-1">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] text-[12.5px] font-bold"
                    style={{
                      background: done ? "var(--brand)" : isCurrent ? "var(--brands)" : "var(--surface)",
                      color: done ? "var(--brandfg)" : isCurrent ? "var(--brand)" : "var(--subtle)",
                      borderColor: done || isCurrent ? "var(--brand)" : "var(--border)",
                    }}
                  >
                    {done ? <Icon name="check" size={14} /> : i + 1}
                  </div>
                  <span className="whitespace-nowrap text-[13px]" style={{ color: isCurrent ? "var(--text)" : "var(--muted)", fontWeight: isCurrent ? 600 : 500 }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="mx-1 h-[2px] w-[34px] bg-[var(--border)]" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 0: UPLOAD */}
      {step === 0 && (
        <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
          <h3 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text)]">Course offering</h3>
          <p className="m-0 mb-[14px] text-[13px] text-[var(--muted)]">Students will be enrolled into this course + session + unit combination.</p>
          <div className="mb-[22px]">
            {offeringsLoading ? (
              <SkeletonRow className="h-[42px] w-full max-w-[300px]" />
            ) : (
              <div className="flex h-[42px] max-w-[300px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                <select
                  value={offeringId ?? ""}
                  onChange={(e) => setOfferingId(e.target.value)}
                  className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-medium text-[var(--text)] outline-none"
                >
                  {(offerings ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-[var(--text)]">Upload file</h3>
          {!hasFile ? (
            <div className="flex flex-col items-center gap-[10px] rounded-[var(--rad)] border-2 border-dashed border-[var(--border)] bg-[var(--surface2)] p-[34px_20px] text-center">
              <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="upload" size={24} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[var(--text)]">Drag &amp; drop your file here</div>
                <div className="mt-[2px] text-[12.5px] text-[var(--muted)]">CSV file, up to 5,000 rows</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-4 py-[9px] text-[13px] font-semibold text-[var(--brandfg)]"
              >
                <Icon name="file-up" size={15} />
                Browse files
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[14px_16px]">
              <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] bg-[var(--oks)] text-[var(--ok)]">
                <Icon name="file-up" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{fileName}</div>
                <div className="text-[12px] text-[var(--muted)]">{rawRows.length} rows detected</div>
              </div>
              <button
                onClick={removeFile}
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)]"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: MAP COLUMNS */}
      {step === 1 && (
        <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <div className="border-b border-[var(--border2)] p-[16px_18px]">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Map columns</h3>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Match each column from your file to a ZAD-AMS field.</p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="flex items-center gap-[14px] border-b border-[var(--border2)] p-[10px_18px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                <span className="w-[170px] flex-none">File column</span>
                <span className="w-[160px] flex-none">Sample</span>
                <span className="flex-1">ZAD-AMS field</span>
              </div>
              {headers.map((h, i) => (
                <div key={h} className="flex items-center gap-[14px] border-b border-[var(--border2)] p-[12px_18px]">
                  <span className="w-[170px] flex-none truncate font-mono text-[13.5px] font-semibold text-[var(--text)]">{h}</span>
                  <span className="w-[160px] flex-none truncate text-[12.5px] text-[var(--muted)]">{rawRows[0]?.[i] ?? "—"}</span>
                  <div className="flex h-[38px] max-w-[240px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
                    <select
                      value={mapping[h] ?? "ignore"}
                      onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as FieldKey }))}
                      className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13px] font-medium text-[var(--text)] outline-none"
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 2 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { value: String(mappedRows.length), label: "Total rows", icon: "users" as const, bg: "var(--brands)", fg: "var(--brand)" },
              { value: String(readyRows.length), label: "Ready to import", icon: "check" as const, bg: "var(--oks)", fg: "var(--ok)" },
              { value: String(errorRows.length), label: "Rows with errors", icon: "alert" as const, bg: "var(--dangers)", fg: "var(--danger)" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[14px_16px] shadow-[var(--shadow)]">
                <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]" style={{ background: s.bg, color: s.fg }}>
                  <Icon name={s.icon} size={19} />
                </div>
                <div>
                  <div className="text-[21px] font-bold leading-none text-[var(--text)]">{s.value}</div>
                  <div className="mt-[2px] text-[12px] text-[var(--muted)]">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-[10px] border-b border-[var(--border2)] p-[14px_18px]">
              <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Preview &amp; validation</h3>
              <button
                onClick={() => setOnlyErrors((v) => !v)}
                className="flex items-center gap-[7px] rounded-[8px] border px-3 py-[7px] text-[12.5px] font-semibold"
                style={
                  onlyErrors
                    ? { background: "var(--dangers)", color: "var(--danger)", borderColor: "var(--danger)" }
                    : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
                }
              >
                <Icon name="alert" size={14} />
                {onlyErrors ? "Show all rows" : "Show errors only"}
              </button>
            </div>
            <div>
              <div className="hidden flex-wrap items-center gap-[10px_14px] border-b border-[var(--border2)] p-[10px_18px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)] sm:flex">
                <span className="w-[26px] flex-none">#</span>
                <span className="min-w-0 flex-[1.4_1_140px]">Student</span>
                <span className="min-w-0 flex-[1_1_110px]">Phone</span>
                <span className="min-w-0 flex-[1_1_130px]">Guardian phone</span>
                <span className="min-w-0 flex-[1_1_120px]">Status</span>
              </div>
              {visibleRows.map((r) => (
                <div
                  key={r.n}
                  className="flex flex-wrap items-center gap-[8px_14px] border-b border-[var(--border2)] p-[11px_18px]"
                  style={{ background: r.error ? "var(--dangers)" : "transparent" }}
                >
                  <span className="w-[26px] flex-none font-mono text-[12.5px] text-[var(--subtle)]">{r.n}</span>
                  <span className="min-w-0 flex-[1.4_1_140px] truncate text-[13.5px] font-semibold text-[var(--text)]">{r.name || "—"}</span>
                  <span className="min-w-0 flex-[1_1_110px] font-mono text-[13px] text-[var(--muted)]">{r.phone || "—"}</span>
                  <span className="min-w-0 flex-[1_1_130px] font-mono text-[13px] text-[var(--muted)]">{r.guardianPhone || "—"}</span>
                  <span
                    className="flex min-w-0 flex-[1_1_120px] items-center gap-[6px] text-[12.5px] font-semibold"
                    style={{ color: r.error ? "var(--danger)" : "var(--ok)" }}
                  >
                    <Icon name={r.error ? "alert" : "check"} size={14} />
                    {r.error ?? "Valid"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* STEP 3: DONE */}
      {step === 3 && result && (
        <div className="flex flex-col items-center gap-[14px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[34px_24px] text-center shadow-[var(--shadow)]">
          <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[var(--oks)] text-[var(--ok)]">
            <Icon name="check" size={30} />
          </div>
          <div>
            <h2 className="m-0 mb-[6px] text-[21px] font-semibold tracking-[-0.01em] text-[var(--text)]">{result.imported} students imported</h2>
            <p className="m-0 max-w-[380px] text-[14px] leading-[1.5] text-[var(--muted)]">
              Enrolled into <span className="font-semibold text-[var(--text)]">{current?.label}</span>.
              {result.errors > 0 ? ` ${result.errors} rows were skipped due to errors.` : ""}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-[10px]">
            {result.errors > 0 && (
              <button
                onClick={downloadErrorReport}
                className="flex items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                <Icon name="alert" size={15} />
                Download error report ({result.errors})
              </button>
            )}
            <button
              onClick={onRestart}
              className="flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
            >
              <Icon name="upload" size={15} />
              Import another file
            </button>
          </div>
        </div>
      )}

      {/* NAV BUTTONS */}
      {step !== 3 && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            disabled={step === 0}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-4 py-[10px] text-[13.5px] font-semibold disabled:cursor-not-allowed"
            style={{ color: step === 0 ? "var(--subtle)" : "var(--text)" }}
          >
            <Icon name="arrow-r" size={15} style={{ transform: "rotate(180deg)" }} />
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!nextOk || importing}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] px-[18px] py-[10px] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:cursor-not-allowed"
            style={{ background: nextOk ? "var(--brand)" : "var(--subtle)" }}
          >
            {importing && <Spinner size={15} />}
            {step === 2 ? `Import ${readyRows.length} students` : "Continue"}
            {!importing && <Icon name="arrow-r" size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}
