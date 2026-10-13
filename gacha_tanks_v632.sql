-- V6.32: 18 new gacha tanks. Existing Gojo/Amalgam unlock routes stay unchanged.
create or replace function public.iron_cell_pull_cannons_v2(p_count integer)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();v_count integer:=coalesce(p_count,0);v_cost bigint;v_row public.iron_cell_profiles;
  v_i integer;v_roll double precision;v_pick text;v_rarity text;v_rarest text:='common';v_counts jsonb:='{}'::jsonb;
  v_new jsonb:='[]'::jsonb;v_owned jsonb;v_rank integer:=0;v_pick_rank integer;
  commons text[]:=array['rapid','dual','needle','blaster','ranger','javelin','summoner'];
  rares text[]:=array['spread','burst','crystal','ricochet','mortar','architect','alchemist'];
  epics text[]:=array['piercer','laser','drill','shredder','seeker','boomerang','trapper'];
  legendaries text[]:=array['plasma','thunder','inferno','frost','magnet','puppeteer','tempest'];
  mythics text[]:=array['rocket','titan','phantom','cyclone','juggernaut','chronoblade','demolisher'];
  secrets text[]:=array['ring','chrono','void','mirror','lancer','phaseweaver','parasite'];
  galaxies text[]:=array['nova','comet','stellar','leviathan','valkyrie','starforge','cometrail'];
  errors text[]:=array['error','glitch','zero','berserker','oracle','corruptor','duplicator'];
  divines text[]:=array['deku','sniper','bloodlust','seraph'];
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  if v_count not in (1,5,10,50,100,500,1000) then raise exception 'invalid_pull_count';end if;
  v_cost:=v_count*100;select * into v_row from public.iron_cell_profiles where user_id=v_uid for update;
  if v_row.gems<v_cost then raise exception 'not_enough_gems';end if;v_owned:=coalesce(v_row.owned_cannons,'[]'::jsonb);
  for v_i in 1..v_count loop
    v_roll:=random()*100;
    if v_roll<0.00005 then v_pick:='eventhorizon';v_rarity:='singularity';v_pick_rank:=10;
    elsif v_roll<0.00305 then v_pick:=divines[1+floor(random()*array_length(divines,1))::int];v_rarity:='divine';v_pick_rank:=9;
    elsif v_roll<0.01805 then v_pick:=errors[1+floor(random()*array_length(errors,1))::int];v_rarity:='error';v_pick_rank:=8;
    elsif v_roll<0.06805 then v_pick:=galaxies[1+floor(random()*array_length(galaxies,1))::int];v_rarity:='galaxy';v_pick_rank:=7;
    elsif v_roll<0.26805 then v_pick:=secrets[1+floor(random()*array_length(secrets,1))::int];v_rarity:='secret';v_pick_rank:=6;
    elsif v_roll<0.76805 then v_pick:=mythics[1+floor(random()*array_length(mythics,1))::int];v_rarity:='mythic';v_pick_rank:=5;
    elsif v_roll<2.76805 then v_pick:=legendaries[1+floor(random()*array_length(legendaries,1))::int];v_rarity:='legendary';v_pick_rank:=4;
    elsif v_roll<13.02305 then v_pick:=epics[1+floor(random()*array_length(epics,1))::int];v_rarity:='epic';v_pick_rank:=3;
    elsif v_roll<38.65305 then v_pick:=rares[1+floor(random()*array_length(rares,1))::int];v_rarity:='rare';v_pick_rank:=2;
    else v_pick:=commons[1+floor(random()*array_length(commons,1))::int];v_rarity:='common';v_pick_rank:=1;end if;
    v_counts:=jsonb_set(v_counts,array[v_pick],to_jsonb(coalesce((v_counts->>v_pick)::int,0)+1),true);
    if not v_owned?v_pick then v_owned:=v_owned||jsonb_build_array(v_pick);v_new:=v_new||jsonb_build_array(v_pick);end if;
    if v_pick_rank>v_rank then v_rank:=v_pick_rank;v_rarest:=v_rarity;end if;
  end loop;
  update public.iron_cell_profiles set gems=gems-v_cost,owned_cannons=v_owned,updated_at=now() where user_id=v_uid returning * into v_row;
  return jsonb_build_object('gems',v_row.gems,'owned_cannons',v_owned,'counts',v_counts,'new_cannons',v_new,'rarest',v_rarest);
end;$function$;

create or replace function public.iron_cell_admin_set_cannon_v3(p_username text,p_cannon text,p_owned boolean)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid;v_cannon text:=lower(trim(coalesce(p_cannon,'')));v_row public.iron_cell_profiles;
begin
  if auth.uid() is null or not public.iron_cell_admin_is_admin() then raise exception 'admin_required';end if;
  if v_cannon not in ('standard','scout','bastion','rapid','dual','needle','blaster','ranger','javelin','summoner','spread','burst','crystal','ricochet','mortar','architect','alchemist','piercer','laser','drill','shredder','seeker','boomerang','trapper','plasma','thunder','inferno','frost','magnet','puppeteer','tempest','rocket','titan','phantom','cyclone','juggernaut','chronoblade','demolisher','ring','chrono','void','mirror','lancer','phaseweaver','parasite','nova','comet','stellar','leviathan','valkyrie','starforge','cometrail','error','glitch','zero','berserker','oracle','corruptor','duplicator','deku','sniper','bloodlust','seraph','gojo','amalgam','eventhorizon') then raise exception 'invalid_cannon';end if;
  select user_id into v_uid from public.iron_cell_accounts where lower(username)=lower(trim(coalesce(p_username,''))) limit 1;
  if v_uid is null then raise exception 'account_not_found';end if;
  update public.iron_cell_profiles set owned_cannons=case when p_owned then case when coalesce(owned_cannons,'[]'::jsonb)?v_cannon then coalesce(owned_cannons,'[]'::jsonb) else coalesce(owned_cannons,'[]'::jsonb)||jsonb_build_array(v_cannon) end else coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(owned_cannons,'[]'::jsonb)) value where value<>to_jsonb(v_cannon)),'[]'::jsonb) end,equipped_cannon=case when not p_owned and equipped_cannon=v_cannon then 'standard' else equipped_cannon end,updated_at=now() where user_id=v_uid returning * into v_row;
  return jsonb_build_object('ok',true,'profile',to_jsonb(v_row));
end;$function$;

revoke all on function public.iron_cell_pull_cannons_v2(integer) from public,anon;
grant execute on function public.iron_cell_pull_cannons_v2(integer) to authenticated;
revoke all on function public.iron_cell_admin_set_cannon_v3(text,text,boolean) from public,anon;
grant execute on function public.iron_cell_admin_set_cannon_v3(text,text,boolean) to authenticated;
