alter table public.profiles add column if not exists phone text;
-- RLS already allows self update of username/display_name/phone (only balance/is_admin guarded)
-- no additional policy needed; trigger prevent_profile_hack only guards id/is_admin
