import { emMinutos, estimarDuracao } from './duracao';
import { all, first, run } from '@/db/client';
import type {
  Exercise,
  PersonalRecord,
  Routine,
  RoutineDay,
  RoutineExerciseFull,
  SetLog,
  TipoPR,
  WorkoutSession,
} from '@/db/types';
import { e1rm } from '../perfil/calculos';
import { darPontos, registrarAtividade } from '../gamificacao/api';
import { descansoCorreto, ehComposto, prioridadeDe, substitutosDe } from './classificacao';

// ─────────────────────────── CATÁLOGO ───────────────────────────

export async function listarExercicios(filtro?: {
  grupo?: string;
  busca?: string;
}): Promise<Exercise[]> {
  const cond: string[] = [];
  const p: (string | number)[] = [];

  if (filtro?.grupo && filtro.grupo !== 'todos') {
    cond.push('grupo_primario = ?');
    p.push(filtro.grupo);
  }
  if (filtro?.busca?.trim()) {
    cond.push('nome LIKE ?');
    p.push(`%${filtro.busca.trim()}%`);
  }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  return all<Exercise>(
    `SELECT * FROM exercises ${where} ORDER BY favorito DESC, nome COLLATE NOCASE`,
    p
  );
}

export async function getExercicio(id: number): Promise<Exercise | null> {
  return first<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
}

export async function alternarFavorito(id: number) {
  await run('UPDATE exercises SET favorito = 1 - favorito WHERE id = ?', [id]);
}

export async function criarExercicio(e: {
  nome: string;
  grupo_primario: string;
  equipamento: string;
  tipo_carga: string;
}): Promise<number> {
  return run(
    `INSERT INTO exercises (nome, grupo_primario, equipamento, tipo_carga, is_custom)
     VALUES (?,?,?,?,1)`,
    [e.nome, e.grupo_primario, e.equipamento, e.tipo_carga]
  );
}

// ─────────────────────────── ROTINAS ───────────────────────────

export interface DiaComResumo extends RoutineDay {
  qtd_exercicios: number;
  rotina: string;
  ultima_vez: number | null;
}

export async function listarDias(): Promise<DiaComResumo[]> {
  return all<DiaComResumo>(`
    SELECT rd.*,
           r.nome AS rotina,
           (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_day_id = rd.id)
             AS qtd_exercicios,
           (SELECT MAX(ws.iniciado_em) FROM workout_sessions ws
             WHERE ws.routine_day_id = rd.id AND ws.finalizado_em IS NOT NULL)
             AS ultima_vez
      FROM routine_days rd
      JOIN routines r ON r.id = rd.routine_id
     WHERE r.ativa = 1
     ORDER BY r.id, rd.ordem
  `);
}

/**
 * Os dias com o que a tela de treino precisa mostrar de uma vez: dia da semana,
 * quantos exercícios, quanto tempo leva e quando foi a última vez.
 *
 * Uma consulta só para os exercícios de todos os dias, em vez de uma por dia:
 * a tela abre com 4 a 6 treinos, e 6 idas ao banco para montar uma lista é o
 * tipo de coisa que faz o app parecer lento sem motivo.
 */
export async function diasComTempo(): Promise<(DiaComResumo & { minutos: number })[]> {
  const dias = await listarDias();
  if (!dias.length) return [];

  const marcas = dias.map(() => '?').join(',');
  const exs = await all<{
    routine_day_id: number;
    nome: string;
    grupo_primario: string;
    series_alvo: number;
    reps_min: number | null;
    reps_max: number | null;
    descanso_seg: number;
    tipo_carga: string;
  }>(
    `SELECT re.routine_day_id, e.nome, e.grupo_primario, re.series_alvo,
            re.reps_min, re.reps_max, re.descanso_seg, e.tipo_carga
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_day_id IN (${marcas})`,
    dias.map((d) => d.id)
  );

  const porDia = new Map<number, typeof exs>();
  for (const e of exs) {
    if (!porDia.has(e.routine_day_id)) porDia.set(e.routine_day_id, []);
    porDia.get(e.routine_day_id)!.push(e);
  }

  return dias.map((d) => ({
    ...d,
    minutos: emMinutos(estimarDuracao((porDia.get(d.id) ?? []) as never).totalSeg),
  }));
}

