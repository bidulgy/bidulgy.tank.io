-- Sworder VS Tank fresh Supabase bootstrap (V6.02)
-- Creates a new empty account/game database. It intentionally imports no users.

begin;

create table if not exists public.iron_cell_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.iron_cell_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pilot_name text not null default 'PLAYER' check (char_length(pilot_name) between 1 and 14),
  gems bigint not null default 1000 check (gems >= 0),
  best_level integer not null default 1 check (best_level >= 1),
  best_score bigint not null default 0 check (best_score >= 0),
  best_kills integer not null default 0 check (best_kills >= 0),
  total_runs bigint not null default 0 check (total_runs >= 0),
  total_kills bigint not null default 0 check (total_kills >= 0),
  equipped_cannon text not null default 'standard',
  owned_cannons jsonb not null default '["standard","scout","bastion"]'::jsonb
    check (jsonb_typeof(owned_cannons) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iron_cell_run_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id text not null check (char_length(run_id) between 1 and 80),
  level integer not null default 1,
  score bigint not null default 0,
  kills integer not null default 0,
  finished boolean not null default false,
  awarded_gems bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

create table if not exists public.iron_cell_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.iron_cell_accounts enable row level security;
alter table public.iron_cell_profiles enable row level security;
alter table public.iron_cell_run_claims enable row level security;
alter table public.iron_cell_admins enable row level security;

revoke all on public.iron_cell_accounts, public.iron_cell_profiles,
  public.iron_cell_run_claims, public.iron_cell_admins from public, anon;
grant select on public.iron_cell_accounts, public.iron_cell_profiles to authenticated;
grant insert, update on public.iron_cell_profiles to authenticated;

create or replace function public.iron_cell_admin_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists(
  select 1 from public.iron_cell_admins a where a.user_id = auth.uid()
) $$;
revoke all on function public.iron_cell_admin_is_admin() from public, anon;
grant execute on function public.iron_cell_admin_is_admin() to authenticated;

drop policy if exists iron_cell_accounts_read_own_or_admin on public.iron_cell_accounts;
create policy iron_cell_accounts_read_own_or_admin on public.iron_cell_accounts
for select to authenticated using (user_id = auth.uid() or public.iron_cell_admin_is_admin());

drop policy if exists iron_cell_profiles_read_own_or_admin on public.iron_cell_profiles;
create policy iron_cell_profiles_read_own_or_admin on public.iron_cell_profiles
for select to authenticated using (user_id = auth.uid() or public.iron_cell_admin_is_admin());
drop policy if exists iron_cell_profiles_insert_own on public.iron_cell_profiles;
create policy iron_cell_profiles_insert_own on public.iron_cell_profiles
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists iron_cell_profiles_update_own on public.iron_cell_profiles;
create policy iron_cell_profiles_update_own on public.iron_cell_profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.iron_cell_handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_username text := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
begin
  if v_username = '' then
    v_username := regexp_replace(split_part(lower(coalesce(new.email,'')),'@',1),'^ic_','');
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
  insert into public.iron_cell_accounts(user_id,username) values(new.id,v_username);
  insert into public.iron_cell_profiles(user_id,pilot_name) values(new.id,left(v_username,14));
  return new;
end $$;
drop trigger if exists iron_cell_on_auth_user_created on auth.users;
create trigger iron_cell_on_auth_user_created after insert on auth.users
for each row execute function public.iron_cell_handle_new_user();

create or replace function public.iron_cell_equip_cannon_v1(p_cannon text)
returns public.iron_cell_profiles language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_cannon text:=lower(trim(coalesce(p_cannon,''))); v_row public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_row from public.iron_cell_profiles where user_id=v_uid for update;
  if not found then raise exception 'profile_not_found'; end if;
  if not coalesce(v_row.owned_cannons,'[]'::jsonb) ? v_cannon then raise exception 'cannon_not_owned'; end if;
  update public.iron_cell_profiles set equipped_cannon=v_cannon,updated_at=now()
    where user_id=v_uid returning * into v_row;
  return v_row;
end $$;
revoke all on function public.iron_cell_equip_cannon_v1(text) from public,anon;
grant execute on function public.iron_cell_equip_cannon_v1(text) to authenticated;

create or replace function public.iron_cell_save_run_v2(
  p_run_id text,p_pilot_name text,p_level integer,p_score bigint,p_kills integer,p_finish boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_run text:=left(trim(coalesce(p_run_id,'')),80);
  v_level integer:=greatest(1,least(coalesce(p_level,1),1000));
  v_score bigint:=greatest(0,least(coalesce(p_score,0),1000000000));
  v_kills integer:=greatest(0,least(coalesce(p_kills,0),100000));
  v_old public.iron_cell_run_claims; v_row public.iron_cell_profiles;
  v_award bigint:=0; v_delta_kills integer:=0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_run='' then raise exception 'invalid_run_id'; end if;
  select * into v_old from public.iron_cell_run_claims where user_id=v_uid and run_id=v_run for update;
  if not found then
    insert into public.iron_cell_run_claims(user_id,run_id,level,score,kills,finished)
      values(v_uid,v_run,v_level,v_score,v_kills,coalesce(p_finish,false)) returning * into v_old;
    v_delta_kills:=v_kills;
    if p_finish then v_award:=v_score*36; end if;
  else
    v_delta_kills:=greatest(0,v_kills-v_old.kills);
    if p_finish and not v_old.finished then
      v_award:=v_score*36;
    end if;
    update public.iron_cell_run_claims set level=greatest(level,v_level),score=greatest(score,v_score),
      kills=greatest(kills,v_kills),finished=finished or coalesce(p_finish,false),
      awarded_gems=awarded_gems+v_award,updated_at=now()
      where user_id=v_uid and run_id=v_run;
  end if;
  update public.iron_cell_profiles set
    pilot_name=left(coalesce(nullif(trim(p_pilot_name),''),pilot_name),14),
    gems=gems+v_award,best_level=greatest(best_level,v_level),best_score=greatest(best_score,v_score),
    best_kills=greatest(best_kills,v_kills),total_kills=total_kills+v_delta_kills,
    total_runs=total_runs + case when p_finish and not coalesce(v_old.finished,false) then 1 else 0 end,
    updated_at=now() where user_id=v_uid returning * into v_row;
  return jsonb_build_object('profile',to_jsonb(v_row),'awarded_gems',v_award,'awarded_score',v_score);
end $$;
revoke all on function public.iron_cell_save_run_v2(text,text,integer,bigint,integer,boolean) from public,anon;
grant execute on function public.iron_cell_save_run_v2(text,text,integer,bigint,integer,boolean) to authenticated;

create or replace function public.iron_cell_pull_cannons_v2(p_count integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_count integer:=coalesce(p_count,0); v_cost bigint;
  v_row public.iron_cell_profiles; v_i integer; v_roll double precision; v_pick text; v_rarity text;
  v_rarest text:='common'; v_counts jsonb:='{}'::jsonb; v_new jsonb:='[]'::jsonb;
  v_owned jsonb; v_rank integer:=0; v_pick_rank integer;
  commons text[]:=array['rapid','dual','needle','blaster','ranger'];
  rares text[]:=array['spread','burst','crystal','ricochet','mortar'];
  epics text[]:=array['piercer','laser','drill','shredder','seeker'];
  legendaries text[]:=array['plasma','thunder','inferno','frost','magnet'];
  mythics text[]:=array['rocket','titan','phantom','cyclone','juggernaut'];
  secrets text[]:=array['ring','chrono','void','mirror','lancer'];
  galaxies text[]:=array['nova','comet','stellar','leviathan','valkyrie'];
  errors text[]:=array['error','glitch','zero','berserker','oracle'];
  divines text[]:=array['deku','sniper','bloodlust'];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_count not in (1,5,10,50,100,500,1000) then raise exception 'invalid_pull_count'; end if;
  v_cost:=v_count*100;
  select * into v_row from public.iron_cell_profiles where user_id=v_uid for update;
  if v_row.gems<v_cost then raise exception 'not_enough_gems'; end if;
  v_owned:=coalesce(v_row.owned_cannons,'[]'::jsonb);
  for v_i in 1..v_count loop
    v_roll:=random()*100;
    if v_roll<0.003 then v_pick:=divines[1+floor(random()*array_length(divines,1))::int];v_rarity:='divine';v_pick_rank:=9;
    elsif v_roll<0.018 then v_pick:=errors[1+floor(random()*array_length(errors,1))::int];v_rarity:='error';v_pick_rank:=8;
    elsif v_roll<0.068 then v_pick:=galaxies[1+floor(random()*array_length(galaxies,1))::int];v_rarity:='galaxy';v_pick_rank:=7;
    elsif v_roll<0.268 then v_pick:=secrets[1+floor(random()*array_length(secrets,1))::int];v_rarity:='secret';v_pick_rank:=6;
    elsif v_roll<0.768 then v_pick:=mythics[1+floor(random()*array_length(mythics,1))::int];v_rarity:='mythic';v_pick_rank:=5;
    elsif v_roll<2.768 then v_pick:=legendaries[1+floor(random()*array_length(legendaries,1))::int];v_rarity:='legendary';v_pick_rank:=4;
    elsif v_roll<13.023 then v_pick:=epics[1+floor(random()*array_length(epics,1))::int];v_rarity:='epic';v_pick_rank:=3;
    elsif v_roll<38.653 then v_pick:=rares[1+floor(random()*array_length(rares,1))::int];v_rarity:='rare';v_pick_rank:=2;
    else v_pick:=commons[1+floor(random()*array_length(commons,1))::int];v_rarity:='common';v_pick_rank:=1; end if;
    v_counts:=jsonb_set(v_counts,array[v_pick],to_jsonb(coalesce((v_counts->>v_pick)::int,0)+1),true);
    if not v_owned ? v_pick then v_owned:=v_owned||jsonb_build_array(v_pick);v_new:=v_new||jsonb_build_array(v_pick);end if;
    if v_pick_rank>v_rank then v_rank:=v_pick_rank;v_rarest:=v_rarity;end if;
  end loop;
  update public.iron_cell_profiles set gems=gems-v_cost,owned_cannons=v_owned,updated_at=now()
    where user_id=v_uid returning * into v_row;
  return jsonb_build_object('gems',v_row.gems,'owned_cannons',v_owned,'counts',v_counts,'new_cannons',v_new,'rarest',v_rarest);
end $$;
revoke all on function public.iron_cell_pull_cannons_v2(integer) from public,anon;
grant execute on function public.iron_cell_pull_cannons_v2(integer) to authenticated;

create or replace function public.iron_cell_admin_change_gems(p_username text,p_mode text,p_amount bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid; v_row public.iron_cell_profiles; v_amount bigint:=greatest(0,coalesce(p_amount,0));
begin
  if not public.iron_cell_admin_is_admin() then raise exception 'admin_required'; end if;
  select user_id into v_uid from public.iron_cell_accounts where username=lower(trim(p_username));
  if v_uid is null then raise exception 'user_not_found'; end if;
  update public.iron_cell_profiles set gems=case lower(p_mode) when 'set' then v_amount when 'add' then gems+v_amount when 'remove' then greatest(0,gems-v_amount) else gems end,updated_at=now()
    where user_id=v_uid returning * into v_row;
  return jsonb_build_object('ok',true,'profile',to_jsonb(v_row));
end $$;
revoke all on function public.iron_cell_admin_change_gems(text,text,bigint) from public,anon;
grant execute on function public.iron_cell_admin_change_gems(text,text,bigint) to authenticated;

create or replace function public.iron_cell_admin_set_cannon_v2(p_username text,p_cannon text,p_owned boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid; v_cannon text:=lower(trim(p_cannon)); v_row public.iron_cell_profiles;
begin
  if not public.iron_cell_admin_is_admin() then raise exception 'admin_required'; end if;
  select user_id into v_uid from public.iron_cell_accounts where username=lower(trim(p_username));
  if v_uid is null then raise exception 'user_not_found'; end if;
  if v_cannon not in ('standard','scout','bastion','rapid','dual','needle','blaster','ranger','spread','burst','crystal','ricochet','mortar','piercer','laser','drill','shredder','seeker','plasma','thunder','inferno','frost','magnet','rocket','titan','phantom','cyclone','juggernaut','ring','chrono','void','mirror','lancer','nova','comet','stellar','leviathan','valkyrie','error','glitch','zero','berserker','oracle','deku','sniper','bloodlust','gojo') then raise exception 'invalid_cannon'; end if;
  if not p_owned and v_cannon in ('standard','scout','bastion') then raise exception 'cannot_remove_starter'; end if;
  update public.iron_cell_profiles set
    owned_cannons=case when p_owned then case when owned_cannons?v_cannon then owned_cannons else owned_cannons||jsonb_build_array(v_cannon) end
      else coalesce((select jsonb_agg(value) from jsonb_array_elements(owned_cannons) value where value<>to_jsonb(v_cannon)),'[]'::jsonb) end,
    equipped_cannon=case when not p_owned and equipped_cannon=v_cannon then 'standard' else equipped_cannon end,updated_at=now()
    where user_id=v_uid returning * into v_row;
  return jsonb_build_object('ok',true,'profile',to_jsonb(v_row));
end $$;
revoke all on function public.iron_cell_admin_set_cannon_v2(text,text,boolean) from public,anon;
grant execute on function public.iron_cell_admin_set_cannon_v2(text,text,boolean) to authenticated;

create or replace function public.iron_cell_admin_panel_v4(p_query text default '',p_limit integer default 30,p_exact text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_users jsonb; v_exact jsonb; v_total bigint; v_q text:=lower(trim(coalesce(p_query,'')));
begin
  if not public.iron_cell_admin_is_admin() then raise exception 'admin_required'; end if;
  select count(*) into v_total from public.iron_cell_accounts;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_users from (
    select a.username,a.user_id,a.created_at,p.gems,p.best_level,p.best_score,p.best_kills,p.total_runs,p.total_kills,p.equipped_cannon,p.owned_cannons,p.pilot_name
    from public.iron_cell_accounts a left join public.iron_cell_profiles p using(user_id)
    where v_q='' or a.username ilike '%'||v_q||'%' order by a.created_at desc limit greatest(1,least(coalesce(p_limit,30),100))
  ) x;
  if p_exact is not null then select jsonb_build_object('username',a.username,'user_id',a.user_id,'created_at',a.created_at,'profile',to_jsonb(p)) into v_exact
    from public.iron_cell_accounts a left join public.iron_cell_profiles p using(user_id) where a.username=lower(trim(p_exact)); end if;
  return jsonb_build_object('ok',true,'total',v_total,'users',v_users,'exact',v_exact);
end $$;
revoke all on function public.iron_cell_admin_panel_v4(text,integer,text) from public,anon;
grant execute on function public.iron_cell_admin_panel_v4(text,integer,text) to authenticated;

create or replace function public.iron_cell_admin_panel_v3(p_query text default '',p_limit integer default 30,p_exact text default null)
returns jsonb language sql security definer set search_path=''
as $$ select public.iron_cell_admin_panel_v4(p_query,p_limit,p_exact) $$;
revoke all on function public.iron_cell_admin_panel_v3(text,integer,text) from public,anon;
grant execute on function public.iron_cell_admin_panel_v3(text,integer,text) to authenticated;

create table if not exists public.iron_cell_gojo_kill_attestations (
  victim_id uuid not null,killer_id uuid not null,run_id text not null,
  victim_confirmed boolean not null default false,killer_confirmed boolean not null default false,
  claimed boolean not null default false,created_at timestamptz not null default now(),
  primary key(victim_id,run_id),check(victim_id<>killer_id),check(char_length(run_id) between 1 and 80)
);
alter table public.iron_cell_gojo_kill_attestations enable row level security;
revoke all on public.iron_cell_gojo_kill_attestations from public,anon,authenticated;

create or replace function public.iron_cell_finalize_gojo_kill_v1(p_victim_id uuid,p_run_id text)
returns public.iron_cell_profiles language plpgsql security definer set search_path=''
as $$
declare v_event public.iron_cell_gojo_kill_attestations;v_row public.iron_cell_profiles;
begin
  select * into v_event from public.iron_cell_gojo_kill_attestations where victim_id=p_victim_id and run_id=p_run_id for update;
  if not found or not v_event.victim_confirmed or not v_event.killer_confirmed or v_event.claimed then return null; end if;
  update public.iron_cell_profiles set owned_cannons=case when owned_cannons?'gojo' then owned_cannons else owned_cannons||'["gojo"]'::jsonb end,updated_at=now()
    where user_id=v_event.killer_id returning * into v_row;
  update public.iron_cell_gojo_kill_attestations set claimed=true where victim_id=p_victim_id and run_id=p_run_id;
  return v_row;
end $$;
revoke all on function public.iron_cell_finalize_gojo_kill_v1(uuid,text) from public,anon,authenticated;

create or replace function public.iron_cell_report_gojo_death_v1(p_killer_id uuid,p_run_id text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_victim uuid:=auth.uid();v_run text:=left(trim(coalesce(p_run_id,'')),80);
begin
  if v_victim is null then raise exception 'not_authenticated'; end if;
  if p_killer_id is null or p_killer_id=v_victim or v_run='' then raise exception 'invalid_kill'; end if;
  if not exists(select 1 from public.iron_cell_profiles where user_id=v_victim and equipped_cannon='gojo') then raise exception 'victim_not_gojo'; end if;
  if not exists(select 1 from public.iron_cell_run_claims where user_id=v_victim and run_id=v_run and finished) then raise exception 'victim_run_not_finished'; end if;
  insert into public.iron_cell_gojo_kill_attestations(victim_id,run_id,killer_id,victim_confirmed) values(v_victim,v_run,p_killer_id,true)
    on conflict(victim_id,run_id) do update set victim_confirmed=true where public.iron_cell_gojo_kill_attestations.killer_id=excluded.killer_id;
  if not found then raise exception 'killer_mismatch'; end if;
  perform public.iron_cell_finalize_gojo_kill_v1(v_victim,v_run);return true;
end $$;
revoke all on function public.iron_cell_report_gojo_death_v1(uuid,text) from public,anon;
grant execute on function public.iron_cell_report_gojo_death_v1(uuid,text) to authenticated;

create or replace function public.iron_cell_confirm_gojo_kill_v1(p_victim_id uuid,p_run_id text)
returns public.iron_cell_profiles language plpgsql security definer set search_path=''
as $$
declare v_killer uuid:=auth.uid();v_run text:=left(trim(coalesce(p_run_id,'')),80);
begin
  if v_killer is null then raise exception 'not_authenticated'; end if;
  update public.iron_cell_gojo_kill_attestations set killer_confirmed=true where victim_id=p_victim_id and run_id=v_run and killer_id=v_killer and victim_confirmed;
  if not found then raise exception 'victim_attestation_pending'; end if;
  return public.iron_cell_finalize_gojo_kill_v1(p_victim_id,v_run);
end $$;
revoke all on function public.iron_cell_confirm_gojo_kill_v1(uuid,text) from public,anon;
grant execute on function public.iron_cell_confirm_gojo_kill_v1(uuid,text) to authenticated;

commit;

