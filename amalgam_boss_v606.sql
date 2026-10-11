begin;

alter table public.iron_cell_profiles
  add column if not exists summon_stones bigint not null default 0 check (summon_stones >= 0);

create table if not exists public.iron_cell_boss_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  boss_slot bigint not null,
  damage bigint not null check (damage between 0 and 1000000),
  summon_stones_awarded bigint not null check (summon_stones_awarded between 0 and 1000000),
  amalgam_unlocked boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id,boss_slot)
);

alter table public.iron_cell_boss_claims enable row level security;
revoke all on public.iron_cell_boss_claims from public,anon,authenticated;

create or replace function public.iron_cell_claim_amalgam_boss_v1(p_slot bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_now_slot bigint:=floor(extract(epoch from now())/1800);
  v_damage bigint:=greatest(0,least(coalesce(p_damage,0),1000000));
  v_stones bigint:=greatest(0,least(1000000,v_damage));
  v_unlock boolean:=false;
  v_profile public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_slot < v_now_slot-2 or p_slot > v_now_slot then raise exception 'invalid_boss_slot'; end if;
  if v_damage <= 0 then raise exception 'no_boss_contribution'; end if;
  if exists(select 1 from public.iron_cell_boss_claims where user_id=v_uid and boss_slot=p_slot) then
    select * into v_profile from public.iron_cell_profiles where user_id=v_uid;
    return jsonb_build_object('profile',to_jsonb(v_profile),'summon_stones_awarded',0,'amalgam_unlocked',coalesce(v_profile.owned_cannons,'[]'::jsonb)?'amalgam','already_claimed',true);
  end if;
  v_unlock:=random() < (v_damage::numeric/1000000.0)*0.10;
  insert into public.iron_cell_boss_claims(user_id,boss_slot,damage,summon_stones_awarded,amalgam_unlocked)
    values(v_uid,p_slot,v_damage,v_stones,v_unlock);
  update public.iron_cell_profiles set
    summon_stones=summon_stones+v_stones,
    owned_cannons=case when v_unlock and not owned_cannons?'amalgam' then owned_cannons||'["amalgam"]'::jsonb else owned_cannons end,
    updated_at=now()
    where user_id=v_uid returning * into v_profile;
  return jsonb_build_object('profile',to_jsonb(v_profile),'summon_stones_awarded',v_stones,'amalgam_unlocked',v_unlock,'already_claimed',false);
end $$;

revoke all on function public.iron_cell_claim_amalgam_boss_v1(bigint,bigint) from public,anon;
grant execute on function public.iron_cell_claim_amalgam_boss_v1(bigint,bigint) to authenticated;

commit;
