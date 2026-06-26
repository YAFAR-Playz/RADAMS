"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { getPlatformDefaultLogo, uploadPlatformDefaultLogo, removePlatformDefaultLogo } from "@/lib/actions/branding";

export function OwnerBrandingContent() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setLogoUrl(await getPlatformDefaultLogo());
      } catch {
        setError("Couldn't load platform branding.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSelect(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { url } = await uploadPlatformDefaultLogo(formData);
      setLogoUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload this logo — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onRemove() {
    setUploading(true);
    setError(null);
    try {
      await removePlatformDefaultLogo();
      setLogoUrl(null);
    } catch {
      setError("Couldn't remove this logo — try again.");
    } finally {
      setUploading(false);
    }
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

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Owner · Platform</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Platform branding</h1>
        <p className="m-0 mt-[3px] max-w-[560px] text-[13px] leading-[1.5] text-[var(--muted)]">
          Set the default logo shown for any organization that hasn&apos;t uploaded its own. Each org can still override this from
          their own Branding page.
        </p>
      </div>

      <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <h3 className="m-0 mb-[14px] text-[14px] font-semibold text-[var(--text)]">Default logo</h3>
        {loading ? (
          <SkeletonRow className="h-16 w-16" />
        ) : (
          <div className="flex items-center gap-[15px]">
            <div className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[16px] bg-[var(--surface2)] text-[30px] font-bold text-[var(--muted)]">
              {uploading ? (
                <Spinner size={20} className="text-[var(--muted)]" />
              ) : logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Default logo" className="h-full w-full object-contain" />
              ) : (
                <Icon name="building" size={26} />
              )}
            </div>
            <div className="flex flex-col gap-[8px]">
              <div className="flex items-center gap-[8px]">
                <label className="flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[12px] py-[7px] text-[12.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                  <Icon name="upload" size={14} />
                  Upload default logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onSelect(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {logoUrl && (
                  <button
                    onClick={onRemove}
                    disabled={uploading}
                    className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] py-[7px] text-[12.5px] font-semibold text-[var(--danger)] hover:bg-[var(--dangers)] disabled:opacity-60"
                  >
                    <Icon name="x" size={13} />
                    Remove
                  </button>
                )}
              </div>
              <span className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">
                PNG, JPG, SVG or WEBP, up to 2MB. {logoUrl ? "Used by every org without its own logo." : "No default set — orgs without their own logo show a letter avatar."}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
