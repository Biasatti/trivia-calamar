-- Ejecutar UNA VEZ en el SQL Editor de un proyecto Supabase nuevo.
-- Todas las tablas quedan en un esquema privado. El navegador solo usa RPC.
begin;
create schema if not exists trivia_private;
revoke all on schema trivia_private from public, anon, authenticated;
create table trivia_private.settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 event_end_at timestamptz,
 privacy_ready boolean not null default false,
 privacy_version text not null default '2026-10-22-v1',
 check(not enabled or (event_end_at is not null and privacy_ready))
);
insert into trivia_private.settings(id) values(true);
create table trivia_private.questions (
 id integer primary key,
 difficulty text not null check(difficulty in ('easy','medium','hard')),
 body text not null,
 options jsonb not null check(jsonb_array_length(options)=4),
 answer integer not null check(answer between 0 and 3)
);
create table trivia_private.participants (
 id uuid primary key default gen_random_uuid(),
 first_name text not null,
 last_name text not null,
 email text not null unique,
 score integer not null check(score between 0 and 100 and score%10=0),
 elapsed_ms bigint not null check(elapsed_ms>=0),
 registered_at timestamptz not null default clock_timestamp(),
 privacy_version text not null,
 consent_at timestamptz not null default clock_timestamp(),
 marketing boolean not null default false
);
create table trivia_private.marketing_contacts (
 email text primary key,
 first_name text not null,
 last_name text not null,
 consent_at timestamptz not null default clock_timestamp(),
 privacy_version text not null
);
create table trivia_private.sessions (
 token uuid primary key default gen_random_uuid(),
 questions jsonb not null,
 answers jsonb not null default '[]',
 started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 score integer not null default 0,
 elapsed_ms bigint,
 participant_id uuid references trivia_private.participants(id) on delete set null
);
create index sessions_started_idx on trivia_private.sessions(started_at);
create index ranking_idx on trivia_private.participants(score desc,elapsed_ms,registered_at,id);
alter table trivia_private.settings enable row level security;
alter table trivia_private.questions enable row level security;
alter table trivia_private.participants enable row level security;
alter table trivia_private.marketing_contacts enable row level security;
alter table trivia_private.sessions enable row level security;
revoke all on all tables in schema trivia_private from public, anon, authenticated;

create function trivia_private.check_open() returns void language plpgsql set search_path='' as $$
declare cfg trivia_private.settings;
begin
 select * into cfg from trivia_private.settings where id=true;
 if not cfg.enabled or not cfg.privacy_ready or cfg.event_end_at is null or clock_timestamp()>cfg.event_end_at then
  raise exception 'La trivia no está habilitada en este momento.';
 end if;
end;$$;

create function trivia_private.state(p_token uuid) returns jsonb language plpgsql set search_path='' as $$
declare s trivia_private.sessions; n integer; q jsonb;
begin
 select * into s from trivia_private.sessions where token=p_token;
 if not found or s.started_at<clock_timestamp()-interval '24 hours' then
  raise exception 'La partida venció. Iniciá una nueva.';
 end if;
 n:=jsonb_array_length(s.answers);
 q:=s.questions->n;
 return jsonb_build_object('token',s.token,'answered',n,'finished',s.finished_at is not null,
  'score',case when s.finished_at is not null then s.score else null end,
  'elapsed_ms',coalesce(s.elapsed_ms,greatest(0,floor(extract(epoch from (clock_timestamp()-s.started_at))*1000)::bigint)),
  'registered',s.participant_id is not null,
  'question',case when q is null then null else jsonb_build_object('id',q->'id','text',q->'text','options',q->'options') end);
end;$$;

create function public.trivia_start() returns jsonb language plpgsql security definer set search_path='' as $$
declare picked jsonb; tok uuid;
begin
 perform trivia_private.check_open();
 -- Global circuit breaker, not identity verification. See README for public use limits.
 perform pg_advisory_xact_lock(482051);
 if (select count(*) from trivia_private.sessions where started_at>clock_timestamp()-interval '1 minute')>=300 then
  raise exception 'Hay muchas partidas iniciándose. Intentá nuevamente en un minuto.';
 end if;
 select jsonb_agg(jsonb_build_object('id',id,'text',body,'options',options,'answer',answer) order by random()) into picked
 from (
  (select * from trivia_private.questions where difficulty='easy' order by random() limit 4)
  union all (select * from trivia_private.questions where difficulty='medium' order by random() limit 4)
  union all (select * from trivia_private.questions where difficulty='hard' order by random() limit 2)
 ) q;
 if picked is null or jsonb_array_length(picked)<>10 then raise exception 'El banco de preguntas está incompleto.'; end if;
 insert into trivia_private.sessions(questions) values(picked) returning token into tok;
 return trivia_private.state(tok);
end;$$;

