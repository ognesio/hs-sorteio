-- =====================================================================
-- SUNSET HOUSE — Sistema de sorteio digital
-- Schema, segurança (RLS), geração atômica de números e sorteio seguro.
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.participant_status as enum ('valido', 'desclassificado', 'excluido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.draw_status as enum ('valido', 'anulado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('pendente', 'enviado', 'entregue', 'lido', 'falhou');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Administradores autorizados (allowlist sobre o Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Configurações (linha única)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  event_name         text not null default 'SUNSET HOUSE',
  raffle_name        text not null default 'Sorteio oficial Sunset House',
  raffle_description text not null default 'Participe do sorteio oficial do Sunset House, garanta seu número da sorte e aproveite a festa!',
  event_date         date not null default '2026-11-15',
  registrations_open boolean not null default true,
  max_participants   int check (max_participants is null or max_participants > 0),
  allow_same_winner  boolean not null default false,
  rules_text         text not null default 'Cada pessoa pode se cadastrar uma única vez, com telefone e e-mail próprios. Cada cadastro recebe um único número da sorte. O vencedor precisa estar presente no evento para retirar o prêmio. Cadastros com dados falsos ou duplicados podem ser desclassificados.',
  last_number        int not null default 0,          -- contador interno (não editável pelo painel)
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Prêmios / rodadas
-- ---------------------------------------------------------------------
create table if not exists public.prizes (
  id          uuid primary key default gen_random_uuid(),
  round       int not null unique check (round > 0),
  title       text not null check (char_length(title) between 2 and 120),
  description text,
  created_at  timestamptz not null default now()
);

insert into public.prizes (round, title, description) values
  (1, '2 chaveiros',                 '1º sorteio'),
  (2, 'Copo de whisky + 1 chaveiro', '2º sorteio'),
  (3, 'Kit Napiteira',               '3º sorteio'),
  (4, 'Case Napiteira',              '4º sorteio')
on conflict (round) do nothing;

-- ---------------------------------------------------------------------
-- Participantes
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text not null check (char_length(full_name) between 3 and 120),
  phone                text not null check (phone ~ '^55[1-9][0-9]9[0-9]{8}$'),  -- 55 + DDD + 9 dígitos
  email                text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  lucky_number         int  not null unique check (lucky_number > 0),
  status               public.participant_status not null default 'valido',
  status_reason        text,
  status_changed_at    timestamptz,
  status_changed_by    uuid,
  privacy_consent      boolean not null check (privacy_consent),
  privacy_consent_at   timestamptz not null default now(),
  whatsapp_consent     boolean not null default false,
  whatsapp_consent_at  timestamptz,
  receipt_token_hash   text not null,
  ip_hash              text,
  user_agent           text,
  created_at           timestamptz not null default now()
);
create unique index if not exists participants_phone_uq on public.participants (phone);
create unique index if not exists participants_email_uq on public.participants (lower(email));
create index if not exists participants_status_idx on public.participants (status);

-- ---------------------------------------------------------------------
-- Sorteios
-- ---------------------------------------------------------------------
create table if not exists public.draws (
  id                 uuid primary key default gen_random_uuid(),
  prize_id           uuid not null references public.prizes (id),
  round              int  not null,
  prize_title        text not null,
  participant_id     uuid not null references public.participants (id),
  lucky_number       int  not null,
  winner_name        text not null,
  pool_size          int  not null,
  pool_hash          text not null,     -- sha256 da lista de números elegíveis (auditoria)
  status             public.draw_status not null default 'valido',
  void_reason        text,
  voided_at          timestamptz,
  voided_by          uuid,
  performed_by       uuid not null,
  performed_by_email text,
  created_at         timestamptz not null default now()
);
create unique index if not exists draws_one_valid_per_prize on public.draws (prize_id) where status = 'valido';
create index if not exists draws_participant_idx on public.draws (participant_id);

-- ---------------------------------------------------------------------
-- Notificações (WhatsApp)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  participant_id      uuid not null references public.participants (id) on delete cascade,
  channel             text not null check (channel in ('whatsapp_api', 'whatsapp_manual')),
  status              public.notification_status not null default 'pendente',
  provider_message_id text unique,
  error               text,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists notifications_participant_idx on public.notifications (participant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Auditoria e limite de requisições
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  actor_email text,
  action      text not null,
  entity      text,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.admins where user_id = auth.uid()), p_action, p_entity, p_entity_id, p_details);
end $$;

create or replace function public.format_number(p int)
returns text language sql immutable set search_path = '' as $$
  select lpad(p::text, greatest(4, length(p::text)), '0');
$$;

-- Inteiro uniforme em [0, p_max) com gerador criptográfico (gen_random_bytes)
-- e amostragem por rejeição (sem viés de módulo).
create or replace function public.secure_random_int(p_max int)
returns int language plpgsql volatile set search_path = '' as $$
declare
  v_lim bigint;
  v     bigint;
