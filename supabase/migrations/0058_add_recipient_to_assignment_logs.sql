-- Tracks who a logged assignment message was actually sent to (the student
-- directly, or their parent/guardian) so Oversight can break "sent" counts
-- down by recipient instead of only knowing that *some* message went out.
-- Existing rows predate this distinction and stay null — they still count
-- toward the combined (sent_at-only) view, just not toward either recipient
-- filter specifically.
create type public.message_recipient as enum ('student', 'parent');

alter table public.assignment_logs
  add column if not exists recipient public.message_recipient;
