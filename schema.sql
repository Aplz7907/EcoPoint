-- ============================================================================
-- EcoPoints — schema.sql
-- Run this whole file in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is idempotent: safe to re-run.
--
-- SECURITY MODEL (read this before changing anything):
--   * RLS is ON for every table.
--   * A user can only ever SELECT their own rows.
--   * profiles.points_balance / is_banned are NOT writable by a user session.
--     They are protected by a trigger and can only change via the service role
--     or a SECURITY DEFINER function.
--   * submissions are INSERTed only by the service role (from /api/submit),
--     because the server is the sole authority on how many points were earned.
--   * redemptions are INSERTed only by redeem_reward(), which is atomic.
--   * There is no admin role and no human review. The AI decides, the server
--     prices the result, and nobody can read another user's rows — ever.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Clean up the admin/human-review machinery from earlier versions.
--
--    Harmless on a fresh database (everything is `if exists`). On a database
--    that already ran the older schema, this removes the `role` column and the
--    policies that let an admin read *everyone's* rows — dead weight now, and
--    a real blast radius if that column were ever flipped by accident.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "profiles: admin reads all" on public.profiles';
  end if;
  if to_regclass('public.submissions') is not null then
    execute 'drop policy if exists "submissions: admin reads all" on public.submissions';
  end if;
  if to_regclass('public.redemptions') is not null then
    execute 'drop policy if exists "redemptions: admin reads all" on public.redemptions';
  end if;
end
$$;

drop function if exists public.admin_review_submission(uuid, boolean, text);
drop function if exists public.is_admin();

-- Only ever existed to feed the admin review queue.
drop index if exists public.submissions_status_created_idx;

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles drop column if exists role';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

-- True when the current DB role is a trusted backend role (service_role key,
-- SQL editor, or the owner of a SECURITY DEFINER function). Used to gate the
-- protected columns on profiles.
create or replace function public.is_trusted_role()
returns boolean
language sql
stable
as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  points_balance int         not null default 0 check (points_balance >= 0),
  is_banned      boolean     not null default false,
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Hard guard: a normal user session may never change its own points or ban
-- flag — even if a policy is misconfigured later.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_role() then
    return new;
  end if;

  if new.points_balance is distinct from old.points_balance
     or new.is_banned is distinct from old.is_banned
     or new.id        is distinct from old.id then
    raise exception 'FORBIDDEN_COLUMN_UPDATE: points_balance and is_banned are server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Users may update their own row, but the trigger above still blocks the
-- protected columns, so in practice this only allows renaming yourself.
drop policy if exists "profiles: update own display_name" on public.profiles;
create policy "profiles: update own display_name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT / DELETE policy on purpose: rows come from the signup trigger only.

-- ---------------------------------------------------------------------------
-- 3. waste_types  (the single source of truth for point values)
-- ---------------------------------------------------------------------------

create table if not exists public.waste_types (
  id              serial primary key,
  code            text unique not null check (code in ('plastic_bottle', 'can', 'glass_bottle', 'paper_carton')),
  name_th         text        not null,
  points_per_item int         not null check (points_per_item >= 0),
  is_active       boolean     not null default true
);

alter table public.waste_types enable row level security;

drop policy if exists "waste_types: read active" on public.waste_types;
create policy "waste_types: read active"
  on public.waste_types for select
  to authenticated
  using (is_active);

-- No write policies: point values change only via the SQL editor / service role.

insert into public.waste_types (code, name_th, points_per_item, is_active) values
  ('plastic_bottle', 'ขวดพลาสติก', 10, true),
  ('can',            'กระป๋อง',     15, true),
  ('glass_bottle',   'ขวดแก้ว',     8,  true),
  ('paper_carton',   'กล่องกระดาษ', 5,  true)
on conflict (code) do update
  set name_th         = excluded.name_th,
      points_per_item = excluded.points_per_item,
      is_active       = excluded.is_active;

-- ---------------------------------------------------------------------------
-- 4. submissions
-- ---------------------------------------------------------------------------

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  image_url     text,
  image_hash    text        not null,
  image_phash   text,
  ai_result     jsonb,
  points_earned int         not null default 0 check (points_earned >= 0),
  status        text        not null check (status in ('approved', 'pending_review', 'rejected')),
  reject_reason text,
  created_at    timestamptz not null default now()
);

-- For databases created before perceptual hashing existed.
alter table public.submissions
  add column if not exists image_phash text;

create index if not exists submissions_user_created_idx
  on public.submissions (user_id, created_at desc);

-- Exact-duplicate detection: any user's identical file blocks a re-submit.
create index if not exists submissions_image_hash_idx
  on public.submissions (image_hash);

alter table public.submissions enable row level security;

