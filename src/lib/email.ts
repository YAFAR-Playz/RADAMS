// Thin wrapper around the Resend REST API — no SDK dependency needed for a
// single fire-and-forget call. Silently no-ops until RESEND_API_KEY is set,
// and never throws: a flaky email provider must never block the action
// (e.g. a staffing request) that triggered the notification.
export async function sendEmail(input: { to: string[]; subject: string; html: string; fromName?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !input.to.length) return;

  // The sending address itself (Resend requires a verified domain to send
  // from anything other than their shared sandbox address), but the display
  // name in front of it can — and should — reflect whichever org the
  // recipient belongs to, not a hardcoded platform name.
  const fromAddress = process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";
  const fromName = input.fromName?.trim() || "RadAMS";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <${fromAddress}>`, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!res.ok) {
      console.error("sendEmail failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("sendEmail error:", err);
  }
}

// Shared wrapper so every transactional email carries the recipient's own
// org branding (name + primary color) instead of a fixed platform look.
export function renderBrandedEmail(opts: { brandName: string; primaryColor: string; bodyHtml: string }): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="padding: 18px 24px; background: ${opts.primaryColor}; border-radius: 12px 12px 0 0;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 700;">${opts.brandName}</span>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; color: #111827; font-size: 14px; line-height: 1.6;">
        ${opts.bodyHtml}
      </div>
    </div>
  `;
}