export async function getDia(id: number): Promise<DiaComResumo | null> {
  const rows = await listarDias();
  return rows.find((d) => d.id === id) ?? null;
}

export async function exerciciosDoDia(diaId: number): Promise<RoutineExerciseFull[]> {
  return all<RoutineExerciseFull>(
    `SELECT re.*, e.nome, e.grupo_primario, e.equipamento, e.tipo_carga,
            e.media_url, e.instrucoes, e.dica
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_day_id = ?
      ORDER BY re.ordem`,
    [diaId]
  );
}

/** A rotina em uso. `criado_em` é a data de início do bloco de treino. */
export async function rotinaAtiva(): Promise<Routine | null> {
  return first<Routine>('SELECT * FROM routines WHERE ativa = 1 ORDER BY criado_em DESC LIMIT 1');
}

export async function criarRotina(nome: string, descricao?: string): Promise<number> {
  return run('INSERT INTO routines (nome, descricao, criado_em) VALUES (?,?,?)', [
    nome,
    descricao ?? null,
    Date.now(),
  ]);
}

export async function criarDia(routineId: number, nome: string, cor: string): Promise<number> {
  const r = await first<{ n: number }>(
    'SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM routine_days WHERE routine_id = ?',
    [routineId]
  );
  return run('INSERT INTO routine_days (routine_id, nome, cor, ordem) VALUES (?,?,?,?)', [
    routineId,
    nome,
    cor,
    r?.n ?? 0,
  ]);
}

export async function addExercicioNoDia(
  diaId: number,
  exercicioId: number,
  cfg?: { series?: number; repsMin?: number; repsMax?: number; descanso?: number }
) {
  const r = await first<{ n: number }>(
    'SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM routine_exercises WHERE routine_day_id = ?',
    [diaId]
  );
  await run(
    `INSERT INTO routine_exercises
       (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg)
     VALUES (?,?,?,?,?,?,?)`,
    [
      diaId,
      exercicioId,
      r?.n ?? 0,
      cfg?.series ?? 3,
      cfg?.repsMin ?? 8,
      cfg?.repsMax ?? 12,
      cfg?.descanso ?? 90,
    ]
  );
}

export async function removerExercicioDoDia(routineExerciseId: number) {
  await run('DELETE FROM routine_exercises WHERE id = ?', [routineExerciseId]);
}

export async function atualizarExercicioDoDia(
  id: number,
  cfg: { series_alvo: number; reps_min: number; reps_max: number; descanso_seg: number }
) {
  await run(
    `UPDATE routine_exercises
        SET series_alvo = ?, reps_min = ?, reps_max = ?, descanso_seg = ?
      WHERE id = ?`,
    [cfg.series_alvo, cfg.reps_min, cfg.reps_max, cfg.descanso_seg, id]
  );
}

export async function excluirDia(id: number) {
  await run('DELETE FROM routine_days WHERE id = ?', [id]);
}

/**
 * Troca um exercício por outro no meio do treino.
 *
 * Aparelho ocupado é o motivo nº 1 de treino furado. A troca vale só para a
 * sessão de hoje — a rotina continua como está, porque amanhã o aparelho pode
 * estar livre.
 */
