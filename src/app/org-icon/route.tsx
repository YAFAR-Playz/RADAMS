import { ImageResponse } from "next/og";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBranding, getPlatformDefaultBranding } from "@/lib/actions/branding";

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

// Replaces the old special-file `app/icon.tsx` convention, which Next wires
// to one fixed, build-time-hashed `<link rel="icon" href="/icon?<hash>">`
// used for every request regardless of who's asking. The favicon bytes were
// correctly regenerated per-request server-side (this file's logic hasn't
// changed), but browsers cache a favicon by its URL, and that URL never
// changed between orgs — so a browser tab kept showing whatever org's icon
// it first fetched under that one shared URL, sometimes for weeks, no
// matter how many other orgs were logged into afterward in the meantime.
// The fix has to be in the URL, not the response: the root layout now
// builds this route's href with `?org=<id-or-"default">` baked in (see
// layout.tsx), so different orgs are genuinely different URLs a browser
// must fetch separately, while the same org's icon still benefits from
// normal caching instead of being refetched on every navigation.
export async function GET() {
  const profile = await getCurrentProfile();
  const branding = (profile?.org ? await getBranding() : null) ?? (await getPlatformDefaultBranding());

  const headers = { "Cache-Control": "public, max-age=3600, must-revalidate" };

  if (branding.logoUrl) {
    try {
      const res = await fetch(branding.logoUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/png";
        return new Response(await res.arrayBuffer(), { headers: { ...headers, "Content-Type": contentType } });
      }
    } catch {
      // fall through to the letter icon below
    }
  }

  const letter = (branding.name.trim()[0] ?? "Z").toUpperCase();
  const image = letterIcon(letter, branding.primary);
  for (const [key, value] of Object.entries(headers)) image.headers.set(key, value);
  return image;
}
