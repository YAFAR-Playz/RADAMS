-- Lets an org choose whether generated staff report PDFs carry the org's
-- own branding/logo, or the platform's default owner branding instead
-- (see getPlatformDefaultBranding in branding.ts) — some orgs would rather
-- not put their own identity on an internal HR/payroll document.
alter table public.organizations add column if not exists staff_reports_use_platform_branding boolean not null default false;