drop policy if exists "submissions: read own" on public.submissions;
create policy "submissions: read own"
  on public.submissions for select
  to authenticated
  using (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for users, ever. /api/submit writes these rows
-- with the service role, after it — not the client — has decided the points.

-- ---------------------------------------------------------------------------
-- Keep points_balance honest when a submission is deleted or re-scored.
--
-- points_balance is a running total kept alongside the submissions that earned
-- it. Delete a submission row — from the Table Editor, from SQL, by cascade
-- when a user is removed — and without this trigger the points it paid out
-- would simply stay in the balance forever, with nothing left to justify them.
--
-- The floor at zero matters: the user may already have spent those points on a
-- reward, and we cannot claw back what is gone. Better a balance of 0 than an
-- exception that blocks the delete, or a negative balance the check constraint
-- would reject anyway.
--
-- SECURITY DEFINER so it runs as the table owner, which is what lets it past
-- protect_profile_columns().
-- ---------------------------------------------------------------------------

create or replace function public.sync_points_on_submission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.points_earned > 0 then
      update public.profiles
         set points_balance = greatest(points_balance - old.points_earned, 0)
       where id = old.user_id;
    end if;
    return old;
  end if;

  -- UPDATE: apply only the difference, so hand-editing points_earned in the
  -- dashboard cannot silently desync the balance either.
  if new.points_earned is distinct from old.points_earned then
    update public.profiles
       set points_balance =
             greatest(points_balance - old.points_earned + new.points_earned, 0)
     where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_points_on_submission_delete on public.submissions;
create trigger trg_sync_points_on_submission_delete
  after delete on public.submissions
  for each row execute function public.sync_points_on_submission_change();

drop trigger if exists trg_sync_points_on_submission_update on public.submissions;
create trigger trg_sync_points_on_submission_update
  after update on public.submissions
  for each row execute function public.sync_points_on_submission_change();

-- ---------------------------------------------------------------------------
-- has_similar_image(phash, max_distance)
--
-- "Have I seen this *scene* before?" — the question SHA-256 cannot answer.
--
-- Two dHashes are compared by XORing them and counting the set bits (their
-- Hamming distance). A second photo of the same bottle on the same table lands
-- within a handful of bits of the first; a genuinely different pile does not.
--
-- Done in SQL rather than in Node so we never have to pull every hash in the
-- table over the wire just to compare 64 bits against each of them.
-- ---------------------------------------------------------------------------

create or replace function public.has_similar_image(
  p_phash        text,
  p_max_distance int default 6,
  p_within_days  int default 30
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions s
    where s.image_phash is not null
      and length(s.image_phash) = 64
      and length(p_phash) = 64
      and s.created_at > now() - make_interval(days => p_within_days)
      and bit_count(s.image_phash::bit(64) # p_phash::bit(64)) <= p_max_distance
  );
$$;

-- Server-side check only. A user session has no business asking whether some
-- image already exists — that would leak other people's submissions.
revoke all on function public.has_similar_image(text, int, int) from public, authenticated, anon;
grant execute on function public.has_similar_image(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 5. rewards
-- ---------------------------------------------------------------------------

create table if not exists public.rewards (
  id          serial primary key,
  name        text    not null,
  description text,
  points_cost int     not null check (points_cost > 0),
  stock       int     not null default 0 check (stock >= 0),
  is_active   boolean not null default true
);

alter table public.rewards enable row level security;

drop policy if exists "rewards: read active" on public.rewards;
create policy "rewards: read active"
  on public.rewards for select
  to authenticated
  using (is_active);

-- Reward economics — this is the anti-fraud lever, not a pricing detail.
--
-- The worst a cheater can do is re-photograph one bottle 5×/day = 50 points/day
-- (the SHA-256 and dHash checks cannot stop a genuinely new photo of the same
-- object; only the daily cap bounds it). So the rewards are priced so that
-- farming is simply not worth the effort:
--
--   500 pts  →  10 days of pure farming for a 10฿ drink   ≈ 1฿/day
--   1,500 pts→  30 days                for a tote bag
--   3,000 pts→  60 days                for 20฿ of credit  ≈ 0.3฿/day
--
-- Nobody grinds two months of fake photos for twenty baht. An honest user who
-- actually sorts a few pieces of waste per photo clears these in days, not
-- months. Adjust freely — it is data, no deploy required.
insert into public.rewards (id, name, description, points_cost, stock, is_active) values
  (1, 'ส่วนลดเครื่องดื่ม 10 บาท', 'ใช้เป็นส่วนลดเครื่องดื่มที่ร้านกาแฟในโครงการ', 500,  100, true),
  (2, 'ถุงผ้ารักษ์โลก',           'ถุงผ้าแคนวาส EcoPoints ลายพิเศษ',              1500, 20,  true),
  (3, 'บัตรเติมเงิน 20 บาท',      'โค้ดเติมเงินมือถือ มูลค่า 20 บาท',              3000, 10,  true)
on conflict (id) do update
  set name        = excluded.name,
      description = excluded.description,
      points_cost = excluded.points_cost,
      stock       = excluded.stock,
      is_active   = excluded.is_active;

select setval(
  pg_get_serial_sequence('public.rewards', 'id'),
  greatest((select coalesce(max(id), 1) from public.rewards), 1)
);

-- ---------------------------------------------------------------------------
-- 6. redemptions
-- ---------------------------------------------------------------------------

create table if not exists public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  reward_id    int         not null references public.rewards(id),
  points_spent int         not null check (points_spent >= 0),
  code         text        not null unique,
  status       text        not null default 'active' check (status in ('active', 'used')),
  created_at   timestamptz not null default now()
);

create index if not exists redemptions_user_created_idx
  on public.redemptions (user_id, created_at desc);

alter table public.redemptions enable row level security;

drop policy if exists "redemptions: read own" on public.redemptions;
create policy "redemptions: read own"
  on public.redemptions for select
  to authenticated
  using (user_id = auth.uid());

-- No INSERT policy: rows are created exclusively by redeem_reward().

-- ---------------------------------------------------------------------------
-- 7. redeem_reward(reward_id) — atomic, race-condition-free
--
--    Locks the reward row, then the profile row (always in that order, so two
--    concurrent redemptions can never deadlock). Everything below runs inside
--    the single implicit transaction of the function call: if any step raises,
--    the deduction and the stock decrement roll back together.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_reward(reward_id int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_reward    public.rewards%rowtype;
  v_balance   int;
  v_banned    boolean;
  v_code      text;
  v_redemption_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- 1) Lock the reward. FOR UPDATE serialises concurrent redeemers of the same
  --    reward, which is what makes the stock check below trustworthy.
  select * into v_reward
  from public.rewards r
  where r.id = redeem_reward.reward_id
  for update;

  if not found or not v_reward.is_active then
    raise exception 'REWARD_NOT_FOUND';
  end if;

  if v_reward.stock <= 0 then
    raise exception 'OUT_OF_STOCK';
  end if;

  -- 2) Lock the profile. Same reason: two tabs redeeming at once must queue up
  --    here instead of both reading the same stale balance.
  select p.points_balance, p.is_banned into v_balance, v_banned
  from public.profiles p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_banned then
    raise exception 'USER_BANNED';
  end if;

  if v_balance < v_reward.points_cost then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  -- 3) Mutate. The points_balance >= 0 check constraint is the last line of
  --    defence if the guard above is ever bypassed.
  update public.profiles
     set points_balance = points_balance - v_reward.points_cost
   where id = v_user_id;

  update public.rewards
     set stock = stock - 1
   where id = v_reward.id;

  -- 4) Issue a code. Retry on the (astronomically unlikely) unique collision.
  loop
    v_code := 'ECO-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      insert into public.redemptions (user_id, reward_id, points_spent, code)
      values (v_user_id, v_reward.id, v_reward.points_cost, v_code)
      returning id into v_redemption_id;
      exit;
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  return json_build_object(
    'redemption_id',  v_redemption_id,
    'code',           v_code,
    'reward_name',    v_reward.name,
    'points_spent',   v_reward.points_cost,
    'points_balance', v_balance - v_reward.points_cost
  );
