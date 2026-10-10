-- Claim in the same server transaction as the qualifying run save.
-- The game reports the class state; level and equipped cannon are checked here.
create or replace function public.iron_cell_save_basic_run_v1(
  p_run_id text,p_pilot_name text,p_level integer,p_score bigint,p_kills integer,
  p_finish boolean default false,p_basic_tank boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_row public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_result := public.iron_cell_save_run_v2(p_run_id,p_pilot_name,p_level,p_score,p_kills,p_finish);
  if coalesce(p_basic_tank,false) and coalesce(p_level,1)>=45 then
    select * into v_row from public.iron_cell_profiles where user_id=v_uid for update;
    if v_row.equipped_cannon='standard' and not coalesce(v_row.owned_cannons,'[]'::jsonb) ? 'gojo' then
      update public.iron_cell_profiles
      set owned_cannons=coalesce(owned_cannons,'[]'::jsonb)||jsonb_build_array('gojo'),updated_at=now()
      where user_id=v_uid returning * into v_row;
      v_result := jsonb_set(v_result,'{profile}',to_jsonb(v_row));
    end if;
  end if;
  return v_result;
end;
$function$;
revoke all on function public.iron_cell_save_basic_run_v1(text,text,integer,bigint,integer,boolean,boolean) from public, anon;
grant execute on function public.iron_cell_save_basic_run_v1(text,text,integer,bigint,integer,boolean,boolean) to authenticated;

-- Retire the former highest-level-only path so cached clients cannot grant Gojo.
create or replace function public.iron_cell_claim_singularity_v1()
returns public.iron_cell_profiles
language plpgsql
set search_path to 'public'
as $function$
begin
  raise exception 'basic_tank_run_required';
end;
$function$;
