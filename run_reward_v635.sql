begin;

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

commit;