create function public.trivia_resume(p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin return trivia_private.state(p_token);end;$$;

create function public.trivia_answer(p_token uuid,p_question_id integer,p_choice integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s trivia_private.sessions; q jsonb; n integer; hit integer; current_time_at timestamptz;
begin
 select * into s from trivia_private.sessions where token=p_token for update;
 if not found or s.started_at<clock_timestamp()-interval '24 hours' then raise exception 'La partida venció. Iniciá una nueva.';end if;
 -- Reintento de una respuesta ya confirmada: no suma puntos ni tiempo otra vez.
 if exists(select 1 from jsonb_array_elements(s.answers) a where (a->>'id')::integer=p_question_id) then
  return trivia_private.state(p_token);
 end if;
 if s.finished_at is not null then raise exception 'La partida ya terminó.';end if;
 if p_choice is null or p_choice not between 0 and 3 then raise exception 'Respuesta inválida.';end if;
 n:=jsonb_array_length(s.answers);q:=s.questions->n;
 if p_question_id is null or (q->>'id')::integer<>p_question_id then raise exception 'La pregunta no corresponde a esta partida. Recargá la página.';end if;
 hit:=case when (q->>'answer')::integer=p_choice then 10 else 0 end;
 current_time_at:=clock_timestamp();
 update trivia_private.sessions set answers=answers||jsonb_build_array(jsonb_build_object('id',p_question_id,'choice',p_choice)),
  score=score+hit,
  finished_at=case when n=9 then current_time_at else null end,
  elapsed_ms=case when n=9 then greatest(0,floor(extract(epoch from(current_time_at-s.started_at))*1000)::bigint) else null end
 where token=p_token;
 return trivia_private.state(p_token);
end;$$;

create function public.trivia_register(p_token uuid,p_first text,p_last text,p_email text,p_consent boolean,p_marketing boolean,p_notice_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s trivia_private.sessions; cfg trivia_private.settings; pid uuid; duplicate boolean:=false;
begin
 select * into cfg from trivia_private.settings where id=true;
 if not cfg.enabled or not cfg.privacy_ready or cfg.event_end_at is null or clock_timestamp()>cfg.event_end_at+interval '1 hour' then
  raise exception 'El registro del evento está cerrado.';
 end if;
 if p_consent is distinct from true then raise exception 'Necesitamos tu autorización para registrar el resultado.';end if;
 if p_notice_version is distinct from cfg.privacy_version then raise exception 'El aviso de privacidad cambió. Recargá la página y revisalo.';end if;
 p_first:=btrim(p_first);p_last:=btrim(p_last);p_email:=lower(btrim(p_email));
 if p_first is null or length(p_first) not between 2 and 60 or p_last is null or length(p_last) not between 2 and 60
  or p_first~'[[:cntrl:]]' or p_last~'[[:cntrl:]]' then raise exception 'Revisá el nombre y el apellido.';end if;
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Revisá la dirección de mail.';end if;
 select * into s from trivia_private.sessions where token=p_token for update;
 if not found or s.started_at<clock_timestamp()-interval '24 hours' then raise exception 'La partida venció. Iniciá una nueva.';end if;
 if s.finished_at is null or jsonb_array_length(s.answers)<>10 then raise exception 'Terminá las diez preguntas primero.';end if;
 if s.participant_id is not null then return jsonb_build_object('ok',true,'duplicate',false);end if;
 insert into trivia_private.participants(first_name,last_name,email,score,elapsed_ms,privacy_version,marketing)
 values(p_first,p_last,p_email,s.score,s.elapsed_ms,cfg.privacy_version,coalesce(p_marketing,false))
 on conflict(email) do nothing returning id into pid;
 if pid is null then
  select id into pid from trivia_private.participants where email=p_email;duplicate:=true;
 else
  if p_marketing is true then
   insert into trivia_private.marketing_contacts(email,first_name,last_name,privacy_version)
   values(p_email,p_first,p_last,cfg.privacy_version)
   on conflict(email) do nothing;
  end if;
 end if;
 update trivia_private.sessions set participant_id=pid where token=p_token;
 return jsonb_build_object('ok',true,'duplicate',duplicate);
end;$$;

create function public.trivia_ranking(p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; result jsonb;
begin
 select participant_id into pid from trivia_private.sessions
 where token=p_token and started_at>clock_timestamp()-interval '24 hours';
 if pid is null then raise exception 'Registrá tu resultado para ver el ranking.';end if;
 with ranked as (
  select row_number() over(order by score desc,elapsed_ms,registered_at,id) as position,
   first_name||' '||upper(left(last_name,1))||'.' as name,score,elapsed_ms,id=pid as mine
  from trivia_private.participants
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r) order by position) from ranked r where position<=50),'[]'::jsonb),
 'mine',(select to_jsonb(r) from ranked r where mine), 'total',(select count(*) from ranked)) into result;
 return result;
end;$$;

create function trivia_private.cleanup() returns void language plpgsql security definer set search_path='' as $$
declare ends timestamptz;
begin
 select event_end_at into ends from trivia_private.settings where id=true;
 delete from trivia_private.sessions where started_at<clock_timestamp()-interval '24 hours';
 if ends is not null and clock_timestamp()>=ends+interval '90 days' then
  delete from trivia_private.sessions;
  delete from trivia_private.participants;
  update trivia_private.settings set enabled=false where id=true;
 end if;
 -- Los contactos con consentimiento de marketing se gestionan por separado.
end;$$;
revoke all on all functions in schema trivia_private from public,anon,authenticated;
revoke all on function public.trivia_start(),public.trivia_resume(uuid),public.trivia_answer(uuid,integer,integer),
 public.trivia_register(uuid,text,text,text,boolean,boolean,text),public.trivia_ranking(uuid) from public,anon,authenticated;
grant execute on function public.trivia_start(),public.trivia_resume(uuid),public.trivia_answer(uuid,integer,integer),
 public.trivia_register(uuid,text,text,text,boolean,boolean,text),public.trivia_ranking(uuid) to anon,authenticated;
commit;
