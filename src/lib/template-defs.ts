export type TemplateKey = "assignment" | "attendance" | "payment" | "welcome";

export const TEMPLATE_DEFS: { key: TemplateKey; label: string; usage: string; icon: "clipboard-list" | "cal-check" | "wallet" | "user-plus"; def: string }[] = [
  {
    key: "assignment",
    label: "Assignment update",
    usage: "Sent from assignment logging",
    icon: "clipboard-list",
    def: 'Assalamu alaikum, this is {org}.\n\nUpdate for {student} on "{assignment}":\nStatus: {status}{grade}\n\n{comment}\n\nThank you.',
  },
  {
    key: "attendance",
    label: "Attendance update",
    usage: "Sent per session",
    icon: "cal-check",
    def: "Assalamu alaikum, this is {org}.\n\n{student} was marked {status} for {session} on {date}.\n\nThank you.",
  },
  {
    key: "payment",
    label: "Payment reminder",
    usage: "Sent by Finance/Registration",
    icon: "wallet",
    def: "Dear parent, this is a reminder that {student}'s fee for {course} is due on {date}. Please contact us with any questions.",
  },
  {
    key: "welcome",
    label: "Welcome message",
    usage: "Sent by assistant on enrollment",
    icon: "user-plus",
    def: "Assalamu alaikum, I'm {assistant_name}, {student}'s teaching assistant for {course} at {org}. I'll be sharing their progress with you this term. Please feel free to reach out any time.",
  },
];
