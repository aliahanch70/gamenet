-- Design style for site_settings (Supabase source of truth)
alter table public.site_settings add column if not exists design text default 'minimal';
-- keep only allowed values (soft check — app validates)
do $$ begin
  if not exists (select 1 from pg_constraint where conname='site_settings_design_check') then
    alter table public.site_settings add constraint site_settings_design_check check (design in ('minimal','esports','glass','sportsbook','neon','midnight','arctic','stadium'));
  end if;
end $$;
-- ensure row 1 exists
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
-- realtime publication (needed for live theme push; safe to re-run)
do $$ begin
  alter publication supabase_realtime add table public.site_settings;
exception when duplicate_object then null;
end $$;
-- migrate old constraint if exists (drop & recreate with 8 values)
do $$ begin
  alter table public.site_settings drop constraint if exists site_settings_design_check;
  alter table public.site_settings add constraint site_settings_design_check check (design in ('minimal','esports','glass','sportsbook','neon','midnight','arctic','stadium'));
exception when others then null;
end $$;
