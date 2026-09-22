-- Level 45 permanently unlocks Gojo. The gacha pool remains unchanged.
create or replace function public.iron_cell_claim_singularity_v1()
returns public.iron_cell_profiles
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_row from public.iron_cell_profiles where user_id=v_uid for update;
  if not found then raise exception 'profile_not_found'; end if;
  if coalesce(v_row.best_level,1)<45 then raise exception 'level_45_required'; end if;
  if not coalesce(v_row.owned_cannons,'[]'::jsonb) ? 'gojo' then
    update public.iron_cell_profiles
      set owned_cannons=coalesce(owned_cannons,'[]'::jsonb)||jsonb_build_array('gojo'),updated_at=now()
      where user_id=v_uid returning * into v_row;
  end if;
  return v_row;
end;
$function$;
revoke all on function public.iron_cell_claim_singularity_v1() from public, anon;
grant execute on function public.iron_cell_claim_singularity_v1() to authenticated;

create or replace function public.iron_cell_equip_cannon_v1(p_cannon text)
returns public.iron_cell_profiles
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_cannon text := lower(trim(coalesce(p_cannon, '')));
  v_row public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_cannon not in (
    'standard','scout','bastion',
    'rapid','dual','needle','blaster','ranger',
    'spread','burst','crystal','ricochet','mortar',
    'piercer','laser','drill','shredder','seeker',
    'plasma','thunder','inferno','frost','magnet',
    'rocket','titan','phantom','cyclone','juggernaut',
    'ring','chrono','void','mirror','lancer',
    'nova','comet','stellar','leviathan','valkyrie',
    'error','glitch','zero','berserker','oracle',
    'deku','sniper','bloodlust','gojo'
  ) then raise exception 'invalid_cannon'; end if;
  select * into v_row from public.iron_cell_profiles where user_id=v_uid;
  if not found then raise exception 'profile_not_found'; end if;
  if not coalesce(v_row.owned_cannons,'[]'::jsonb) ? v_cannon then raise exception 'cannon_not_owned'; end if;
  update public.iron_cell_profiles set equipped_cannon=v_cannon, updated_at=now() where user_id=v_uid returning * into v_row;
  return v_row;
end;
$function$;
