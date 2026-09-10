import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)]">{children}</body>
    </html>
  );
}
