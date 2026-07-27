-- ============================================================================
-- Forja — Liga de amigos. Cole isto no SQL Editor do seu projeto Supabase.
--
-- Desenho: o app continua local-first. O Supabase guarda SÓ o que precisa ser
-- comparado entre pessoas — apelido, check-in e pontos. Peso, medidas, dieta e
-- histórico de treino nunca saem do celular.
--
-- Sem senha e sem e-mail: cada participante é um id anônimo gerado no
-- dispositivo. É o suficiente para um ranking entre amigos e evita virar
-- responsável por guardar credencial de ninguém.
-- ============================================================================

create table if not exists ligas (
  id          text primary key,           -- código curto que se compartilha
  nome        text not null,
  criada_em   timestamptz not null default now(),
  -- Temporada: ranking que zera dá motivo para voltar. Sem isso quem entra
  -- depois nunca alcança e desiste na primeira semana.
  inicio      date not null default current_date,
  fim         date,
  meta_semanal int not null default 3
);

create table if not exists membros (
  id        uuid primary key,             -- gerado no dispositivo
  liga_id   text not null references ligas(id) on delete cascade,
  apelido   text not null,
  emoji     text not null default '💪',
  entrou_em timestamptz not null default now(),
  unique (liga_id, apelido)
);

create table if not exists checkins (
  id         bigserial primary key,
  membro_id  uuid not null references membros(id) on delete cascade,
  liga_id    text not null references ligas(id) on delete cascade,
  data       date not null,
  tipo       text not null,               -- treino | cardio | mobilidade
  duracao_min int,
  volume_kg  numeric,
  pontos     int not null default 0,
  criado_em  timestamptz not null default now(),
  -- Um check-in por tipo por dia: evita farmar ranking abrindo o app dez vezes.
  unique (membro_id, data, tipo)
);

create index if not exists ix_checkins_liga_data on checkins (liga_id, data desc);

-- ── Segurança ───────────────────────────────────────────────────────────────
-- A chave anônima é pública por natureza (vai dentro do app). Quem protege é a
-- RLS. Regra: qualquer um lê a liga em que está, e só escreve como ele mesmo.

alter table ligas    enable row level security;
alter table membros  enable row level security;
alter table checkins enable row level security;

-- Liga é descoberta pelo código; quem tem o código pode ver e entrar.
create policy "ler liga"    on ligas    for select using (true);
create policy "criar liga"  on ligas    for insert with check (true);

create policy "ler membros"   on membros for select using (true);
create policy "entrar"        on membros for insert with check (true);
create policy "editar-se"     on membros for update using (true);

create policy "ler checkins"  on checkins for select using (true);
create policy "gravar checkin" on checkins for insert with check (true);

-- ── Ranking ─────────────────────────────────────────────────────────────────
create or replace function ranking(p_liga text, p_desde date)
returns table (
  membro_id uuid,
  apelido   text,
  emoji     text,
  checkins  bigint,
  pontos    bigint,
  ultimo    date
)
language sql stable as $$
  select m.id, m.apelido, m.emoji,
         count(c.id)               as checkins,
         coalesce(sum(c.pontos),0) as pontos,
         max(c.data)               as ultimo
    from membros m
    left join checkins c
      on c.membro_id = m.id and c.data >= p_desde
   where m.liga_id = p_liga
   group by m.id, m.apelido, m.emoji
   order by pontos desc, checkins desc, m.entrou_em asc;
$$;
