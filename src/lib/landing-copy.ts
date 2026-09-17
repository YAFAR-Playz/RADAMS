export type Locale = "en" | "ar";

// Verified via a live query against production data on 2026-09-15 across the
// platform's 2 real customer orgs (excluding Test/Demo orgs), then rounded
// down for a safe, honest "at least this many" claim: 5,522 total students /
// 5,500 active enrollments, 235 staff, 41,000 papers checked, 27,671
// attendance records. Hardcoded rather than live-queried on every page load —
// this is a periodically-refreshed marketing figure, not a live dashboard
// metric, and a public unauthenticated page shouldn't run DB queries on every
// visit for a number that only needs updating every few months.
export const LANDING_STATS = [
  { value: "5,500+", key: "students" },
  { value: "230+", key: "staff" },
  { value: "40,000+", key: "papers" },
  { value: "27,000+", key: "attendance" },
] as const;

export type FeatureKey = "attendance" | "assignments" | "payroll" | "weakTopics" | "messaging" | "reports";
export type RoleKey = "admin" | "head" | "assistant" | "registration" | "finance" | "hr";

export type LandingCopy = {
  locale: Locale;
  dir: "ltr" | "rtl";
  nav: { features: string; roles: string; stats: string; contact: string; signIn: string };
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; secondaryCta: string };
  features: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Record<FeatureKey, { title: string; body: string }>;
  };
  roles: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Record<RoleKey, { title: string; body: string }>;
  };
  stats: { eyebrow: string; title: string; labels: Record<(typeof LANDING_STATS)[number]["key"], string> };
  contact: {
    eyebrow: string;
    title: string;
    subtitle: string;
    fields: {
      firstName: string;
      lastName: string;
      organization: string;
      email: string;
      phone: string;
      studentRange: string;
      studentRangePlaceholder: string;
      message: string;
      messagePlaceholder: string;
    };
    submit: string;
    submitting: string;
    success: string;
    error: string;
  };
  footer: { rights: string; signIn: string };
};

export const STUDENT_RANGES = ["1–50", "51–150", "151–400", "401–1000", "1000+"];

const en: LandingCopy = {
  locale: "en",
  dir: "ltr",
  nav: { features: "Features", roles: "Roles", stats: "Stats", contact: "Contact us", signIn: "Sign in" },
  hero: {
    eyebrow: "For tutoring center owners",
    title: "Run your tutoring center from one screen.",
    subtitle: "Assignments, evaluations and payroll - organized the way your team actually works.",
    cta: "Contact us",
    secondaryCta: "Sign in",
  },
  features: {
    eyebrow: "Features",
    title: "Everything your team already does, finally in one place",
    subtitle: "Built specifically around how a tutoring center actually runs - attendance, grading, payroll and reports, all in one place.",
    items: {
      attendance: { title: "Attendance, tracked automatically", body: "Every session logged per student, with live present/late/absent breakdowns your heads can act on immediately." },
      assignments: { title: "Assignment checking that scales", body: "Assistants log grading in seconds; heads see checked/missing/late status across every course at a glance." },
      payroll: { title: "Payroll that fits how you actually pay", body: "Per-paper, fixed, or hourly rates - even mixed within the same course - plus bonuses, deductions and one-click monthly release." },
      weakTopics: { title: "At-risk students, flagged early", body: "Struggling students surface automatically from real grading data, not a manual spreadsheet someone forgets to update." },
      messaging: { title: "Parent & student messaging built in", body: "One-click WhatsApp messages, pre-filled and personalized - no copy-pasting phone numbers from a spreadsheet." },
      reports: { title: "Monthly reports, delivered automatically", body: "Every student's progress report generated and delivered to Drive - no manual PDF assembly at month-end." },
    },
  },
  roles: {
    eyebrow: "Roles",
    title: "Built for every seat in your organization",
    subtitle: "Each role sees exactly what it needs - nothing more, nothing hidden.",
    items: {
      admin: { title: "Admin", body: "Org-wide oversight - students, staff, courses, payroll settings, and monthly reports, all from one dashboard." },
      head: { title: "Course heads", body: "Oversight of every offering, assistant, and student - plus assignment checking and attendance review in one place." },
      assistant: { title: "Assistants", body: "Their own students, assignments, and attendance - logged in seconds, with pay and progress always visible." },
      registration: { title: "Registration", body: "Student registration and payment plans, attendance, and bulk imports - tracked from signup to enrollment." },
      finance: { title: "Finance", body: "Flexible per-course payroll methods, bonuses and deductions, and one-click monthly release - with full audit history." },
      hr: { title: "HR", body: "Staffing requests and hiring pipelines - tracked from request all the way to resolution." },
    },
  },
  stats: {
    eyebrow: "Real numbers",
    title: "Already running real tutoring centers",
    labels: { students: "Active students", staff: "Staff members", papers: "Papers checked", attendance: "Attendance records logged" },
  },
  contact: {
    eyebrow: "Get in touch",
    title: "Tell us about your tutoring center",
    subtitle: "We'll follow up to set up a walkthrough tailored to your team.",
    fields: {
      firstName: "First name",
      lastName: "Last name",
      organization: "Tutoring center name",
      email: "Email",
      phone: "Phone number",
      studentRange: "How many students?",
      studentRangePlaceholder: "Select a range",
      message: "Anything else? (optional)",
      messagePlaceholder: "Tell us a bit about your center...",
    },
    submit: "Send message",
    submitting: "Sending…",
    success: "Thanks! We'll be in touch shortly.",
    error: "Something went wrong - please try again.",
  },
  footer: { rights: "All rights reserved.", signIn: "Sign in" },
};

