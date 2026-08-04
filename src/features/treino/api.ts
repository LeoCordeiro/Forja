import { emMinutos, estimarDuracao } from './duracao';
import { all, first, run, tx } from '@/db/client';
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
import { getPerfil } from '../perfil/api';
import { darPontos, registrarAtividade } from '../gamificacao/api';
import { ehComposto, prioridadeDe, substitutosDe } from './classificacao';
import { descansoCorreto, prescricaoDaRotina, type Papel } from './papel';
import { filtrarSubstitutos, type RecusaTroca } from './substituicao';
import { regiaoSugeridaPara } from './contraindicacao';
import { REGIOES_DOR } from '../perfil/diagnostico';
import { resolverFase, type FaseEfetiva } from './fase';
import { quebrasDeAncora, type QuebraDeAncora } from './variacao';
import { isoDe } from '@/shared/utils/date';



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
           -- Cardio fora da conta, igual ao que diasComTempo faz. Divergir fazia
           -- a Home dizer 6 exercícios e a aba Treino dizer 5 no MESMO dia.
           (SELECT COUNT(*) FROM routine_exercises re
              JOIN exercises e2 ON e2.id = re.exercise_id
             WHERE re.routine_day_id = rd.id AND e2.grupo_primario <> 'cardio')
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
export async function diasComTempo(): Promise<
  (DiaComResumo & { minutos: number; minutosCardio: number })[]
> {
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

  return dias.map((d) => {
    const doDia = porDia.get(d.id) ?? [];
    return {
      ...d,
      minutos: emMinutos(estimarDuracao(doDia as never).totalSeg),
      // Os minutos acima são de MUSCULAÇÃO: `estimarDuracao` ignora cardio de
      // propósito, porque o tempo do questionário é o que a pessoa tem para
      // levantar peso. Só que o cardio existe no plano e a tela não o mostrava
      // em número nenhum — a sessão dizia 87 min e ela passava 107 na academia.
      minutosCardio: Math.round(
        doDia
          .filter((e) => e.grupo_primario === 'cardio')
          .reduce((soma, e) => soma + (e.reps_max ?? 0), 0) / 60
      ),
      // O cardio também não é "exercício" na contagem da lista: ele é o que vem
      // DEPOIS do treino, e contá-lo junto faz um dia de 5 exercícios parecer
      // de 6.
      qtd_exercicios: doDia.filter((e) => e.grupo_primario !== 'cardio').length,
    };
  });
}

// ── Treino marcado à mão ──────────────────────────────────────────────────

/**
 * Registrar depois que já treinou, sem ter aberto o app na hora.
 *
 * Academia sem sinal, celular sem bateria, aula de spinning, jogo de futebol —
 * e no dia seguinte o quadradinho da semana está vazio contando uma história
 * errada. Sem isto, a constância que o app mostra é a de usar o app, não a de
 * treinar, e a pessoa perde a sequência por um motivo que não tem nada a ver
 * com treino.
 *
 * A sessão entra com volume zero e marcada como `manual`: conta para
 * frequência, sequência e check-in, e fica de fora de recorde e de volume — ela
 * não tem série registrada, e misturar contaminaria justamente os números que
 * dependem de carga real.
 */
export async function marcarTreinoManual(data: string, nome = 'Treino registrado depois') {
  const jaTem = await treinoDe(data);
  if (jaTem) return jaTem;

  // Meio-dia: a hora não importa e o meio do dia sobrevive a qualquer fuso sem
  // escorregar para o dia vizinho.
  const quando = new Date(`${data}T12:00:00`).getTime();
  return run(
    `INSERT INTO workout_sessions (routine_day_id, nome, iniciado_em, finalizado_em, volume_total_kg, manual)
     VALUES (NULL, ?, ?, ?, 0, 1)`,
    [nome, quando, quando]
  );
}

