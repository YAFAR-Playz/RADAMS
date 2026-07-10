-- Lets a head prefill the comment assistants see when logging a student's
-- status for this assignment, instead of everyone typing the same boilerplate
-- comment by hand each time.
alter table public.assignments add column if not exists default_comment text;