export async function substituirExercicio(
  routineExerciseId: number,
  novoExercicioId: number,
  sessionId: number | null,
  motivo: string
): Promise<void> {
  const atual = await first<{ exercise_id: number; reps_max: number | null }>(
    'SELECT exercise_id, reps_max FROM routine_exercises WHERE id = ?',
    [routineExerciseId]
  );
  if (!atual) return;

  const novo = await first<{ nome: string; grupo_primario: string }>(
    'SELECT nome, grupo_primario FROM exercises WHERE id = ?',
    [novoExercicioId]
  );

  await run(
    `INSERT INTO substituicoes (session_id, de_exercise, para_exercise, motivo, criado_em)
     VALUES (?,?,?,?,?)`,
    [sessionId, atual.exercise_id, novoExercicioId, motivo, Date.now()]
  );

  // Descanso acompanha o exercício novo: trocar composto por isolador (ou o
  // contrário) muda o intervalo correto.
  const descanso = novo
    ? descansoCorreto(novo.nome, atual.reps_max ?? 10, novo.grupo_primario)
    : null;

  await run(
    `UPDATE routine_exercises
        SET exercise_id = ?, eh_composto = ?, descanso_seg = COALESCE(?, descanso_seg)
      WHERE id = ?`,
    [novoExercicioId, novo && ehComposto(novo.nome) ? 1 : 0, descanso, routineExerciseId]
  );
}

/**
 * Reordena o dia pela prioridade de cada exercício.
 *
 * Composto pesado primeiro, cardio por último. Não roda sozinho: pode haver
 * motivo que o app não conhece (aparelho, lesão, preferência), então a
 * reordenação é sempre uma escolha da pessoa.
 */
export async function reordenarPorPrioridade(diaId: number) {
  const exs = await exerciciosDoDia(diaId);
  const ordenados = [...exs].sort((a, b) => {
    const pa = prioridadeDe(a.nome, a.grupo_primario);
    const pb = prioridadeDe(b.nome, b.grupo_primario);
    return pa - pb || a.ordem - b.ordem; // empate mantém a ordem original
  });
  for (let i = 0; i < ordenados.length; i++) {
    await run('UPDATE routine_exercises SET ordem = ? WHERE id = ?', [i, ordenados[i].id]);
  }
}

/** Substitutos do exercício, já resolvidos para ids do catálogo local. */
export async function substitutosDisponiveis(exercicioId: number): Promise<Exercise[]> {
  const ex = await getExercicio(exercicioId);
  if (!ex) return [];

  const nomes = substitutosDe(ex.nome);
  const out: Exercise[] = [];

  for (const nome of nomes) {
    const e = await first<Exercise>('SELECT * FROM exercises WHERE nome = ?', [nome]);
    if (e) out.push(e);
  }

  // Sem mapeamento próprio, cai para o mesmo grupo muscular e equipamento
  // parecido — melhor que devolver lista vazia no meio do treino.
  if (out.length === 0) {
    return all<Exercise>(
      `SELECT * FROM exercises
        WHERE grupo_primario = ? AND id <> ?
        ORDER BY (equipamento = ?) DESC, nome
        LIMIT 6`,
      [ex.grupo_primario, exercicioId, ex.equipamento ?? '']
    );
  }
  return out;
}

// ─────────────────────────── SESSÃO ───────────────────────────

export async function sessaoAberta(): Promise<WorkoutSession | null> {
  return first<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE finalizado_em IS NULL ORDER BY iniciado_em DESC LIMIT 1'
  );
}

export interface CheckIn {
  local?: string;
  energia?: number;
  semanaPlano?: number;
}

/**
 * Abre a sessão com o check-in.
 *
 * Energia e local custam um toque e explicam muito depois: treino ruim quase
 * sempre tem causa, e sem registrar o estado de chegada não dá para cruzar
 * queda de desempenho com sono, comida ou intervalo curto entre sessões.
 */
export async function iniciarSessao(
  diaId: number | null,
  nome: string,
  check: CheckIn = {}
): Promise<number> {
  return run(
    `INSERT INTO workout_sessions
       (routine_day_id, nome, iniciado_em, local, energia_inicial, semana_plano)
     VALUES (?,?,?,?,?,?)`,
    [diaId, nome, Date.now(), check.local ?? null, check.energia ?? null, check.semanaPlano ?? null]
  );
}

