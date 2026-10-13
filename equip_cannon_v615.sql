create or replace function public.iron_cell_equip_cannon_v2(p_cannon text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=auth.uid();v_cannon text:=lower(trim(coalesce(p_cannon,'')));v_row public.iron_cell_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_row from public.iron_cell_profiles where user_id=v_uid for update;
  if not found then raise exception 'profile_not_found'; end if;
  if not coalesce(v_row.owned_cannons,'[]'::jsonb)?v_cannon then raise exception 'cannon_not_owned'; end if;
  update public.iron_cell_profiles set equipped_cannon=v_cannon,updated_at=now() where user_id=v_uid returning * into v_row;
  return jsonb_build_object('ok',true,'profile',to_jsonb(v_row));
end;$function$;
revoke all on function public.iron_cell_equip_cannon_v2(text) from public,anon;
grant execute on function public.iron_cell_equip_cannon_v2(text) to authenticated;
select to_regprocedure('public.iron_cell_equip_cannon_v2(text)') is not null as equip_v2_ready;
