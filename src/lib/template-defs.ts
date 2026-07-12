export type TemplateCategory = "assignment" | "attendance" | "payment" | "welcome" | "critical_alert" | "caution_flag";
export type TemplateRecipient = "student" | "parent";
export type TemplateKey = `${TemplateCategory}_${TemplateRecipient}`;

export type TemplateCategoryDef = {
  category: TemplateCategory;
  label: string;
  usage: string;
  icon: "clipboard-list" | "cal-check" | "wallet" | "user-plus" | "alert";
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
  {
    category: "critical_alert",
    label: "Traffic light — Red tier (Critical Alert)",
    usage: "Sent by Heads/Assistants when a student drops to Red",
    icon: "alert",
    vars: ["{student}", "{org}", "{course}", "{month}"],
    student: {
      def: 'Dear {student},\nThis is an official notice regarding your tracking status in {course}.\n\nFollowing our latest review under the Traffic Light Tracker System, your profile has been moved to the Red Tier (Critical Alert).\n\nSTUDENT PROGRESS:\nYour records show either more than 40% missed assignments during the current {month} session, or your grade has dropped by 2 or more full grades down to a C grade or below.\n\nACTION TAKEN:\n1. Mandatory Office Hours Attendance: You have been added to the compulsory attendance list for our live Explanation & Solving office hours sessions. You must attend these sessions.\n2. Compulsory Mistake Diary Rewrite: Our assistant team is reviewing your past work. You must make sure all missing marks are corrected, and you must rewrite your mistakes so an assistant can sign them off.\n3. Weak Topic Review Framework: You will begin a strict revision plan to completely fix your previous weak concepts before you can move forward with upcoming topics.\n\nRegards,\n{org}',
    },
    parent: {
      def: 'Subject: Urgent Academic Status Update: {student} – {course}\n\nDear Parent,\nWe are writing to provide an urgent update regarding your student\'s current academic standing in {course}.\n\nUnder our Traffic Light Tracker System, {student}\'s status has dropped into the Red Tier (Critical Alert).\n\nSTUDENT PROGRESS:\nThe student has missed more than 40% of assignments during the current {month} session.\nOR: The student\'s grades have dropped by 2 full grades or more within the previous 2 weeks, falling to a C grade or below.\n\nACTION TAKEN:\n1. Mandatory Office Hours: The student has been placed on a compulsory attendance list for our live explanation and question-solving support sessions. Attendance is strictly required until their grades recover.\n2. Mistake Diary Check: Our assistant team is reviewing the student\'s Mistake Diary to ensure every mistake from past tests is corrected and rewritten for full marks.\n3. Weak Topic Review: We are starting a structured revision plan to fully re-explain previous weak topics before the student moves forward to new lessons.\n\nWe ask for your close support in making sure the student attends these live sessions and completes their assignments at home. Our team will stay in touch with you to report on their progress.\n\nWarm regards,\n{org}',
    },
  },
  {
    category: "caution_flag",
    label: "Traffic light — Yellow tier (Caution Flag)",
    usage: "Sent by Heads/Assistants when a student drops to Yellow",
    icon: "alert",
    vars: ["{student}", "{org}", "{course}"],
    student: {
      def: "Dear {student},\nYour grades have dropped a bit over your last two assignments (or you have hit the B range twice). Because of this, your status is currently at a Yellow Tier Caution Flag.\n\nTo get back on track right away, please take this simple action:\n- Review your mistakes in those previous assignments.\n- Reach out to me with any questions or doubts you have so we can clear them up before the next assignment.\n\nBest of luck,\n{org}",
    },
    parent: {
      def: "Dear Parent ({student}),\nWe track assignment grades closely each week to make sure our students stay on track for top marks.\n\nThis is a quick notification to let you know that {student}'s grades have dipped slightly over the last two assignments, placing them in our Yellow Tier (Caution Flag).\n\nThis is just an early check-in to fix things quickly. We have asked {student} to carefully review their mistakes from the previous assignments and to ask us about any doubts or questions they have. We appreciate your support in reminding them to look over our feedback this week.\n\nBest of luck,\n{org}",
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
