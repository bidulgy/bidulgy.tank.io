-- Two different authenticated accounts must attest to the same Gojo death.
create table if not exists public.iron_cell_gojo_kill_attestations (
  victim_id uuid not null,
  run_id text not null,
  killer_id uuid not null,
  victim_confirmed boolean not null default false,
  killer_confirmed boolean not null default false,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (victim_id,run_id),
  check (victim_id<>killer_id),
  check (length(run_id) between 1 and 80)
);
alter table public.iron_cell_gojo_kill_attestations enable row level security;
revoke all on public.iron_cell_gojo_kill_attestations from public,anon,authenticated;

create or replace function public.iron_cell_finalize_gojo_kill_v1(p_victim_id uuid,p_run_id text)
returns public.iron_cell_profiles
language plpgsql security definer set search_path to 'public'
as $function$
declare v_event public.iron_cell_gojo_kill_attestations; v_row public.iron_cell_profiles;
begin
  select * into v_event from public.iron_cell_gojo_kill_attestations
    where victim_id=p_victim_id and run_id=p_run_id for update;
  if not found or not v_event.victim_confirmed or not v_event.killer_confirmed or v_event.claimed then return null; end if;
  update public.iron_cell_profiles
    set owned_cannons=case when coalesce(owned_cannons,'[]'::jsonb) ? 'gojo' then owned_cannons
      else coalesce(owned_cannons,'[]'::jsonb)||jsonb_build_array('gojo') end,
        updated_at=now()
    where user_id=v_event.killer_id returning * into v_row;
  if not found then raise exception 'killer_profile_not_found'; end if;
  update public.iron_cell_gojo_kill_attestations set claimed=true
    where victim_id=p_victim_id and run_id=p_run_id;
  return v_row;
end;
$function$;
revoke all on function public.iron_cell_finalize_gojo_kill_v1(uuid,text) from public,anon,authenticated;

create or replace function public.iron_cell_report_gojo_death_v1(p_killer_id uuid,p_run_id text)
returns boolean
language plpgsql security definer set search_path to 'public'
as $function$
declare v_victim uuid := auth.uid(); v_run text := left(trim(coalesce(p_run_id,'')),80);
begin
  if v_victim is null then raise exception 'not_authenticated'; end if;
  if p_killer_id is null or p_killer_id=v_victim or v_run='' then raise exception 'invalid_kill'; end if;
  if not exists(select 1 from public.iron_cell_profiles where user_id=v_victim and equipped_cannon='gojo')
    then raise exception 'victim_not_gojo'; end if;
  if not exists(select 1 from public.iron_cell_run_claims where user_id=v_victim and run_id=v_run and finished=true)
    then raise exception 'victim_run_not_finished'; end if;
  if not exists(select 1 from public.iron_cell_profiles where user_id=p_killer_id)
    then raise exception 'killer_profile_not_found'; end if;
  insert into public.iron_cell_gojo_kill_attestations(victim_id,run_id,killer_id,victim_confirmed)
    values(v_victim,v_run,p_killer_id,true)
    on conflict (victim_id,run_id) do update set victim_confirmed=true
      where public.iron_cell_gojo_kill_attestations.killer_id=excluded.killer_id;
  if not found then raise exception 'killer_mismatch'; end if;
  perform public.iron_cell_finalize_gojo_kill_v1(v_victim,v_run);
  return true;
end;
$function$;
revoke all on function public.iron_cell_report_gojo_death_v1(uuid,text) from public,anon;
grant execute on function public.iron_cell_report_gojo_death_v1(uuid,text) to authenticated;

create or replace function public.iron_cell_confirm_gojo_kill_v1(p_victim_id uuid,p_run_id text)
returns public.iron_cell_profiles
language plpgsql security definer set search_path to 'public'
as $function$
declare v_killer uuid := auth.uid(); v_run text := left(trim(coalesce(p_run_id,'')),80);
begin
  if v_killer is null then raise exception 'not_authenticated'; end if;
  if p_victim_id is null or p_victim_id=v_killer or v_run='' then raise exception 'invalid_kill'; end if;
  update public.iron_cell_gojo_kill_attestations set killer_confirmed=true
    where victim_id=p_victim_id and run_id=v_run and killer_id=v_killer and victim_confirmed=true;
  if not found then raise exception 'victim_attestation_pending'; end if;
  return public.iron_cell_finalize_gojo_kill_v1(p_victim_id,v_run);
end;
$function$;
revoke all on function public.iron_cell_confirm_gojo_kill_v1(uuid,text) from public,anon;
grant execute on function public.iron_cell_confirm_gojo_kill_v1(uuid,text) to authenticated;

-- The former level-only claim can no longer grant this reward.
create or replace function public.iron_cell_claim_singularity_v1()
returns public.iron_cell_profiles language plpgsql set search_path to 'public'
as $function$ begin raise exception 'gojo_kill_required'; end; $function$;

-- Existing owners keep access; newly earned owners do not need level 45.
create or replace function public.iron_cell_equip_cannon_v1(p_cannon text)
returns public.iron_cell_profiles
language plpgsql set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_cannon text := lower(trim(coalesce(p_cannon,'')));
        v_row public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_cannon not in (
    'standard','scout','bastion','rapid','dual','needle','blaster','ranger',
    'spread','burst','crystal','ricochet','mortar','piercer','laser','drill',
    'shredder','seeker','plasma','thunder','inferno','frost','magnet','rocket',
    'titan','phantom','cyclone','juggernaut','ring','chrono','void','mirror',
    'lancer','nova','comet','stellar','leviathan','valkyrie','error','glitch',
    'zero','berserker','oracle','deku','sniper','bloodlust','gojo'
  ) then raise exception 'invalid_cannon'; end if;
  select * into v_row from public.iron_cell_profiles where user_id=v_uid;
  if not found then raise exception 'profile_not_found'; end if;
  if not coalesce(v_row.owned_cannons,'[]'::jsonb) ? v_cannon then raise exception 'cannon_not_owned'; end if;
  update public.iron_cell_profiles set equipped_cannon=v_cannon,updated_at=now()
    where user_id=v_uid returning * into v_row;
  return v_row;
end;
$function$;
