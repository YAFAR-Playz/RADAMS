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
    vars: ["{student}", "{grade}", "{org}", "{course}", "{month}"],
    student: {
      def: "Dear {student},\nyour scores are below where they need to be (currently at {grade}). An intensive Study Circles group has been done to give you the exact support you need to turn things around and achieve higher grades\nWe have built a structured plan to get you back on track:\n*   Topic Recap Plan: A clear study plan focusing on reviewing the essential concepts covered so far.\n*   Live Office Hours: Mandatory extra practice sessions where we will recap the most important parts of each topic together.\n*   Daily Checklist: A strict daily checklist to ensure you stay on top of your revision and related assignments.\n*   Re-do Exam: You will retake the exam at the end of this plan to demonstrate your upgraded knowledge.\n*   Creative Wrap-up: At the end, you'll create a summary note, video, or mind-map on a specific part chosen by the course head\nYou are now part of a study circle WhatsApp subgroup with your Head and Follow-Up Assistant who will monitor you daily. Kindly make sure to stay on track with the plan. Your success is our priority you have got this!\nBest of luck\nNG biology Team",
    },
    parent: {
      def: "Dear parent {student}\nبتواصل مع حضرتك بخصوص متابعة مستوى الطالب\nحالياً تقديره {grade} ولكن الطالب عنده القدرة للحصول على A او A*\nعلشان كدة قررنا نضمه لمجموعات المذاكرة والدعم الخاص بينا (study circles) في المتابعة دي هنوفر الآتي:\n-خطة مذاكرة منظمة: لمراجعة كل المواضيع اللي فاتت خطوة بخطوة.\n-حصص إضافية (Office Hours): مخصصة للحل والتدريب على الأجزاء والأسئلة الصعبة في كل موضوع.\n-جدول متابعة يومي (Daily Checklist): عشان نتأكد إنه بيذاكر وبيخلص واجباته أول بأول.\n-امتحان إعادة (Re-do Exam): في نهاية الخطة عشان نقيس مدى تحسنه ونشوف النتيجة مع بعض.\n\nابن حضرتك/بنت حضرتك انضم بالفعل لجروب واتساب فرعي مخصص للمرحلة دي مع course head و assistant المتابعة. هنبعت لحضرتك رسالة تحديث بعد مراجعة كل موضوع، وكمان تقرير كامل قبل امتحان الإعادة.\nبنتمنى من حضرتك التعاون معانا في البيت للالتزام بالخطة دي عشان نقدر نحقق النتيجة المطلوبة اللي.\nبالتوفيق\nNG Biology Team",
    },
  },
  {
    category: "caution_flag",
    label: "Traffic light — Yellow tier (Caution Flag)",
    usage: "Sent by Heads/Assistants when a student drops to Yellow",
    icon: "alert",
    vars: ["{student}", "{grade}", "{org}", "{course}"],
    student: {
      def: "Dear {student},\nyou are currently sitting at a {grade} grade. We know you have the potential to hit that A/A*, so we've designed a specialized Study Circles group just for you!\nTo help you lock in that top grade, you have been enrolled to a study circle subgroup that includes the following:\n* Custom Study Plan: A step-by-step plan to recap our covered topics.\n* Targeted Office Hours: Extra practice and recap office hours on previous topics to master the most challenging parts of each topic.\n* Daily Checklist: A quick daily tracker to keep your studying and assignments right on line.\n* Final Re-do Exam: A chance to re-sit the exam at the end of the plan to prove your progress.\n* Creative Wrap-up: At the end, you will be asked to create a summary note, video, or mind-map to lock in what you've learned in a specific part chosen by the course head.\nYou've been added to a dedicated WhatsApp subgroup with your Grade Head and Follow-Up Assistant. work together to turn that {grade} into an A/A*\nBest of luck,\nNG Biology Team",
    },
    parent: {
      def: "Dear parent {student}\nبتواصل مع حضرتك بخصوص متابعة مستوى الطالب\nحالياً تقديره {grade} ولكن الطالب عنده القدرة للحصول على A او A*\nعلشان كدة قررنا نضمه لمجموعات المذاكرة والدعم الخاص بينا (study circles) في المتابعة دي هنوفر الآتي:\n-خطة مذاكرة منظمة: لمراجعة كل المواضيع اللي فاتت خطوة بخطوة.\n-حصص إضافية (Office Hours): مخصصة للحل والتدريب على الأجزاء والأسئلة الصعبة في كل موضوع.\n-جدول متابعة يومي (Daily Checklist): عشان نتأكد إنه بيذاكر وبيخلص واجباته أول بأول.\n-امتحان إعادة (Re-do Exam): في نهاية الخطة عشان نقيس مدى تحسنه ونشوف النتيجة مع بعض.\n\nابن حضرتك/بنت حضرتك انضم بالفعل لجروب واتساب فرعي مخصص للمرحلة دي مع course head و assistant المتابعة. هنبعت لحضرتك رسالة تحديث بعد مراجعة كل موضوع، وكمان تقرير كامل قبل امتحان الإعادة.\nشاكرين جداً لتعاونكم وثقتكم المستمرة فينا\nبالتوفيق\nNG Biology Team",
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