begin
  if p_max is null or p_max < 1 then raise exception 'p_max inválido'; end if;
  v_lim := (4294967296 / p_max) * p_max;
  loop
    v := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint;
    if v < 0 then v := v + 4294967296; end if;
    if v < v_lim then return (v % p_max)::int; end if;
  end loop;
end $$;

-- Limite de requisições por chave (ex.: hash do IP) e janela de tempo
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------
-- PÚBLICO: configuração visível na landing (sem dados pessoais)
-- ---------------------------------------------------------------------
create or replace function public.get_public_config()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'event_name',          s.event_name,
    'raffle_name',         s.raffle_name,
    'raffle_description',  s.raffle_description,
    'event_date',          s.event_date,
    'rules_text',          s.rules_text,
    'registrations_open',  s.registrations_open
                           and (s.max_participants is null or s.last_number < s.max_participants),
    'closed_reason',       case
                             when not s.registrations_open then 'closed'
                             when s.max_participants is not null and s.last_number >= s.max_participants then 'full'
                             else null end,
    'prizes', coalesce((select json_agg(json_build_object('round', p.round, 'title', p.title, 'description', p.description) order by p.round)
                        from public.prizes p), '[]'::json)
  )
  from public.settings s where s.id = 1;
$$;

-- ---------------------------------------------------------------------
-- SERVIDOR (Edge Function `register`): cadastro + número da sorte atômico
-- A linha de settings é travada (FOR UPDATE): cadastros simultâneos são
-- serializados e a numeração fica sequencial, sem buracos e sem repetição.
-- ---------------------------------------------------------------------
create or replace function public.register_participant(
  p_name text, p_phone text, p_email text, p_whatsapp_consent boolean,
  p_token_hash text, p_ip_hash text, p_user_agent text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  s        public.settings;
  v_by_phone public.participants;
  v_by_email public.participants;
  v_number int;
  v_id     uuid;
begin
  select * into s from public.settings where id = 1 for update;

  select * into v_by_phone from public.participants where phone = p_phone;
  select * into v_by_email from public.participants where lower(email) = lower(p_email);

  -- Mesma pessoa voltando (telefone E e-mail batem): devolve o número já existente
  if v_by_phone.id is not null and v_by_email.id is not null and v_by_phone.id = v_by_email.id then
    if v_by_phone.status <> 'valido' then
      return json_build_object('ok', false, 'code', 'not_eligible');
    end if;
    update public.participants set receipt_token_hash = p_token_hash where id = v_by_phone.id;
    return json_build_object('ok', true, 'existing', true, 'id', v_by_phone.id,
      'name', v_by_phone.full_name, 'number', public.format_number(v_by_phone.lucky_number),
      'phone', v_by_phone.phone, 'whatsapp_consent', v_by_phone.whatsapp_consent);
  end if;
  if v_by_phone.id is not null then return json_build_object('ok', false, 'code', 'duplicate_phone'); end if;
  if v_by_email.id is not null then return json_build_object('ok', false, 'code', 'duplicate_email'); end if;

  if not s.registrations_open then return json_build_object('ok', false, 'code', 'closed'); end if;
  if s.max_participants is not null and s.last_number >= s.max_participants then
    return json_build_object('ok', false, 'code', 'full');
  end if;

  v_number := s.last_number + 1;

  begin
    insert into public.participants (full_name, phone, email, lucky_number, privacy_consent,
      whatsapp_consent, whatsapp_consent_at, receipt_token_hash, ip_hash, user_agent)
    values (p_name, p_phone, lower(p_email), v_number, true,
      coalesce(p_whatsapp_consent, false), case when p_whatsapp_consent then now() end,
      p_token_hash, p_ip_hash, left(p_user_agent, 300))
    returning id into v_id;
    update public.settings set last_number = v_number where id = 1;
  exception when unique_violation then
    return json_build_object('ok', false, 'code', 'duplicate');
  end;

  return json_build_object('ok', true, 'existing', false, 'id', v_id, 'name', p_name,
    'number', public.format_number(v_number), 'phone', p_phone,
    'whatsapp_consent', coalesce(p_whatsapp_consent, false));
end $$;

-- ---------------------------------------------------------------------
-- ADMIN: indicadores do dashboard
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select json_build_object(
    'participants_total',  (select count(*) from public.participants),
    'participants_valid',  (select count(*) from public.participants where status = 'valido'),
    'numbers_generated',   (select last_number from public.settings where id = 1),
    'numbers_available',   (select count(*) from public.participants p where p.status = 'valido'
                              and ((select allow_same_winner from public.settings where id = 1)
                                   or not exists (select 1 from public.draws d where d.participant_id = p.id and d.status = 'valido'))),
    'whatsapp_sent',       (select count(distinct participant_id) from public.notifications where status in ('enviado','entregue','lido')),
    'whatsapp_pending',    (select count(*) from public.participants p where p.whatsapp_consent and p.status <> 'excluido'
                              and not exists (select 1 from public.notifications n where n.participant_id = p.id and n.status in ('enviado','entregue','lido'))),
    'registrations_open',  (select registrations_open from public.settings where id = 1),
    'max_participants',    (select max_participants from public.settings where id = 1),
    'prizes_total',        (select count(*) from public.prizes),
    'prizes_drawn',        (select count(*) from public.draws where status = 'valido'),
    'last_registration_at',(select max(created_at) from public.participants)
  ) into r;
  return r;
end $$;

-- ADMIN: desclassificar / excluir / reativar (com motivo e auditoria)
create or replace function public.admin_set_participant_status(p_id uuid, p_status public.participant_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.participants;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Informe o motivo'; end if;
  select * into v_old from public.participants where id = p_id for update;
  if not found then raise exception 'Participante não encontrado'; end if;
  update public.participants
     set status = p_status, status_reason = p_reason, status_changed_at = now(), status_changed_by = auth.uid()
   where id = p_id;
  perform public.audit('participant_status', 'participant', p_id::text,
    jsonb_build_object('from', v_old.status, 'to', p_status, 'reason', p_reason,
                       'number', public.format_number(v_old.lucky_number), 'name', v_old.full_name));
end $$;

-- ADMIN: registra envio manual (wa.me) confirmado pelo administrador
create or replace function public.admin_mark_manual_whatsapp(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.notifications (participant_id, channel, status, created_by)
  values (p_id, 'whatsapp_manual', 'enviado', auth.uid());
  perform public.audit('whatsapp_manual', 'participant', p_id::text, null);
end $$;

-- ---------------------------------------------------------------------
-- ADMIN: SORTEIO
-- * só administradores; trava global (sem sorteios simultâneos)
-- * sorteio criptograficamente seguro no servidor
-- * não repete vencedor (a menos que allow_same_winner = true)
-- * refazer exige confirmação + motivo; o sorteio anterior fica "anulado"
--   e o ganhador anulado não volta a concorrer a este mesmo prêmio
-- ---------------------------------------------------------------------
create or replace function public.perform_draw(p_prize_id uuid, p_redo boolean default false, p_redo_reason text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_prize   public.prizes;
  v_prev    public.draws;
  v_allow   boolean;
  v_pool    int[];
  v_n       int;
  v_number  int;
  v_winner  public.participants;
  v_hash    text;
  v_draw_id uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not pg_try_advisory_xact_lock(hashtext('sunset_house_draw')) then
    return json_build_object('ok', false, 'code', 'draw_in_progress');
  end if;

  select email into v_email from public.admins where user_id = v_uid;
  select * into v_prize from public.prizes where id = p_prize_id for update;
  if not found then return json_build_object('ok', false, 'code', 'prize_not_found'); end if;

  select * into v_prev from public.draws where prize_id = p_prize_id and status = 'valido';
  if v_prev.id is not null then
    if not coalesce(p_redo, false) or coalesce(trim(p_redo_reason), '') = '' then
      return json_build_object('ok', false, 'code', 'already_drawn');
    end if;
    update public.draws set status = 'anulado', void_reason = p_redo_reason, voided_at = now(), voided_by = v_uid
     where id = v_prev.id;
    perform public.audit('draw_voided', 'draw', v_prev.id::text,
      jsonb_build_object('round', v_prize.round, 'number', public.format_number(v_prev.lucky_number), 'reason', p_redo_reason));
  end if;

  select allow_same_winner into v_allow from public.settings where id = 1;

  select array_agg(p.lucky_number order by p.lucky_number) into v_pool
    from public.participants p
   where p.status = 'valido'
     and (v_allow or not exists (select 1 from public.draws d where d.participant_id = p.id and d.status = 'valido'))
     and not exists (select 1 from public.draws d where d.participant_id = p.id and d.prize_id = p_prize_id and d.status = 'anulado');

  v_n := coalesce(array_length(v_pool, 1), 0);
  if v_n = 0 then
    raise exception 'Nenhum número válido disponível para este sorteio';
  end if;

  v_number := v_pool[public.secure_random_int(v_n) + 1];
  select * into v_winner from public.participants where lucky_number = v_number;
  v_hash := encode(extensions.digest(array_to_string(v_pool, ','), 'sha256'), 'hex');

  insert into public.draws (prize_id, round, prize_title, participant_id, lucky_number, winner_name,
                            pool_size, pool_hash, performed_by, performed_by_email)
  values (v_prize.id, v_prize.round, v_prize.title, v_winner.id, v_number, v_winner.full_name,
          v_n, v_hash, v_uid, v_email)
  returning id into v_draw_id;

  perform public.audit('draw_performed', 'draw', v_draw_id::text,
    jsonb_build_object('round', v_prize.round, 'prize', v_prize.title, 'number', public.format_number(v_number),
                       'winner', v_winner.full_name, 'pool_size', v_n, 'pool_hash', v_hash, 'redo', coalesce(p_redo, false)));

  return json_build_object('ok', true, 'draw_id', v_draw_id, 'round', v_prize.round, 'prize', v_prize.title,
    'number', public.format_number(v_number), 'participant_id', v_winner.id, 'name', v_winner.full_name,
    'phone', v_winner.phone, 'email', v_winner.email, 'pool_size', v_n, 'pool_hash', v_hash,
    'created_at', now());
end $$;

-- ---------------------------------------------------------------------
-- Auditoria automática de configurações e prêmios
-- ---------------------------------------------------------------------
create or replace function public.trg_audit_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'settings' then
    new.updated_at := now(); new.updated_by := auth.uid();
  end if;
  perform public.audit(lower(tg_op) || '_' || tg_table_name, tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
    jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                       'new', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists audit_settings on public.settings;
create trigger audit_settings before update on public.settings
  for each row when (old.last_number = new.last_number) execute function public.trg_audit_changes();

drop trigger if exists audit_prizes on public.prizes;
create trigger audit_prizes after insert or update or delete on public.prizes
  for each row execute function public.trg_audit_changes();

-- ---------------------------------------------------------------------
-- View para o painel (RLS do chamador continua valendo)
-- ---------------------------------------------------------------------
create or replace view public.participants_admin with (security_invoker = true) as
select p.id, p.full_name, p.phone, p.email, p.lucky_number, public.format_number(p.lucky_number) as number,
       p.status, p.status_reason, p.status_changed_at, p.privacy_consent, p.privacy_consent_at,
       p.whatsapp_consent, p.whatsapp_consent_at, p.created_at,
       n.status as whatsapp_status, n.channel as whatsapp_channel, n.updated_at as whatsapp_updated_at, n.error as whatsapp_error,
       exists (select 1 from public.draws d where d.participant_id = p.id and d.status = 'valido') as is_winner
  from public.participants p
  left join lateral (
    select status, channel, updated_at, error from public.notifications
     where participant_id = p.id order by created_at desc limit 1) n on true;

-- ---------------------------------------------------------------------
-- RLS — dados pessoais visíveis somente para administradores
-- ---------------------------------------------------------------------
alter table public.admins        enable row level security;
alter table public.settings      enable row level security;
alter table public.prizes        enable row level security;
alter table public.participants  enable row level security;
alter table public.draws         enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log     enable row level security;
alter table public.rate_limits   enable row level security;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists settings_admin_read on public.settings;
create policy settings_admin_read on public.settings for select to authenticated using (public.is_admin());
drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_update on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists prizes_admin_all on public.prizes;
create policy prizes_admin_all on public.prizes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists participants_admin_read on public.participants;
create policy participants_admin_read on public.participants for select to authenticated using (public.is_admin());

drop policy if exists draws_admin_read on public.draws;
create policy draws_admin_read on public.draws for select to authenticated using (public.is_admin());

drop policy if exists notifications_admin_read on public.notifications;
create policy notifications_admin_read on public.notifications for select to authenticated using (public.is_admin());

drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
-- rate_limits: sem políticas (somente service_role)

-- ---------------------------------------------------------------------
-- Permissões (defesa em profundidade)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on public.participants_admin from anon;
revoke insert, update, delete on public.participants, public.draws, public.notifications, public.audit_log, public.rate_limits, public.admins from authenticated;
revoke update on public.settings from authenticated;
grant select on public.settings, public.prizes, public.participants, public.draws, public.notifications, public.audit_log, public.admins to authenticated;
grant select on public.participants_admin to authenticated;
grant update (event_name, raffle_name, raffle_description, event_date, registrations_open,
              max_participants, allow_same_winner, rules_text) on public.settings to authenticated;
grant insert, update, delete on public.prizes to authenticated;

revoke all on function public.register_participant(text, text, text, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.audit(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.secure_random_int(int) from public, anon, authenticated;
grant execute on function public.register_participant(text, text, text, boolean, text, text, text) to service_role;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

revoke all on function public.perform_draw(uuid, boolean, text) from public, anon;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.admin_set_participant_status(uuid, public.participant_status, text) from public, anon;
revoke all on function public.admin_mark_manual_whatsapp(uuid) from public, anon;
grant execute on function public.perform_draw(uuid, boolean, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_set_participant_status(uuid, public.participant_status, text) to authenticated;
grant execute on function public.admin_mark_manual_whatsapp(uuid) to authenticated;

grant execute on function public.get_public_config() to anon, authenticated;
