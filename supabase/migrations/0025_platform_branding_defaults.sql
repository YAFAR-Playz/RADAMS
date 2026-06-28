alter table public.organizations
  alter column brand_name drop not null,
  alter column brand_name drop default,
  alter column primary_color drop not null,
  alter column primary_color drop default,
  alter column secondary_color drop not null,
  alter column secondary_color drop default,
  alter column font drop not null,
  alter column font drop default,
  alter column corner drop not null,
  alter column corner drop default;

alter table public.platform_settings
  add column default_brand_name text not null default 'RadAMS',
  add column default_primary_color text not null default '#2563eb',
  add column default_secondary_color text not null default '#7c3aed',
  add column default_font text not null default 'geist',
  add column default_corner text not null default 'soft';
