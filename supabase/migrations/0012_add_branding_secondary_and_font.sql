alter table public.organizations
  add column secondary_color text not null default '#7c3aed',
  add column font text not null default 'geist';
