export type TemplateCategory = "assignment" | "attendance" | "payment" | "welcome";
export type TemplateRecipient = "student" | "parent";
export type TemplateKey = `${TemplateCategory}_${TemplateRecipient}`;

export type TemplateCategoryDef = {
  category: TemplateCategory;
  label: string;
  usage: string;
  icon: "clipboard-list" | "cal-check" | "wallet" | "user-plus";
  vars: string[];
  student: { def: string };
  parent: { def: string };
};

// Each category has one variable set shared by both recipient variants —
// what's available depends on the data the message is built from, not who
// it's sent to.
export const TEMPLATE_CATEGORY_DEFS: TemplateCategoryDef[] = [
  {
    category: "assignment",
    label: "Assignment update",
    usage: "Sent from assignment logging",
    icon: "clipboard-list",
    vars: ["{student}", "{org}", "{course}", "{assignment}", "{status}", "{grade}", "{comment}"],
    student: {
      def: 'Hi {student}, this is {org}.\n\nUpdate on "{assignment}":\nStatus: {status}{grade}\n\n{comment}\n\nThank you.',
    },
    parent: {
      def: 'Assalamu alaikum, this is {org}.\n\nUpdate for {student} on "{assignment}":\nStatus: {status}{grade}\n\n{comment}\n\nThank you.',
    },
  },
  {
    category: "attendance",
    label: "Attendance update",
    usage: "Sent per session",
    icon: "cal-check",
    vars: ["{student}", "{org}", "{session}", "{date}"],
    student: {
      def: "Hi {student}, this is {org}.\n\nYou were marked {status} for {session} on {date}.\n\nThank you.",
    },
    parent: {
      def: "Assalamu alaikum, this is {org}.\n\n{student} was marked {status} for {session} on {date}.\n\nThank you.",
    },
  },
  {
    category: "payment",
    label: "Payment reminder",
    usage: "Sent by Finance/Registration",
    icon: "wallet",
    vars: ["{student}", "{org}", "{course}", "{date}"],
    student: {
      def: "Hi {student}, this is a reminder that your fee for {course} is due on {date}. Please contact us with any questions.",
    },
    parent: {
      def: "Dear parent, this is a reminder that {student}'s fee for {course} is due on {date}. Please contact us with any questions.",
    },
  },
  {
    category: "welcome",
    label: "Welcome message",
    usage: "Sent by assistant on enrollment",
    icon: "user-plus",
    vars: ["{student}", "{id}", "{org}", "{course}", "{assistant_name}", "{student_group_link}", "{parent_group_link}"],
    student: {
      def: "Assalamu alaikum {student}! I'm {assistant_name}, your teaching assistant for {course} at {org}. Looking forward to working with you this term!\n\nJoin your student group: {student_group_link}",
    },
    parent: {
      def: "Assalamu alaikum, I'm {assistant_name}, {student}'s teaching assistant for {course} at {org}. I'll be sharing their progress with you this term. Please feel free to reach out any time.\n\nJoin the parent group: {parent_group_link}",
    },
  },
];

export const TEMPLATE_DEFS: {
  key: TemplateKey;
  category: TemplateCategory;
  recipient: TemplateRecipient;
  label: string;
  usage: string;
  icon: TemplateCategoryDef["icon"];
  vars: string[];
  def: string;
}[] = TEMPLATE_CATEGORY_DEFS.flatMap((c) => [
  { key: `${c.category}_student` as TemplateKey, category: c.category, recipient: "student" as const, label: c.label, usage: c.usage, icon: c.icon, vars: c.vars, def: c.student.def },
  { key: `${c.category}_parent` as TemplateKey, category: c.category, recipient: "parent" as const, label: c.label, usage: c.usage, icon: c.icon, vars: c.vars, def: c.parent.def },
]);
