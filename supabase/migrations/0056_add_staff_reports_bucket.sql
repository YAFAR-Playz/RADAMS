-- Private staging area for generated staff-report PDFs. A merged report
-- (contract + receipts + summary tables) can run several MB, well past
-- Vercel's serverless response-size limit for a Server Action's return
-- value — so generateStaffReport() uploads here and hands back a short-lived
-- signed URL instead of returning the PDF bytes inline, same pattern already
-- used for salary_receipts/staff_contracts. Access is admin-client-only,
-- gated by the calling action's own admin/hr check (no storage.objects RLS
-- policies here, matching the existing receipts/contracts buckets).
insert into storage.buckets (id, name, public) values ('staff-reports', 'staff-reports', false) on conflict (id) do nothing;