/** Desfaz a marcação — e só a marcação: sessão com série registrada não sai. */
export async function desmarcarTreinoManual(data: string): Promise<boolean> {
  const inicio = new Date(`${data}T00:00:00`).getTime();
  const fim = inicio + 86400000;
  const r = await first<{ id: number }>(
    `SELECT id FROM workout_sessions
      WHERE manual = 1 AND iniciado_em >= ? AND iniciado_em < ? LIMIT 1`,
    [inicio, fim]
  );
  if (!r) return false;
  await run('DELETE FROM workout_sessions WHERE id = ?', [r.id]);
  return true;
}

/** O treino daquele dia, se houver, e se foi marcado à mão. */
export async function treinoDe(
  data: string
): Promise<{ id: number; nome: string; manual: boolean } | null> {
  const inicio = new Date(`${data}T00:00:00`).getTime();
  const fim = inicio + 86400000;
  const r = await first<{ id: number; nome: string; manual: number }>(
    `SELECT id, nome, manual FROM workout_sessions
      WHERE finalizado_em IS NOT NULL AND iniciado_em >= ? AND iniciado_em < ?
      ORDER BY manual ASC LIMIT 1`,
    [inicio, fim]
  );
  return r ? { id: r.id, nome: r.nome, manual: !!r.manual } : null;
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

/**
 * O exercício de referência de cada grupo numa rotina — B8, sem coluna nova.
 *
 * ── E quem já está com o banco estragado? Ninguém ────────────────────────
 *
 * Esta fase não muda o schema. A âncora do bloco não é gravada em lugar
 * nenhum: ela é DERIVADA de `routine_exercises.papel`, que a v16 já criou e que
 * o backfill de G2.1 já preencheu em toda rotina antiga na primeira abertura do
 * app. Uma coluna `ancora_do_bloco` seria mais rápida de ler e criaria
 * exatamente o problema que `prescricaoDaRotina` teve que consertar depois —
 * um retrato congelado que ninguém invalida quando a composição do dia muda.
 *
 * `MIN(ordem)` é o desempate: o principal aparece uma vez por grupo por dia, e
 * entre dias vale o do dia que vem primeiro — a mesma regra que
 * `ancorasDoPlano` usa do lado do gerador.
 */
export async function ancorasDaRotina(routineId: number): Promise<Record<string, string>> {
  const rows = await all<{ grupo: string; nome: string }>(
    `SELECT e.grupo_primario AS grupo, e.nome AS nome
       FROM routine_exercises re
       JOIN exercises e     ON e.id = re.exercise_id
       JOIN routine_days rd ON rd.id = re.routine_day_id
      WHERE rd.routine_id = ? AND re.papel = 'principal'
      ORDER BY rd.ordem, re.ordem`,
    [routineId]
  );
  const out: Record<string, string> = {};
  for (const r of rows) if (!out[r.grupo]) out[r.grupo] = r.nome;
  return out;
}

/** As âncoras do bloco em curso. Vazio quando não há rotina ativa. */
export async function ancorasDaRotinaAtiva(): Promise<Record<string, string>> {
  const r = await rotinaAtiva();
  return r ? ancorasDaRotina(r.id) : {};
}

/**
 * O que mudou de âncora entre o bloco anterior e o atual — para o GRÁFICO.
 *
 * O plano gerado já devolve `quebras`, mas ele é um objeto de memória: some
 * quando a tela recarrega. A curva de progresso é consultada semanas depois, na
 * tela do exercício, e é lá que a quebra precisa aparecer — senão o app declara
 * a quebra uma vez, no dia da troca, e desenha continuidade para sempre.
 *
 * Reconstruída das rotinas que já estão no banco: a ativa e a última arquivada
 * antes dela. Nada é apagado no app (rotina antiga fica com `ativa = 0`), então
 * o histórico necessário já existe — inclusive para quem trocou de bloco antes
 * desta fase existir.
 */
export async function quebrasDeAncoraSalvas(): Promise<QuebraDeAncora[]> {
  const atual = await rotinaAtiva();
  if (!atual) return [];
  const anterior = await first<Routine>(
    `SELECT * FROM routines
      WHERE id <> ? AND criado_em <= ?
      ORDER BY criado_em DESC, id DESC LIMIT 1`,
    [atual.id, atual.criado_em]
  );
  if (!anterior) return [];
  const [de, para] = await Promise.all([
    ancorasDaRotina(anterior.id),
    ancorasDaRotina(atual.id),
  ]);
  return quebrasDeAncora(de, para);
}

/** A quebra que afeta ESTE exercício — a ponta que sai ou a que entra. */
export async function quebraDoExercicio(
  exerciseId: number
): Promise<{ quebra: QuebraDeAncora; lado: 'antigo' | 'novo' } | null> {
  const ex = await first<{ nome: string }>('SELECT nome FROM exercises WHERE id = ?', [exerciseId]);
  if (!ex) return null;
  for (const q of await quebrasDeAncoraSalvas()) {
    if (q.de === ex.nome) return { quebra: q, lado: 'antigo' };
    if (q.para === ex.nome) return { quebra: q, lado: 'novo' };
  }
  return null;
}

/** A rotina dona do dia — o `criado_em` dela é a âncora da semana do bloco. */
export async function rotinaDoDia(diaId: number): Promise<Routine | null> {
  return first<Routine>(
    `SELECT r.* FROM routines r
      JOIN routine_days rd ON rd.routine_id = r.id
     WHERE rd.id = ?`,
    [diaId]
  );
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
  const novaLinha = await run(
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
  // Acrescentar muda quem é o último do dia — e o finalizador é POSIÇÃO. Sem
  // isto o dia ficava com DOIS finalizadores gravados, e o exercício novo com
  // os 90 s fixos do INSERT em vez do descanso do papel dele.
  //
  // `novas` existe para a linha recém-criada: nela as repetições também vêm do
  // papel, porque o 8-12 do INSERT é um DEFAULT, não uma escolha. Sem isso um
  // finalizador acrescentado à mão saía "3 × 8-12 · RIR 0-1", misturando a
  // faixa de complementar com o esforço de finalizador. Nas linhas que já
  // existiam a repetição não é tocada: ali ela pode ter sido editada, e
  // sobrescrever escolha do usuário é outra coisa.
  await recalcularPapeisDoDia(diaId, cfg?.repsMin == null ? [novaLinha] : []);
}

export async function removerExercicioDoDia(routineExerciseId: number) {
  const linha = await first<{ dia: number }>(
    'SELECT routine_day_id AS dia FROM routine_exercises WHERE id = ?',
    [routineExerciseId]
  );
  await run('DELETE FROM routine_exercises WHERE id = ?', [routineExerciseId]);
  if (linha) await recalcularPapeisDoDia(linha.dia);
}

/**
 * Refaz papel, RIR e descanso de um dia — o cache invalidado.
 *
 * Papel é propriedade da SESSÃO: quem é o principal do peito depende de quem
 * mais está no dia e em que ordem. Enquanto ele era só derivado na tela, isso
 * se resolvia sozinho a cada render. Desde que `preencherPapeis` passou a
 * gravá-lo, mudar a composição do dia sem recalcular deixa o banco com o
 * retrato de uma sessão que não existe mais — remover a âncora deixava o grupo
 * sem principal, reordenar prendia RIR e descanso na ordem antiga, e
 * acrescentar exercício criava um SEGUNDO finalizador.
 *
 * Chamada por tudo que mexe na composição: remover, acrescentar e reordenar.
 * A substituição de sessão NÃO chama, e isso é a regra nº 1 do projeto: ela
 * vale só para hoje e não toca o template.
 *
 * ── O descanso só SOBE, e isso é a regra que já existia ──────────────────
 *
 * `corrigirDescansos` nunca baixou intervalo — quem configurou 4 minutos de
 * propósito escolheu isso. Aqui vale o mesmo: a linha que VIRA principal ganha
 * os 180 s que o papel novo pede; a que deixa de ser não perde os que já tinha.
 * Errar para mais descanso custa minutos; errar para menos custa carga e
 * repetição nas séries seguintes.
 */
export async function recalcularPapeisDoDia(diaId: number, semearReps: number[] = []) {
  const linhas = await all<{
    id: number;
    nome: string;
    grupo: string;
    equipamento: string | null;
    tipoCarga: string | null;
    descanso_seg: number;
  }>(
    `SELECT re.id, e.nome, e.grupo_primario AS grupo, e.equipamento,
            e.tipo_carga AS tipoCarga, re.descanso_seg
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_day_id = ?
      ORDER BY re.ordem, re.id`,
    [diaId]
  );
  if (!linhas.length) return;

  const prescrito = prescricaoDaRotina(linhas);
  for (const l of linhas) {
    const p = prescrito.get(l.id);
    // Cardio não tem papel, e inventar um seria mentir num campo.
    if (!p) continue;
    await run(
      `UPDATE routine_exercises
          SET papel = ?, rir_min = ?, rir_max = ?, descanso_seg = ?
        WHERE id = ?`,
      [p.papel, p.rir?.[0] ?? null, p.rir?.[1] ?? null, Math.max(l.descanso_seg, p.descansoSeg), l.id]
    );
    if (semearReps.includes(l.id)) {
      await run('UPDATE routine_exercises SET reps_min = ?, reps_max = ? WHERE id = ?', [
        p.reps[0],
        p.reps[1],
        l.id,
      ]);
    }
  }
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
 * sessão de hoje — por isso aqui só se grava o log: quem aplica a troca é
 * `exerciciosDaSessao`, em memória. Um UPDATE no template valeria para
 * sempre e reescreveria o plano de todas as próximas sessões.
 */
export async function substituirExercicio(
  routineExerciseId: number,
  novoExercicioId: number,
  sessionId: number | null,
  motivo: string,
  // O exercício que estava na tela (pós-overlay): numa cadeia A→B→C o log da
  // segunda troca deve dizer B→C, não A→C. Sem ele, cai no do template.
  deExerciseId?: number
): Promise<void> {
  const atual = await first<{ exercise_id: number }>(
    'SELECT exercise_id FROM routine_exercises WHERE id = ?',
    [routineExerciseId]
  );
  if (!atual) return;

  await run(
    `INSERT INTO substituicoes
       (session_id, routine_exercise_id, de_exercise, para_exercise, motivo, criado_em)
     VALUES (?,?,?,?,?,?)`,
    [
      sessionId,
      routineExerciseId,
      deExerciseId ?? atual.exercise_id,
      novoExercicioId,
      motivo,
      Date.now(),
    ]
  );
}

/**
 * Exercícios que a sessão executa de fato: o template do dia com as trocas
 * desta sessão aplicadas por cima, em memória.
 *
 * O executor lê daqui, nunca de `exerciciosDoDia` — é o que permite a troca
 * valer só para hoje sem tocar o template. As trocas entram em ordem
 * cronológica, então uma cadeia A→B→C termina em C.
 */
export async function exerciciosDaSessao(sessionId: number): Promise<RoutineExerciseFull[]> {
  const sessao = await getSessao(sessionId);
  if (!sessao?.routine_day_id) return [];
  const lista = await exerciciosDoDia(sessao.routine_day_id);

  const trocas = await all<{
    routine_exercise_id: number | null;
    de_exercise: number | null;
    para_exercise: number | null;
  }>(
    `SELECT routine_exercise_id, de_exercise, para_exercise
       FROM substituicoes
      WHERE session_id = ?
      ORDER BY criado_em, id`,
    [sessionId]
  );

  for (const t of trocas) {
    if (t.para_exercise == null) continue;
    // Alvo pela linha da rotina. Troca de antes dessa coluna existir cai no
    // exercício de origem — e se ele não estiver mais no template (que na
    // época era mutado), não casa com nada, que é o correto.
    const i = lista.findIndex((e) =>
      t.routine_exercise_id != null
        ? e.id === t.routine_exercise_id
        : e.exercise_id === t.de_exercise
    );
    if (i < 0) continue;

    const novo = await getExercicio(t.para_exercise);
    if (!novo) continue;

    lista[i] = {
      ...lista[i],
      exercise_id: novo.id,
      nome: novo.nome,
      grupo_primario: novo.grupo_primario,
      equipamento: novo.equipamento,
      tipo_carga: novo.tipo_carga,
      media_url: novo.media_url,
      instrucoes: novo.instrucoes,
      dica: novo.dica,
      // Classificação e descanso acompanham o exercício efetivo: trocar
      // composto por isolador (ou o contrário) muda o intervalo correto.
      eh_composto: ehComposto(novo.nome) ? 1 : 0,
      // O PAPEL da linha é preservado: quem troca de exercício continua na
      // mesma vaga da sessão, e é a vaga que define principal ou isolador. Sem
      // isso a linha trocada recebia descanso de outra regra e ficava
      // desalinhada do resto de um plano v16.
      descanso_seg: descansoCorreto(
        novo.nome,
        lista[i].reps_max ?? 10,
        novo.grupo_primario,
        (lista[i].papel as Papel | null) ?? undefined,
        novo.equipamento
      ),
    };
  }
  return lista;
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
  // Reordenar TROCA quem abre cada grupo, e papel sai da posição. Sem isto o
  // supino reto voltava para a primeira posição ainda gravado como
  // complementar, com RIR 1-2 e 150 s — o card que oferece a reordenação
  // aparece justamente em rotina de ordem manual, que é a população do backfill.
  await recalcularPapeisDoDia(diaId);
}

/**
 * Substitutos do exercício, já filtrados pela dor e pelo local do perfil.
 *
 * ── Por que o filtro mora AQUI e não na tela ─────────────────────────────
 *
 * Porque a tela não pode esquecer. O gerador gasta o plano inteiro tirando o
 * que a pessoa marcou como doloroso e o que a academia dela não tem; a lista
 * de troca devolvia o mapa `SUBSTITUICOES` cru e desfazia isso em um toque, no
 * pior momento possível — no meio da série, com pressa. Perfil com dor no
 * ombro trocando o desenvolvimento com halteres recebia "Desenvolvimento
 * militar" como PRIMEIRA opção.
 *
 * Quem decide é `filtrarSubstitutos`, que é pura e por isso testável contra o
 * catálogo inteiro × cada dor × cada local. Aqui só se busca o perfil e se
 * resolvem os nomes para linhas do banco.
 *
 * As recusas voltam junto de propósito: opção que some sem explicação parece
 * bug do app.
 */
export interface SubstitutosDaTroca {
  lista: Exercise[];
  recusados: RecusaTroca[];
}

/** Quantas opções a lista mostra. Mais que isso vira rolagem no meio do treino. */
const MAX_SUBSTITUTOS = 6;

export async function substitutosDisponiveis(exercicioId: number): Promise<SubstitutosDaTroca> {
  const ex = await getExercicio(exercicioId);
  if (!ex) return { lista: [], recusados: [] };

  const perfil = await first<{ dores: string | null; local_treino: string }>(
    'SELECT dores, local_treino FROM profile WHERE id = 1'
  );
  const ctx = {
    dores: (perfil?.dores ?? '').split(',').filter(Boolean),
    local: perfil?.local_treino ?? 'academia',
  };

  const candidatos: Exercise[] = [];
  // Mapeados primeiro: são equivalentes escolhidos a dedo, não "outro do mesmo
  // grupo". A ordem sobrevive ao filtro.
  for (const nome of substitutosDe(ex.nome)) {
    const e = await first<Exercise>('SELECT * FROM exercises WHERE nome = ?', [nome]);
    if (e) candidatos.push(e);
  }
  // E o mesmo grupo muscular atrás deles — antes isto só entrava quando o mapa
  // vinha vazio, e com o filtro isso deixaria a pessoa sem opção sempre que os
  // dois ou três mapeados fossem os contraindicados.
  candidatos.push(
    ...(await all<Exercise>(
      `SELECT * FROM exercises
        WHERE grupo_primario = ? AND id <> ?
        ORDER BY (equipamento = ?) DESC, nome`,
      [ex.grupo_primario, exercicioId, ex.equipamento ?? '']
    ))
  );

  const { permitidos, recusados } = filtrarSubstitutos(ex.nome, candidatos, ctx);
  return { lista: permitidos.slice(0, MAX_SUBSTITUTOS), recusados };
}

/**
 * A dor que a pessoa já registrou duas vezes no mesmo exercício.
 *
 * `MOTIVOS_TROCA` tem "Senti dor ou desconforto" desde sempre, o app gravava em
 * `substituicoes.motivo` e **nenhuma linha do repositório lia essa coluna** —
 * não marcava o exercício, não sugeria atualizar o perfil, não mudava o plano
 * da semana seguinte. A pessoa avisava e o app não escutava.
 *
 * Duas vezes, e não uma: aparelho errado, dia ruim e aquecimento curto também
 * produzem uma troca por dor. Concluir "você tem dor no ombro" a partir de um
 * toque é o app concluindo demais.
 */
export async function dorRepetida(
  exercicioId: number
): Promise<{ regiao: string; label: string; vezes: number; exercicio: string } | null> {
  const ex = await getExercicio(exercicioId);
  if (!ex) return null;

  const r = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM substituicoes WHERE de_exercise = ? AND motivo = 'dor'`,
    [exercicioId]
  );
  const vezes = r?.n ?? 0;

  const perfil = await first<{ dores: string | null }>('SELECT dores FROM profile WHERE id = 1');
  const atuais = (perfil?.dores ?? '').split(',').filter(Boolean);

  const regiao = regiaoSugeridaPara(
    { nome: ex.nome, grupo_primario: ex.grupo_primario, equipamento: ex.equipamento, tipo_carga: ex.tipo_carga },
    vezes,
    atuais
  );
  if (!regiao) return null;

  return {
    regiao,
    label: REGIOES_DOR.find((x) => x.chave === regiao)?.label ?? regiao,
    vezes,
    exercicio: ex.nome,
  };
}

/**
 * Acrescenta a região às dores do perfil.
 *
 * Não regenera o plano: isso é decisão de quem treina, e "Refazer meu treino"
 * já existe e arquiva a rotina antiga sem apagar histórico. O que muda na hora
 * é a lista de troca da própria sessão — que passa a esconder o movimento que
 * doeu — e o próximo plano gerado.
 */
export async function adicionarDorNoPerfil(regiao: string): Promise<void> {
  const perfil = await first<{ dores: string | null }>('SELECT dores FROM profile WHERE id = 1');
  const atuais = (perfil?.dores ?? '').split(',').filter(Boolean);
  if (atuais.includes(regiao)) return;
  await run('UPDATE profile SET dores = ? WHERE id = 1', [[...atuais, regiao].join(',')]);
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

/**
 * A fase do plano que vale para ESTA sessão — o que o executor aplica.
 *
 * O "hoje" da resolução é a data em que a sessão começou, não o relógio:
 * treino pausado ontem e retomado hoje não pode mudar de alvo no meio. Pelo
 * mesmo motivo a `semana_plano` gravada no check-in tem prioridade sobre o
 * cálculo pela data. Nada disso escreve no banco — fase é apresentação.
 */
export async function faseDaSessao(sessionId: number): Promise<FaseEfetiva | null> {
  const sessao = await first<{
    iniciado_em: number;
    routine_day_id: number | null;
    semana_plano: number | null;
  }>(
    'SELECT iniciado_em, routine_day_id, semana_plano FROM workout_sessions WHERE id = ?',
    [sessionId]
  );
  if (!sessao) return null;

  const perfil = await getPerfil();

  // Sessão avulsa (sem dia de rotina) não tem bloco — só o ramo do retorno.
  let rotinaCriadaEmIso: string | null = null;
  if (sessao.routine_day_id != null) {
    const rotina = await rotinaDoDia(sessao.routine_day_id);
    if (rotina?.criado_em) rotinaCriadaEmIso = isoDe(new Date(rotina.criado_em));
  }

  return resolverFase({
    retomouEm: perfil?.retomou_em ?? null,
    mesesParado: perfil?.meses_parado ?? 0,
    rotinaCriadaEmIso,
    hojeIso: isoDe(new Date(sessao.iniciado_em)),
    semanaPlanoGravada: sessao.semana_plano,
  });
}

export async function seriesDaSessao(sessionId: number): Promise<SetLog[]> {
  return all<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? ORDER BY ordem_exercicio, serie_index',
    [sessionId]
  );
}

/**
 * Registra uma série e devolve o id gravado e os recordes que ela quebrou.
 *
 * A detecção roda aqui, no momento do insert, e não numa varredura posterior:
 * o feedback precisa aparecer enquanto a pessoa ainda está com o halter na
 * mão — meia hora depois já não motiva ninguém.
 *
 * Tudo numa transação: se a detecção de PR falhar no meio, a série não pode
 * ficar gravada pela metade — sem isso, um retry duplicaria o insert.
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
}): Promise<{ setId: number; prs: PersonalRecord[] }> {
  let setId = 0;
  let prs: PersonalRecord[] = [];

  await tx(async () => {
    setId = await run(
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

    if (s.tipo !== 'aquecimento' && s.pesoKg && s.reps) {
      prs = await detectarPRs(setId, s);
    }
  });

  return { setId, prs };
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
  let prs: PersonalRecord[] = [];

  await tx(async () => {
    // O TIPO da linha manda, e ele não vem no argumento: quem corrige uma série
    // está na tela, não sabe (nem deveria) que existe uma coluna `tipo`.
    // `registrarSerie` já pulava a detecção em aquecimento; a correção não
    // pulava, então corrigir o peso de uma aproximação cravava recorde a partir
    // de uma série que, por definição, não é esforço máximo. Antes de G2 esse
    // guard era código morto — não havia como criar aquecimento pela tela.
    const linha = await first<{ tipo: string }>('SELECT tipo FROM set_logs WHERE id = ?', [
      s.setLogId,
    ]);

    await run('UPDATE set_logs SET peso_kg = ?, reps = ? WHERE id = ?', [
      s.pesoKg,
      s.reps,
      s.setLogId,
    ]);

    // Os recordes que nasceram desta série não valem mais.
    await run('DELETE FROM personal_records WHERE set_log_id = ?', [s.setLogId]);
    await recalcularVolume(s.sessionId);

    if (linha?.tipo !== 'aquecimento' && s.pesoKg && s.reps) {
      prs = await detectarPRs(s.setLogId, s);
    }
  });

  return prs;
}

export async function desfazerSerie(setLogId: number, sessionId: number) {
  // Junto ou nada: recorde sem série (ou série sem volume recalculado) é o
  // tipo de meio-estado que trava a progressão em silêncio.
  await tx(async () => {
    await run('DELETE FROM personal_records WHERE set_log_id = ?', [setLogId]);
    await run('DELETE FROM set_logs WHERE id = ?', [setLogId]);
    await recalcularVolume(sessionId);
  });
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
  // e1rm só compete contra registros de até 10 reps: PRs inflados por série
  // longa que JÁ estão no banco viram linhas inertes — nada é apagado (o XP
  // dado fica dado, ledger é ledger), mas eles param de travar recordes
  // legítimos futuros.
  const filtro = tipo === 'e1rm' ? 'AND reps <= 10' : '';
  const r = await first<{ v: number }>(
    `SELECT MAX(valor) AS v FROM personal_records WHERE exercise_id = ? AND tipo = ? ${filtro}`,
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
    { tipo: 'carga_max', valor: peso },
    { tipo: 'volume_serie', valor: peso * reps },
  ];
  // Equações de 1RM degradam acima de ~10 reps: 40 kg × 20 daria "e1RM 66 kg"
  // que a pessoa nunca levantou — e travaria o recorde de quem depois fizer
  // 60 kg × 5 de verdade. Série longa pontua em carga e volume, não aqui.
  if (reps <= 10) candidatos.unshift({ tipo: 'e1rm', valor: e1rm(peso, reps) });

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
  // Idempotente de propósito: o retry da tela re-chama isto quando a falha
  // pode ter acontecido DEPOIS do commit (no check-in, por exemplo). Sessão
  // já fechada não pontua de novo — XP é ledger append-only (regra 4), e a
  // segunda passada dobraria o XP do mesmo treino.
  const ja = await getSessao(sessionId);
  if (ja?.finalizado_em) return { valida: true, xp: 0, streak: 0 };

  let resultado = { valida: false, xp: 0, streak: 0 };

  // Fechar a sessão, dar o XP e avançar a sequência andam juntos: sem
  // transação, uma falha no meio deixava treino finalizado sem pontuar — e
  // repetir a chamada pontuaria em dobro.
  await tx(async () => {
    // `tipo <> 'aquecimento'` não é detalhe: sem ele, duas séries de
    // aproximação e o treino abandonado gravavam `finalizado_em`, davam XP,
    // avançavam a sequência e disparavam o check-in. Aquecimento é o que se faz
    // ANTES de treinar — se só ele aconteceu, o treino não aconteceu.
    const series = await first<{ n: number }>(
      `SELECT COUNT(*) AS n FROM set_logs
        WHERE session_id = ? AND concluida = 1 AND tipo <> 'aquecimento'`,
      [sessionId]
    );

    // Sessão sem nenhuma série não conta como treino — nem grava, nem pontua.
    if ((series?.n ?? 0) === 0) {
      await run('DELETE FROM workout_sessions WHERE id = ?', [sessionId]);
      return;
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

    resultado = { valida: true, xp, streak };
  });

  return resultado;
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
  // O filtro de tipo tem que estar nas DUAS queries. Só na segunda, uma sessão
  // em que o exercício teve apenas aquecimento era eleita "última execução" e
  // devolvia lista vazia — o "Anterior:" sumia da tela e a progressão perdia a
  // referência, com a série de verdade viva duas sessões atrás.
  const s = await first<{ session_id: number }>(
    `SELECT session_id FROM set_logs
      WHERE exercise_id = ? AND concluida = 1 AND session_id <> ?
        AND tipo <> 'aquecimento'
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
  // Mesmo teto de 10 reps do `melhorPR`: o recorde de e1RM exibido tem que
  // ser o mesmo contra o qual a detecção compara — senão a tela mostra um
  // número inflado que nenhuma série nova consegue "bater".
  return all<PersonalRecord & { tipo: TipoPR }>(
    `SELECT * FROM personal_records p
      WHERE p.exercise_id = ?
        AND (p.tipo <> 'e1rm' OR p.reps <= 10)
        AND p.valor = (SELECT MAX(valor) FROM personal_records
                        WHERE exercise_id = p.exercise_id AND tipo = p.tipo
                          AND (tipo <> 'e1rm' OR reps <= 10))
      GROUP BY p.tipo`,
    [exerciseId]
  );
}

export async function evolucaoExercicio(exerciseId: number, limite = 20) {
  // Espelho SQL exato do `e1rm()` de perfil/calculos: reps 1 vale o próprio
  // peso, e acima de 10 reps não vale nada — as equações de 1RM degradam em
  // série longa, e a fórmula solta daqui divergia da detecção de PR.
  // Dia só de séries acima de 10 reps fica com e1rm NULL (o volume continua);
  // é a tela que decide esconder o ponto do gráfico.
  const rows = await all<{ dia: string; e1rm: number | null; volume: number }>(
    `SELECT date(registrado_em/1000, 'unixepoch', 'localtime') AS dia,
            MAX(CASE WHEN reps <= 1 THEN peso_kg
                     WHEN reps <= 10 THEN peso_kg * (1 + reps / 30.0) END) AS e1rm,
            SUM(peso_kg * reps)                                           AS volume
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
            (SELECT COUNT(*) FROM set_logs sl
              WHERE sl.session_id = ws.id AND sl.tipo <> 'aquecimento') AS qtd_series,
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
      (SELECT COUNT(*) FROM set_logs
        WHERE concluida = 1 AND tipo <> 'aquecimento')                        AS series,
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
