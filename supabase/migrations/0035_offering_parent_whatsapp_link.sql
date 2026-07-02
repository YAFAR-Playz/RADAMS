-- Parent WhatsApp link moves from one org-wide setting to a per-offering
-- setting the head configures (course + unit + session combo), since a
-- single org-wide link doesn't make sense once heads run multiple groups.
alter table public.course_offerings
  add column parent_whatsapp_link text;