export async function getSessao(id: number): Promise<WorkoutSession | null> {
  return first<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ?', [id]);
}

export async function seriesDaSessao(sessionId: number): Promise<SetLog[]> {
  return all<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? ORDER BY ordem_exercicio, serie_index',
    [sessionId]
  );
}

/**
 * Registra uma série e devolve os recordes que ela quebrou.
 *
 * A detecção roda aqui, no momento do insert, e não numa varredura posterior:
 * o feedback precisa aparecer enquanto a pessoa ainda está com o halter na
 * mão — meia hora depois já não motiva ninguém.
 */
export async function registrarSerie(s: {
  sessionId: number;
  exerciseId: number;
  ordemExercicio: number;
  serieIndex: number;
  pesoKg: number | null;
  reps: number | null;
  duracaoSeg?: number | null;
  tipo?: string;
}): Promise<PersonalRecord[]> {
  const setId = await run(
    `INSERT INTO set_logs
       (session_id, exercise_id, ordem_exercicio, serie_index, peso_kg, reps,
        duracao_seg, tipo, concluida, registrado_em)
     VALUES (?,?,?,?,?,?,?,?,1,?)`,
    [
      s.sessionId,
      s.exerciseId,
      s.ordemExercicio,
      s.serieIndex,
      s.pesoKg,
      s.reps,
      s.duracaoSeg ?? null,
      s.tipo ?? 'normal',
      Date.now(),
    ]
  );

  await recalcularVolume(s.sessionId);

  if (s.tipo === 'aquecimento' || !s.pesoKg || !s.reps) return [];
  return detectarPRs(setId, s);
}

/**
 * Corrige uma série que já foi gravada.
 *
 * Existe porque errar a digitação no meio do treino é comum, e sem isto o
 * valor errado ficava no banco para sempre: a tela mostrava o número corrigido
 * enquanto o histórico — e os recordes derivados dele — guardavam o errado.
 * Um "80" digitado como "8080" viraria recorde permanente e travaria todo PR
 * seguinte daquele exercício.
 */
export async function atualizarSerie(s: {
  setLogId: number;
  sessionId: number;
  exerciseId: number;
  pesoKg: number | null;
  reps: number | null;
}): Promise<PersonalRecord[]> {
  await run('UPDATE set_logs SET peso_kg = ?, reps = ? WHERE id = ?', [
    s.pesoKg,
    s.reps,
    s.setLogId,
  ]);

  // Os recordes que nasceram desta série não valem mais.
  await run('DELETE FROM personal_records WHERE set_log_id = ?', [s.setLogId]);
  await recalcularVolume(s.sessionId);

  if (!s.pesoKg || !s.reps) return [];
  return detectarPRs(s.setLogId, s);
}

export async function desfazerSerie(setLogId: number, sessionId: number) {
  await run('DELETE FROM personal_records WHERE set_log_id = ?', [setLogId]);
  await run('DELETE FROM set_logs WHERE id = ?', [setLogId]);
  await recalcularVolume(sessionId);
}

async function recalcularVolume(sessionId: number) {
  const r = await first<{ v: number }>(
    `SELECT COALESCE(SUM(peso_kg * reps), 0) AS v
       FROM set_logs
      WHERE session_id = ? AND concluida = 1 AND tipo <> 'aquecimento'`,
    [sessionId]
  );
  await run('UPDATE workout_sessions SET volume_total_kg = ? WHERE id = ?', [
    r?.v ?? 0,
    sessionId,
  ]);
}

async function melhorPR(exerciseId: number, tipo: TipoPR): Promise<number | null> {
  const r = await first<{ v: number }>(
    'SELECT MAX(valor) AS v FROM personal_records WHERE exercise_id = ? AND tipo = ?',
    [exerciseId, tipo]
  );
  return r?.v ?? null;
}

