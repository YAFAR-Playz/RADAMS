"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  listStaffContracts,
  uploadStaffContract,
  getStaffContractUrl,
  deleteStaffContract,
  type StaffContractVersion,
} from "@/lib/actions/staff-reports";

export function StaffContractModal({ staffId, staffName, onClose }: { staffId: string; staffName: string; onClose: () => void }) {
  const [versions, setVersions] = useState<StaffContractVersion[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setVersions(await listStaffContracts(staffId));
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      await uploadStaffContract(staffId, formData);
      setFile(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the contract — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onView(id: string) {
    setOpeningId(id);
    try {
      const url = await getStaffContractUrl(id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("Couldn't open this contract — try again.");
    } catch {
      setError("Couldn't open this contract — try again.");
    } finally {
      setOpeningId(null);
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteStaffContract(id);
      await reload();
    } catch {
      setError("Couldn't remove this version — try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const current = versions?.[0] ?? null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
      <div className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
        <div className="flex flex-none items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
            <Icon name="file-up" size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Contract — {staffName}</h3>
            <div className="text-[12px] text-[var(--muted)]">PDF, Word doc, or a photo of the signed pages</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[16px_18px]">
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-3 py-2 text-[12.5px] font-medium text-[var(--danger)]">
              {error}
              <button onClick={() => setError(null)} className="flex-none">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}

          <div>
            <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Upload a new version</label>
            <div className="flex items-center gap-[10px]">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="min-w-0 flex-1 text-[12.5px] text-[var(--muted)] file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--surface2)] file:px-3 file:py-[7px] file:text-[12px] file:font-semibold file:text-[var(--text)]"
              />
              <button
                onClick={onUpload}
                disabled={!file || uploading}
                className="flex h-9 flex-none items-center justify-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[13px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {uploading ? <Spinner size={13} /> : <Icon name="upload" size={13} />}
                Upload
              </button>
            </div>
            {current && (
              <div className="mt-[10px] text-[12px] text-[var(--muted)]">
                Current: <span className="font-semibold text-[var(--text)]">{current.fileName}</span> — uploaded{" "}
                {new Date(current.uploadedAt).toLocaleDateString()}
                {current.uploadedByName ? ` by ${current.uploadedByName}` : ""}
              </div>
            )}
          </div>

          <div>
            <div className="mb-[8px] text-[12.5px] font-semibold text-[var(--text)]">Version history</div>
            {versions === null ? (
              <div className="flex flex-col gap-[6px]">
                <SkeletonRow className="h-[40px]" />
                <SkeletonRow className="h-[40px]" />
              </div>
            ) : versions.length === 0 ? (
              <div className="rounded-[var(--rad-sm)] border border-dashed border-[var(--border)] p-[16px] text-center text-[12.5px] text-[var(--muted)]">
                No contract uploaded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {versions.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-[10px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[9px_11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                        {v.fileName} {i === 0 && <span className="text-[var(--brand)]">(current)</span>}
                      </div>
                      <div className="text-[11px] text-[var(--subtle)]">
                        {new Date(v.uploadedAt).toLocaleDateString()}
                        {v.uploadedByName ? ` · ${v.uploadedByName}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => onView(v.id)}
                      disabled={openingId === v.id}
                      title="View"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
                    >
                      {openingId === v.id ? <Spinner size={13} /> : <Icon name="eye" size={14} />}
                    </button>
                    <button
                      onClick={() => onDelete(v.id)}
                      disabled={deletingId === v.id}
                      title="Delete this version"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                    >
                      {deletingId === v.id ? <Spinner size={13} /> : <Icon name="x" size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
