create policy "finance and admin manage evaluations" on evaluations
  for all using (org_id = public.current_org_id() and public.current_role() in ('finance','admin'))
  with check (org_id = public.current_org_id() and public.current_role() in ('finance','admin'));

create policy "finance and admin manage evaluation lines" on evaluation_lines
  for all using (exists (select 1 from evaluations e where e.id = evaluation_lines.evaluation_id and e.org_id = public.current_org_id() and public.current_role() in ('finance','admin')))
  with check (exists (select 1 from evaluations e where e.id = evaluation_lines.evaluation_id and e.org_id = public.current_org_id() and public.current_role() in ('finance','admin')));