const ar: LandingCopy = {
  locale: "ar",
  dir: "rtl",
  nav: { features: "المميزات", roles: "الأدوار", stats: "الأرقام", contact: "تواصل معنا", signIn: "تسجيل الدخول" },
  hero: {
    eyebrow: "لأصحاب السنترات التعليمية",
    title: "أدر السنتر بالكامل من شاشة واحدة.",
    subtitle: "الواجبات والتقييمات والرواتب - منظمة بالطريقة التي يعمل بها فريقك بالفعل.",
    cta: "تواصل معنا",
    secondaryCta: "تسجيل الدخول",
  },
  features: {
    eyebrow: "المميزات",
    title: "كل ما يفعله فريقك بالفعل، في مكان واحد أخيرًا",
    subtitle: "مصمم خصيصًا حول طريقة عمل السنتر التعليمي الفعلية - الحضور، والتصحيح، والرواتب، والتقارير، كل ذلك في مكان واحد.",
    items: {
      attendance: { title: "حضور يُسجَّل تلقائيًا", body: "كل حصة مسجلة لكل طالب، مع تفاصيل حضور/تأخير/غياب فورية يمكن للرؤساء التصرف بناءً عليها فورًا." },
      assignments: { title: "تصحيح واجبات يتوسع مع فريقك", body: "المساعدون يسجلون التصحيح خلال ثوانٍ؛ والرؤساء يرون حالة كل واجب في كل كورس بنظرة واحدة." },
      payroll: { title: "رواتب تناسب طريقة دفعك الفعلية", body: "بالورقة، أو ثابت، أو بالساعة - حتى مختلطة داخل نفس الكورس - بالإضافة إلى المكافآت والخصومات وصرف شهري بضغطة واحدة." },
      weakTopics: { title: "الطلاب المعرضون للخطر، يُكتشفون مبكرًا", body: "الطلاب المتعثرون يظهرون تلقائيًا من بيانات التصحيح الفعلية، وليس من جدول بيانات يدوي قد ينسى أحدهم تحديثه." },
      messaging: { title: "تواصل مع أولياء الأمور والطلاب مدمج", body: "رسائل واتساب بضغطة واحدة، جاهزة ومخصصة - بدون نسخ ولصق أرقام الهواتف من جدول بيانات." },
      reports: { title: "تقارير شهرية تُرسَل تلقائيًا", body: "تقرير تقدم كل طالب يُنشأ ويُرسَل إلى Drive تلقائيًا - بدون تجميع ملفات PDF يدويًا في نهاية الشهر." },
    },
  },
  roles: {
    eyebrow: "الأدوار",
    title: "مصمم لكل دور في مؤسستك",
    subtitle: "كل دور يرى بالضبط ما يحتاجه - لا أكثر ولا أقل.",
    items: {
      admin: { title: "الأدمن", body: "إشراف شامل على المؤسسة - الطلاب، والفريق، والكورسات، وإعدادات الرواتب، والتقارير الشهرية، كل ذلك من لوحة واحدة." },
      head: { title: "رؤساء الكورسات", body: "إشراف على كل الكورسات والمساعدين والطلاب - بالإضافة إلى تصحيح الواجبات ومراجعة الحضور في مكان واحد." },
      assistant: { title: "المساعدون", body: "طلابهم، وواجباتهم، وحضورهم - يُسجَّل خلال ثوانٍ، مع رؤية دائمة للراتب والتقدم." },
      registration: { title: "التسجيل", body: "تسجيل الطلاب وخطط الدفع، والحضور، والاستيراد الجماعي - مُتابَع من التسجيل حتى القيد." },
      finance: { title: "المالية", body: "طرق رواتب مرنة لكل كورس، مكافآت وخصومات، وصرف شهري بضغطة واحدة - مع سجل تدقيق كامل." },
      hr: { title: "الموارد البشرية", body: "طلبات التوظيف ومسارات التعيين - مُتابَعة من الطلب حتى الحل." },
    },
  },
  stats: {
    eyebrow: "أرقام حقيقية",
    title: "تُدير بالفعل سنترات تعليمية حقيقية",
    labels: { students: "طالب نشط", staff: "عضو فريق", papers: "ورقة مُصححة", attendance: "سجل حضور مُسجَّل" },
  },
  contact: {
    eyebrow: "تواصل معنا",
    title: "أخبرنا عن سنترك التعليمي",
    subtitle: "سنتواصل معك لترتيب عرض توضيحي مخصص لفريقك.",
    fields: {
      firstName: "الاسم الأول",
      lastName: "اسم العائلة",
      organization: "اسم السنتر التعليمي",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      studentRange: "كم عدد الطلاب؟",
      studentRangePlaceholder: "اختر نطاقًا",
      message: "أي شيء آخر؟ (اختياري)",
      messagePlaceholder: "أخبرنا قليلاً عن سنترك...",
    },
    submit: "إرسال الرسالة",
    submitting: "جارٍ الإرسال…",
    success: "شكرًا لك! سنتواصل معك قريبًا.",
    error: "حدث خطأ ما - حاول مرة أخرى.",
  },
  footer: { rights: "جميع الحقوق محفوظة.", signIn: "تسجيل الدخول" },
};

export const LANDING_COPY: Record<Locale, LandingCopy> = { en, ar };
