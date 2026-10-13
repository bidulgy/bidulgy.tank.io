create or replace function public.iron_cell_admin_set_cannon_v3(p_username text,p_cannon text,p_owned boolean)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid;v_cannon text:=lower(trim(coalesce(p_cannon,'')));v_row public.iron_cell_profiles;
begin
 if auth.uid() is null or not public.iron_cell_admin_is_admin() then raise exception 'admin_required'; end if;
 if v_cannon not in ('standard','scout','bastion','rapid','dual','needle','blaster','ranger','spread','burst','crystal','ricochet','mortar','piercer','laser','drill','shredder','seeker','plasma','thunder','inferno','frost','magnet','rocket','titan','phantom','cyclone','juggernaut','ring','chrono','void','mirror','lancer','nova','comet','stellar','leviathan','valkyrie','error','glitch','zero','berserker','oracle','deku','sniper','bloodlust','gojo','amalgam') then raise exception 'invalid_cannon'; end if;
 select user_id into v_uid from public.iron_cell_accounts where lower(username)=lower(trim(coalesce(p_username,''))) limit 1;
 if v_uid is null then raise exception 'account_not_found'; end if;
 update public.iron_cell_profiles set owned_cannons=case when p_owned then case when coalesce(owned_cannons,'[]'::jsonb)?v_cannon then coalesce(owned_cannons,'[]'::jsonb) else coalesce(owned_cannons,'[]'::jsonb)||jsonb_build_array(v_cannon) end else coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(owned_cannons,'[]'::jsonb)) value where value<>to_jsonb(v_cannon)),'[]'::jsonb) end,equipped_cannon=case when not p_owned and equipped_cannon=v_cannon then 'standard' else equipped_cannon end,updated_at=now() where user_id=v_uid returning * into v_row;
 return jsonb_build_object('ok',true,'profile',to_jsonb(v_row));
end;$function$;

create or replace function public.iron_cell_equip_cannon_v3(p_cannon text)
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

revoke all on function public.iron_cell_admin_set_cannon_v3(text,text,boolean) from public,anon;
grant execute on function public.iron_cell_admin_set_cannon_v3(text,text,boolean) to authenticated;
revoke all on function public.iron_cell_equip_cannon_v3(text) from public,anon;
grant execute on function public.iron_cell_equip_cannon_v3(text) to authenticated;

update public.iron_cell_profiles p set equipped_cannon='amalgam',updated_at=now()
from public.iron_cell_accounts a where a.user_id=p.user_id and lower(a.username)='bidulgy' and coalesce(p.owned_cannons,'[]'::jsonb)?'amalgam';
select a.username,p.equipped_cannon,p.owned_cannons?'amalgam' as has_amalgam from public.iron_cell_accounts a join public.iron_cell_profiles p using(user_id) where lower(a.username)='bidulgy';
