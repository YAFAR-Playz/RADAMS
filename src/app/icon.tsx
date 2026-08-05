import { ImageResponse } from "next/og";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBranding, getPlatformDefaultBranding } from "@/lib/actions/branding";

// Reads cookies via getCurrentProfile, so Next treats this as a
// request-time route and never caches one org's favicon for another.
export const size = { width: 64, height: 64 };

function letterIcon(letter: string, color: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: "#fff",
          fontSize: 38,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        {letter}
      </div>
    ),
    size
  );
}

// Signed-out visitors (login, reset-password) get the owner's platform
// default branding; once signed in, the current organization's own logo
// takes over — falling back to the platform default for any org that
// hasn't set one (getBranding() already encodes that fallback).
export default async function Icon() {
  const profile = await getCurrentProfile();
  const branding = (profile?.org ? await getBranding() : null) ?? (await getPlatformDefaultBranding());

  if (branding.logoUrl) {
    try {
      const res = await fetch(branding.logoUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/png";
        return new Response(await res.arrayBuffer(), { headers: { "Content-Type": contentType } });
      }
    } catch {
      // fall through to the letter icon below
    }
  }

  const letter = (branding.name.trim()[0] ?? "Z").toUpperCase();
  return letterIcon(letter, branding.primary);
}
