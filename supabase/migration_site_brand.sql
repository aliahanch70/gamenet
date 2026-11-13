-- brand / site meta — run once in SQL Editor
alter table public.site_settings add column if not exists brand jsonb default '{"name":"PLAYSTREET","title":"GAMEVERSE — گیم‌نت حرفه‌ای","description":"GAMEVERSE — گیم‌نت حرفه‌ای با شرط‌بندی زنده و کیف پول تومانی","keywords":"گیم نت, شرط بندی, بازی","og_image":"","favicon":"","logo_url":"","logo_text":"PLAYSTREET"}'::jsonb;
update public.site_settings set brand='{"name":"PLAYSTREET","title":"GAMEVERSE — گیم‌نت حرفه‌ای","description":"GAMEVERSE — گیم‌نت حرفه‌ای با شرط‌بندی زنده و کیف پول تومانی","keywords":"گیم نت, شرط بندی, بازی","og_image":"","favicon":"","logo_url":"","logo_text":"PLAYSTREET"}'::jsonb where brand is null;
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
