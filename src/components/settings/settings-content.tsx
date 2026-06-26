"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  getMyProfile,
  updateMyDetails,
  updateMyEmail,
  updateMyPassword,
  uploadMyAvatar,
  removeMyAvatar,
  type MyProfile,
} from "@/lib/actions/settings";

export function SettingsContent() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const data = await getMyProfile();
      setProfile(data);
      setName(data?.fullName ?? "");
      setPhone(data?.phone ?? "");
      setEmail(data?.email ?? "");
    } catch {
      setError("Couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }

  async function onSaveDetails() {
    setSavingDetails(true);
    setError(null);
    try {
      await updateMyDetails({ fullName: name, phone });
      await reload();
      flashSuccess("Profile updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your details — try again.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function onSaveEmail() {
    setSavingEmail(true);
    setError(null);
    try {
      await updateMyEmail(email);
      flashSuccess("Check your new email for a confirmation link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update your email — try again.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function onSavePassword() {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      await updateMyPassword(password);
      setPassword("");
      setConfirmPassword("");
      flashSuccess("Password updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update your password — try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function onAvatarSelected(file: File) {
    setAvatarUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { url } = await uploadMyAvatar(formData);
      setProfile((p) => p && { ...p, avatarUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload your profile picture — try again.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onAvatarRemove() {
    setAvatarUploading(true);
    setError(null);
    try {
      await removeMyAvatar();
      setProfile((p) => p && { ...p, avatarUrl: null });
    } catch {
      setError("Couldn't remove your profile picture — try again.");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonRow className="h-[100px]" />
        <SkeletonRow className="h-[220px]" />
        <SkeletonRow className="h-[160px]" />
      </div>
    );
  }

  const initials = (profile.fullName.trim()[0] ?? "U").toUpperCase();

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
      {success && (
        <div className="flex items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--ok)] bg-[var(--oks)] px-4 py-3 text-[13px] font-medium text-[var(--ok)]">
          <Icon name="check2" size={16} />
          {success}
        </div>
      )}

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Account</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Settings</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Manage your own profile, contact details and login.</p>
      </div>

      {/* PROFILE PICTURE + NAME + PHONE */}
      <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <h3 className="m-0 mb-[14px] text-[14px] font-semibold text-[var(--text)]">Profile</h3>
        <div className="mb-4 flex items-center gap-[15px]">
          <div className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--brand)] text-[26px] font-bold text-white">
            {avatarUploading ? (
              <Spinner size={20} className="text-white" />
            ) : profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <label className="flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[12px] py-[7px] text-[12.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                <Icon name="upload" size={14} />
                Upload photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onAvatarSelected(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {profile.avatarUrl && (
                <button
                  onClick={onAvatarRemove}
                  disabled={avatarUploading}
                  className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] py-[7px] text-[12.5px] font-semibold text-[var(--danger)] hover:bg-[var(--dangers)] disabled:opacity-60"
                >
                  <Icon name="x" size={13} />
                  Remove
                </button>
              )}
            </div>
            <span className="text-[11.5px] text-[var(--subtle)]">PNG, JPG or WEBP, up to 2MB.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div>
            <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
            />
          </div>
          <div>
            <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="7700 900000"
              className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
            />
          </div>
        </div>
        <button
          onClick={onSaveDetails}
          disabled={savingDetails || (name === profile.fullName && phone === (profile.phone ?? ""))}
          className="mt-[14px] flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[16px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
        >
          {savingDetails ? <Spinner size={14} /> : <Icon name="check" size={14} />}
          Save profile
        </button>
      </section>

      {/* EMAIL */}
      <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <h3 className="m-0 mb-[5px] text-[14px] font-semibold text-[var(--text)]">Email</h3>
        <p className="m-0 mb-[14px] text-[12px] text-[var(--muted)]">Changing this sends a confirmation link to the new address before it takes effect.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-[42px] w-full max-w-[360px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
        />
        <button
          onClick={onSaveEmail}
          disabled={savingEmail || email === profile.email || !email.trim()}
          className="mt-[14px] flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[16px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
        >
          {savingEmail ? <Spinner size={14} /> : <Icon name="check" size={14} />}
          Update email
        </button>
      </section>

      {/* PASSWORD */}
      <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <h3 className="m-0 mb-[14px] text-[14px] font-semibold text-[var(--text)]">Password</h3>
        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div>
            <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
            />
          </div>
          <div>
            <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
            />
          </div>
        </div>
        <button
          onClick={onSavePassword}
          disabled={savingPassword || !password || !confirmPassword}
          className="mt-[14px] flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[16px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
        >
          {savingPassword ? <Spinner size={14} /> : <Icon name="check" size={14} />}
          Update password
        </button>
      </section>
    </div>
  );
}
