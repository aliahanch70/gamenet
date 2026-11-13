-- reels — instagram-like vertical feed
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_url text not null check (char_length(video_url) >= 10),
  caption text default '' ,
  hashtags text default '',
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_reels_created on public.reels(created_at desc);
create index if not exists idx_reels_user on public.reels(user_id);
alter table public.reels enable row level security;

create table if not exists public.reel_likes (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(reel_id, user_id)
);
create index if not exists idx_reel_likes_reel on public.reel_likes(reel_id);
create index if not exists idx_reel_likes_user on public.reel_likes(user_id);
alter table public.reel_likes enable row level security;

create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists idx_reel_comments_reel on public.reel_comments(reel_id, created_at desc);
alter table public.reel_comments enable row level security;

-- RLS
drop policy if exists "reels public read" on public.reels;
create policy "reels public read" on public.reels for select using (is_published = true or user_id = auth.uid() or public.is_admin());
drop policy if exists "reels insert own" on public.reels;
create policy "reels insert own" on public.reels for insert with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "reels update own" on public.reels;
create policy "reels update own" on public.reels for update using (auth.uid() = user_id or public.is_admin());
drop policy if exists "reels delete own" on public.reels;
create policy "reels delete own" on public.reels for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "reel_likes read all" on public.reel_likes;
create policy "reel_likes read all" on public.reel_likes for select using (true);
drop policy if exists "reel_likes insert own" on public.reel_likes;
create policy "reel_likes insert own" on public.reel_likes for insert with check (auth.uid() = user_id);
drop policy if exists "reel_likes delete own" on public.reel_likes;
create policy "reel_likes delete own" on public.reel_likes for delete using (auth.uid() = user_id);

drop policy if exists "reel_comments read all" on public.reel_comments;
create policy "reel_comments read all" on public.reel_comments for select using (true);
drop policy if exists "reel_comments insert auth" on public.reel_comments;
create policy "reel_comments insert auth" on public.reel_comments for insert with check (auth.uid() = user_id);
drop policy if exists "reel_comments delete own" on public.reel_comments;
create policy "reel_comments delete own" on public.reel_comments for delete using (auth.uid() = user_id or public.is_admin());

-- keep counts in sync via trigger (atomic, no race)
create or replace function public.reels_like_count_trg() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set likes_count = likes_count + 1 where id = new.reel_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reels set likes_count = greatest(0, likes_count - 1) where id = old.reel_id;
    return old;
  end if;
  return null;
end; $$;
drop trigger if exists trg_reels_likes_count on public.reel_likes;
create trigger trg_reels_likes_count after insert or delete on public.reel_likes for each row execute function public.reels_like_count_trg();

create or replace function public.reels_comment_count_trg() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set comments_count = comments_count + 1 where id = new.reel_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reels set comments_count = greatest(0, comments_count - 1) where id = old.reel_id;
    return old;
  end if;
  return null;
end; $$;
drop trigger if exists trg_reels_comments_count on public.reel_comments;
create trigger trg_reels_comments_count after insert or delete on public.reel_comments for each row execute function public.reels_comment_count_trg();

-- grants
grant select on public.reels to anon, authenticated;
grant insert, update, delete on public.reels to authenticated;
grant select, insert, delete on public.reel_likes to authenticated;
grant select on public.reel_likes to anon;
grant select, insert, delete on public.reel_comments to authenticated;
grant select on public.reel_comments to anon;

-- optional RPC toggle (idempotent, prevents duplicate error bubbling)
create or replace function public.toggle_reel_like(p_reel_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_exists boolean; v_cnt int;
begin
  if v_uid is null then raise exception 'login required'; end if;
  if not exists(select 1 from public.reels where id = p_reel_id and is_published = true) then raise exception 'reel not found'; end if;
  select exists(select 1 from public.reel_likes where reel_id = p_reel_id and user_id = v_uid) into v_exists;
  if v_exists then
    delete from public.reel_likes where reel_id = p_reel_id and user_id = v_uid;
    select likes_count into v_cnt from public.reels where id = p_reel_id;
    return jsonb_build_object('liked', false, 'likes_count', coalesce(v_cnt,0));
  else
    insert into public.reel_likes(reel_id, user_id) values(p_reel_id, v_uid) on conflict do nothing;
    select likes_count into v_cnt from public.reels where id = p_reel_id;
    return jsonb_build_object('liked', true, 'likes_count', coalesce(v_cnt,0));
  end if;
end; $$;
grant execute on function public.toggle_reel_like(uuid) to authenticated;

-- seed 3 demo reels (public sample videos) if empty
