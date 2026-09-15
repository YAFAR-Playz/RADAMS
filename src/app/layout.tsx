import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getCurrentProfile } from "@/lib/current-profile";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZAD-AMS",
  description: "The operating system for your tutoring center.",
};

// "auto" resolves by local clock — dark from 6pm to 6am, light the rest of
// the day — same boundary the ThemeToggle component re-applies every minute
// client-side (see app-shell.tsx) so a session open across either boundary
// switches live without needing a reload.
const THEME_SCRIPT = `
(function () {
  try {
    var mode = localStorage.getItem("radams-theme") || "auto";
    var resolved = mode;
    if (mode === "auto") {
      var hour = new Date().getHours();
      resolved = (hour >= 18 || hour < 6) ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The favicon URL itself must vary per org — see the comment in
  // src/app/org-icon/route.tsx for why a fixed URL (which is what Next's
  // special-file `icon.tsx` convention produces) let a browser tab keep
  // showing a stale org's icon indefinitely across logins.
  const profile = await getCurrentProfile();
  const iconHref = `/org-icon?org=${profile?.org?.id ?? "default"}`;
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isArabicRoute = pathname === "/ar" || pathname.startsWith("/ar/");

  return (
    <html
      lang={isArabicRoute ? "ar" : "en"}
      dir={isArabicRoute ? "rtl" : "ltr"}
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href={iconHref} sizes="64x64" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)]">{children}</body>
    </html>
  );
}