end;
$$;

revoke all on function public.redeem_reward(int) from public;
grant execute on function public.redeem_reward(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. add_points(user_id, delta) — the only way points ever go up.
--    Called by the service role from /api/submit, and by nothing else.
-- ---------------------------------------------------------------------------

create or replace function public.add_points(p_user_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
begin
  update public.profiles
     set points_balance = points_balance + p_delta
   where id = p_user_id
  returning points_balance into v_new_balance;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return v_new_balance;
end;
$$;

-- Not callable from a user session — service role / SECURITY DEFINER only.
-- The grant to service_role must be explicit: revoking from PUBLIC also removes
-- the implicit grant that service_role would otherwise have inherited.
revoke all on function public.add_points(uuid, int) from public, authenticated, anon;
grant execute on function public.add_points(uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Storage: private bucket for submitted photos.
--    No user-facing storage policies — the app hands out short-lived signed
--    URLs generated server-side, so nobody can enumerate the bucket.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 10. Reconcile every balance against the rows that justify it.
--
--     The invariant:  points_balance = Σ points_earned − Σ points_spent
--
--     The trigger above keeps this true from now on, but any balance that
--     already drifted (submissions deleted before the trigger existed) is
--     repaired here. Safe to run any number of times — it recomputes from the
--     source rows rather than adjusting by a delta.
-- ---------------------------------------------------------------------------

update public.profiles p
   set points_balance = greatest(
     coalesce(
       (select sum(s.points_earned) from public.submissions s where s.user_id = p.id),
       0
     ) - coalesce(
       (select sum(r.points_spent) from public.redemptions r where r.user_id = p.id),
       0
     ),
     0
   )
 where p.points_balance is distinct from greatest(
     coalesce(
       (select sum(s.points_earned) from public.submissions s where s.user_id = p.id),
       0
     ) - coalesce(
       (select sum(r.points_spent) from public.redemptions r where r.user_id = p.id),
       0
     ),
     0
   );

-- ---------------------------------------------------------------------------
-- 11. Tuning knobs, all data — no deploy needed to change any of them:
--
--     update public.waste_types set points_per_item = 12 where code = 'can';
--     update public.rewards      set stock = 0        where id = 3;
--     update public.profiles     set is_banned = true where id = '<user-uuid>';
-- ---------------------------------------------------------------------------