async function detectarPRs(
  setId: number,
  s: { sessionId: number; exerciseId: number; pesoKg: number | null; reps: number | null }
): Promise<PersonalRecord[]> {
  const peso = s.pesoKg!;
  const reps = s.reps!;
  const novos: PersonalRecord[] = [];

  const candidatos: { tipo: TipoPR; valor: number }[] = [
    { tipo: 'e1rm', valor: e1rm(peso, reps) },
    { tipo: 'carga_max', valor: peso },
    { tipo: 'volume_serie', valor: peso * reps },
  ];

  for (const c of candidatos) {
    const anterior = await melhorPR(s.exerciseId, c.tipo);
    // Sem histórico ainda não é recorde — é só a primeira medição.
    if (anterior === null) {
      await run(
        `INSERT INTO personal_records
           (exercise_id, tipo, valor, valor_anterior, peso_kg, reps, set_log_id, session_id, atingido_em, celebrado)
         VALUES (?,?,?,NULL,?,?,?,?,?,1)`,
        [s.exerciseId, c.tipo, c.valor, peso, reps, setId, s.sessionId, Date.now()]
      );
      continue;
    }

    if (c.valor > anterior) {
      const id = await run(
        `INSERT INTO personal_records
           (exercise_id, tipo, valor, valor_anterior, peso_kg, reps, set_log_id, session_id, atingido_em)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [s.exerciseId, c.tipo, c.valor, anterior, peso, reps, setId, s.sessionId, Date.now()]
      );
      await darPontos(50, 'pr', id, 'Recorde pessoal');
      const pr = await first<PersonalRecord>('SELECT * FROM personal_records WHERE id = ?', [id]);
      // Só e1RM e carga máxima viram comemoração: celebrar os três de uma vez
      // transforma recorde em ruído.
      if (pr && (c.tipo === 'e1rm' || c.tipo === 'carga_max')) novos.push(pr);
    }
  }

  return novos;
}

export async function finalizarSessao(sessionId: number, sensacao?: number, notas?: string) {
  const series = await first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM set_logs WHERE session_id = ? AND concluida = 1',
    [sessionId]
  );

  // Sessão sem nenhuma série não conta como treino — nem grava, nem pontua.
  if ((series?.n ?? 0) === 0) {
    await run('DELETE FROM workout_sessions WHERE id = ?', [sessionId]);
    return { valida: false, xp: 0, streak: 0 };
  }

  await run(
    'UPDATE workout_sessions SET finalizado_em = ?, sensacao = ?, notas = ? WHERE id = ?',
    [Date.now(), sensacao ?? null, notas ?? null, sessionId]
  );

  const s = await getSessao(sessionId);
  const dur = s ? (s.finalizado_em! - s.iniciado_em) / 60000 : 0;
  // Base + bônus por volume, com teto para uma sessão maratona não distorcer.
  const xp = Math.round(60 + Math.min(90, (s?.volume_total_kg ?? 0) / 120) + Math.min(30, dur / 3));

  await darPontos(xp, 'treino', sessionId, s?.nome);
  const { streak } = await registrarAtividade();

  return { valida: true, xp, streak };
}

export async function cancelarSessao(sessionId: number) {
  await run('DELETE FROM workout_sessions WHERE id = ?', [sessionId]);
}

// ─────────────────────────── HISTÓRICO ───────────────────────────

export interface SerieAnterior {
  serie_index: number;
  peso_kg: number | null;
  reps: number | null;
  registrado_em: number;
}

/**
 * Séries do último treino deste exercício.
 *
 * Alimenta o placeholder cinza na tela de execução — a feature de progressão
 * de carga inteira resumida num gesto: você vê o que fez, toca, e supera.
 */
export async function ultimaExecucao(
  exerciseId: number,
  sessaoAtual?: number
): Promise<SerieAnterior[]> {
  const s = await first<{ session_id: number }>(
    `SELECT session_id FROM set_logs
      WHERE exercise_id = ? AND concluida = 1 AND session_id <> ?
      ORDER BY registrado_em DESC LIMIT 1`,
    [exerciseId, sessaoAtual ?? -1]
  );
  if (!s) return [];

  return all<SerieAnterior>(
    `SELECT serie_index, peso_kg, reps, registrado_em
       FROM set_logs
      WHERE session_id = ? AND exercise_id = ? AND tipo <> 'aquecimento'
      ORDER BY serie_index`,
    [s.session_id, exerciseId]
  );
}

export async function prsDoExercicio(exerciseId: number) {
  return all<PersonalRecord & { tipo: TipoPR }>(
    `SELECT * FROM personal_records p
      WHERE p.exercise_id = ?
        AND p.valor = (SELECT MAX(valor) FROM personal_records
                        WHERE exercise_id = p.exercise_id AND tipo = p.tipo)
      GROUP BY p.tipo`,
    [exerciseId]
  );
}

export async function evolucaoExercicio(exerciseId: number, limite = 20) {
  const rows = await all<{ dia: string; e1rm: number; volume: number }>(
    `SELECT date(registrado_em/1000, 'unixepoch', 'localtime') AS dia,
            MAX(peso_kg * (1 + reps / 30.0))                   AS e1rm,
            SUM(peso_kg * reps)                                AS volume
       FROM set_logs
      WHERE exercise_id = ? AND concluida = 1 AND tipo <> 'aquecimento'
        AND peso_kg IS NOT NULL AND reps IS NOT NULL
      GROUP BY dia
      ORDER BY dia DESC
      LIMIT ?`,
    [exerciseId, limite]
  );
  return rows.reverse();
}

export interface SessaoResumo extends WorkoutSession {
  qtd_series: number;
  qtd_prs: number;
}

export async function historicoSessoes(limite = 30): Promise<SessaoResumo[]> {
  return all<SessaoResumo>(
    `SELECT ws.*,
            (SELECT COUNT(*) FROM set_logs sl WHERE sl.session_id = ws.id) AS qtd_series,
            (SELECT COUNT(*) FROM personal_records pr WHERE pr.session_id = ws.id) AS qtd_prs
       FROM workout_sessions ws
      WHERE ws.finalizado_em IS NOT NULL
      ORDER BY ws.iniciado_em DESC
      LIMIT ?`,
    [limite]
  );
}

export async function estatisticas() {
  const r = await first<{
    treinos: number;
    volume: number;
    series: number;
    prs: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM workout_sessions WHERE finalizado_em IS NOT NULL) AS treinos,
      (SELECT COALESCE(SUM(volume_total_kg),0) FROM workout_sessions)         AS volume,
      (SELECT COUNT(*) FROM set_logs WHERE concluida = 1)                     AS series,
      (SELECT COUNT(*) FROM personal_records WHERE valor_anterior IS NOT NULL) AS prs
  `);
  return r ?? { treinos: 0, volume: 0, series: 0, prs: 0 };
}

/** Volume por grupo muscular nos últimos N dias — mostra o que anda esquecido. */
export async function volumePorGrupo(dias = 30) {
  return all<{ grupo: string; volume: number; series: number }>(
    `SELECT e.grupo_primario AS grupo,
            COALESCE(SUM(sl.peso_kg * sl.reps), 0) AS volume,
            COUNT(*) AS series
       FROM set_logs sl
       JOIN exercises e ON e.id = sl.exercise_id
      WHERE sl.concluida = 1 AND sl.tipo <> 'aquecimento'
        AND sl.registrado_em >= ?
      GROUP BY e.grupo_primario
      ORDER BY volume DESC`,
    [Date.now() - dias * 86400000]
  );
}

/** Treinos por dia nos últimos N dias — alimenta o heatmap de constância. */
export async function treinosPorDia(dias = 28) {
  return all<{ dia: string; qtd: number; volume: number }>(
    `SELECT date(iniciado_em/1000, 'unixepoch', 'localtime') AS dia,
            COUNT(*) AS qtd,
            COALESCE(SUM(volume_total_kg),0) AS volume
       FROM workout_sessions
      WHERE finalizado_em IS NOT NULL AND iniciado_em >= ?
      GROUP BY dia
      ORDER BY dia`,
    [Date.now() - dias * 86400000]
  );
}

export async function prsRecentes(limite = 10) {
  return all<PersonalRecord & { exercicio: string }>(
    `SELECT pr.*, e.nome AS exercicio
       FROM personal_records pr
       JOIN exercises e ON e.id = pr.exercise_id
      WHERE pr.valor_anterior IS NOT NULL
      ORDER BY pr.atingido_em DESC
      LIMIT ?`,
    [limite]
  );
}

// ─────────────────────────── NOTAS DE SETUP ───────────────────────────

/**
 * "Banco no furo 3", "pino 7", "pegada na marca de fora".
 *
 * É o que o personal anota no papel e o que se perde toda vez que a pessoa
 * volta de férias ou troca de academia. Sem isso a primeira série sai errada —
 * ou, pior, sai numa altura que machuca o ombro.
 */
export async function getNota(exerciseId: number): Promise<string> {
  const r = await first<{ nota: string }>(
    'SELECT nota FROM notas_exercicio WHERE exercise_id = ?',
    [exerciseId]
  );
  return r?.nota ?? '';
}

export async function salvarNota(exerciseId: number, nota: string) {
  if (!nota.trim()) {
    await run('DELETE FROM notas_exercicio WHERE exercise_id = ?', [exerciseId]);
    return;
  }
  await run(
    `INSERT INTO notas_exercicio (exercise_id, nota, atualizado_em) VALUES (?,?,?)
     ON CONFLICT(exercise_id) DO UPDATE SET nota = excluded.nota, atualizado_em = excluded.atualizado_em`,
    [exerciseId, nota.trim(), Date.now()]
  );
}

/** Todas as notas de uma vez — a sessão carrega junto com os exercícios. */
export async function notasDoDia(exerciseIds: number[]): Promise<Record<number, string>> {
  if (!exerciseIds.length) return {};
  const marcas = exerciseIds.map(() => '?').join(',');
  const rows = await all<{ exercise_id: number; nota: string }>(
    `SELECT exercise_id, nota FROM notas_exercicio WHERE exercise_id IN (${marcas})`,
    exerciseIds
  );
  return Object.fromEntries(rows.map((r) => [r.exercise_id, r.nota]));
}

// ─────────────────────────── RECOMEÇAR ───────────────────────────

/**
 * Apaga rotinas e histórico de treino, preservando o resto.
 *
 * Existe porque montar treino é a parte do app onde mais se experimenta: cria
 * um dia, cria outro, testa uma divisão, e em duas semanas há oito treinos e
 * nenhum critério. Recomeçar não pode exigir apagar 20 registros na mão.
 *
 * O que NÃO some: perfil, peso, medidas, bioimpedância, água, dieta e
 * conquistas. Isso é histórico de corpo, não de rotina — e quem quer refazer o
 * treino raramente quer perder de onde partiu.
 */
export async function recomecarTreino(): Promise<void> {
  await run('DELETE FROM set_logs');
  await run('DELETE FROM personal_records');
  await run('DELETE FROM workout_sessions');
  await run('DELETE FROM substituicoes');
  await run('DELETE FROM routine_exercises');
  await run('DELETE FROM routine_days');
  await run('DELETE FROM routines');
  await run('DELETE FROM notas_exercicio');
}

/** O que será perdido — a tela precisa dizer antes, não depois. */
export async function oQueSeraApagado(): Promise<{
  rotinas: number;
  dias: number;
  sessoes: number;
  series: number;
  recordes: number;
}> {
  const n = async (t: string) => (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))?.n ?? 0;
  return {
    rotinas: await n('routines'),
    dias: await n('routine_days'),
    sessoes: await n('workout_sessions'),
    series: await n('set_logs'),
    recordes: await n('personal_records'),
  };
}
