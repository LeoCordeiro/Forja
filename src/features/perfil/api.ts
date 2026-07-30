import { all, first, run } from '@/db/client';
import type { BodyMetric, Macros, NutritionTarget, Profile } from '@/db/types';
import { hoje } from '@/shared/utils/date';
import { idade } from '@/shared/utils/date';
import { macros, metaCalorica, tdee, tmb } from './calculos';
import { DEFICIT_RECOMPOSICAO, macrosRecomposicao } from './recomposicao';
import { metaDiaria } from '../agua/api';

export async function getPerfil(): Promise<Profile | null> {
  return first<Profile>('SELECT * FROM profile WHERE id = 1');
}

/** Campos da v2 são opcionais: telas antigas continuam salvando sem conhecê-los. */
type CamposV2 =
  | 'tmb_medido_kcal'
  | 'usa_tmb_medido'
  | 'meta_agua_ml'
  | 'gordura_meta_pct'
  | 'experiencia'
  | 'dias_treino_semana'
  | 'retomou_em'
  | 'meses_parado'
  | 'papel'
  | 'horario_treino'
  | 'hora_acorda'
  | 'hora_dorme'
  | 'hora_treino'
  | 'preferencia_equipamento'
  | 'incomodo'
  | 'onde_acumula'
  | 'desistencia'
  | 'dores'
  | 'minutos_sessao'
  | 'passos_alvo'
  | 'cardio_sessoes'
  | 'minutos_por_dia'
  | 'lembretes_ativos'
  | 'lembrete_medida'
  | 'local_treino'
  | 'dias_disponiveis'
  | 'enfase'
  | 'barra_fixa_reps'
  | 'preferencia_equipamento'
  | 'dores';

type PerfilEntrada = Omit<Profile, 'id' | 'criado_em' | CamposV2> &
  Partial<Pick<Profile, CamposV2>>;

export async function salvarPerfil(p: PerfilEntrada) {
  await run(
    `INSERT INTO profile
       (id, nome, data_nascimento, genero, altura_cm, nivel_atividade, objetivo,
        peso_meta_kg, onboarding_completo, criado_em,
        tmb_medido_kcal, usa_tmb_medido, meta_agua_ml, gordura_meta_pct,
        experiencia, dias_treino_semana, retomou_em, meses_parado, papel,
        horario_treino, hora_acorda, hora_dorme, hora_treino,
        local_treino, dias_disponiveis, enfase, preferencia_equipamento, dores,
        barra_fixa_reps)
     VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       data_nascimento = excluded.data_nascimento,
       genero = excluded.genero,
       altura_cm = excluded.altura_cm,
       nivel_atividade = excluded.nivel_atividade,
       objetivo = excluded.objetivo,
       peso_meta_kg = excluded.peso_meta_kg,
       onboarding_completo = excluded.onboarding_completo,
       tmb_medido_kcal = excluded.tmb_medido_kcal,
       usa_tmb_medido = excluded.usa_tmb_medido,
       meta_agua_ml = excluded.meta_agua_ml,
       gordura_meta_pct = excluded.gordura_meta_pct,
       experiencia = excluded.experiencia,
       dias_treino_semana = excluded.dias_treino_semana,
       retomou_em = excluded.retomou_em,
       meses_parado = excluded.meses_parado,
       papel = excluded.papel,
       horario_treino = excluded.horario_treino,
       hora_acorda = excluded.hora_acorda,
       hora_dorme = excluded.hora_dorme,
       hora_treino = excluded.hora_treino,
       local_treino = excluded.local_treino,
       dias_disponiveis = excluded.dias_disponiveis,
       enfase = excluded.enfase,
       preferencia_equipamento = excluded.preferencia_equipamento,
       dores = excluded.dores,
       barra_fixa_reps = excluded.barra_fixa_reps`,
    [
      p.nome,
      p.data_nascimento,
      p.genero,
      p.altura_cm,
      p.nivel_atividade,
      p.objetivo,
      p.peso_meta_kg,
      p.onboarding_completo,
      Date.now(),
      p.tmb_medido_kcal ?? null,
      p.usa_tmb_medido ?? 0,
      p.meta_agua_ml ?? null,
      p.gordura_meta_pct ?? null,
      p.experiencia ?? 'iniciante',
      p.dias_treino_semana ?? 3,
      p.retomou_em ?? null,
      p.meses_parado ?? 0,
      p.papel ?? 'aluno',
      p.horario_treino ?? 'manha',
      p.hora_acorda ?? '06:30',
      p.hora_dorme ?? '23:00',
      p.hora_treino ?? null,
      p.local_treino ?? 'academia',
      p.dias_disponiveis ?? null,
      p.enfase ?? null,
      p.preferencia_equipamento ?? 'ambos',
      p.dores ?? null,
      p.barra_fixa_reps ?? -1,
    ]
  );
}

/** Uma medição por dia: registrar de novo no mesmo dia complementa a anterior. */
export async function salvarMedida(m: Partial<BodyMetric> & { medido_em?: string }) {
  const data = m.medido_em ?? hoje();
  await run(
    `INSERT INTO body_metrics
       (medido_em, peso_kg, gordura_pct, cintura_cm, peito_cm, quadril_cm,
        braco_cm, coxa_cm, gordura_visceral, musculo_pct, idade_corporal,
        tmb_kcal, agua_pct, origem, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(medido_em) DO UPDATE SET
       peso_kg          = COALESCE(excluded.peso_kg,          body_metrics.peso_kg),
       gordura_pct      = COALESCE(excluded.gordura_pct,      body_metrics.gordura_pct),
       cintura_cm       = COALESCE(excluded.cintura_cm,       body_metrics.cintura_cm),
       peito_cm         = COALESCE(excluded.peito_cm,         body_metrics.peito_cm),
       quadril_cm       = COALESCE(excluded.quadril_cm,       body_metrics.quadril_cm),
       braco_cm         = COALESCE(excluded.braco_cm,         body_metrics.braco_cm),
       coxa_cm          = COALESCE(excluded.coxa_cm,          body_metrics.coxa_cm),
       gordura_visceral = COALESCE(excluded.gordura_visceral, body_metrics.gordura_visceral),
       musculo_pct      = COALESCE(excluded.musculo_pct,      body_metrics.musculo_pct),
       idade_corporal   = COALESCE(excluded.idade_corporal,   body_metrics.idade_corporal),
       tmb_kcal         = COALESCE(excluded.tmb_kcal,         body_metrics.tmb_kcal),
       agua_pct         = COALESCE(excluded.agua_pct,         body_metrics.agua_pct),
       origem           = excluded.origem`,
    [
      data,
      m.peso_kg ?? null,
      m.gordura_pct ?? null,
      m.cintura_cm ?? null,
      m.peito_cm ?? null,
      m.quadril_cm ?? null,
      m.braco_cm ?? null,
      m.coxa_cm ?? null,
      m.gordura_visceral ?? null,
      m.musculo_pct ?? null,
      m.idade_corporal ?? null,
      m.tmb_kcal ?? null,
      m.agua_pct ?? null,
      m.origem ?? 'manual',
      Date.now(),
    ]
  );

  // TMB medido substitui a estimativa por fórmula a partir de agora.
  if (m.tmb_kcal) {
    await run('UPDATE profile SET tmb_medido_kcal = ?, usa_tmb_medido = 1 WHERE id = 1', [
      m.tmb_kcal,
    ]);
  }
}

/** Última medida com bioimpedância — traz gordura, visceral e músculo juntos. */
export async function ultimaBioimpedancia(): Promise<BodyMetric | null> {
  return first<BodyMetric>(
    `SELECT * FROM body_metrics
      WHERE gordura_pct IS NOT NULL
      ORDER BY medido_em DESC LIMIT 1`
  );
}

export async function ultimaMedida(): Promise<BodyMetric | null> {
  return first<BodyMetric>(
    'SELECT * FROM body_metrics WHERE peso_kg IS NOT NULL ORDER BY medido_em DESC LIMIT 1'
  );
}

export async function historicoMedidas(limite = 60): Promise<BodyMetric[]> {
  const rows = await all<BodyMetric>(
    'SELECT * FROM body_metrics ORDER BY medido_em DESC LIMIT ?',
    [limite]
  );
  return rows.reverse(); // do mais antigo ao mais novo, como o gráfico espera
}

export async function contarMedidas(): Promise<number> {
  const r = await first<{ n: number }>('SELECT COUNT(*) AS n FROM body_metrics');
  return r?.n ?? 0;
}

export async function metaAtual(): Promise<NutritionTarget | null> {
  return first<NutritionTarget>(
    'SELECT * FROM nutrition_targets ORDER BY valid_from DESC, id DESC LIMIT 1'
  );
}

export async function salvarMeta(m: Macros, origem: 'auto' | 'manual' = 'auto') {
  await run(
    `INSERT INTO nutrition_targets (valid_from, kcal, proteina_g, carbo_g, gordura_g, origem)
     VALUES (?,?,?,?,?,?)`,
    [hoje(), m.kcal, m.proteina_g, m.carbo_g, m.gordura_g, origem]
  );
}

/** Perfil + peso atual + números derivados, na forma que as telas consomem. */
export interface Resumo {
  perfil: Profile;
  pesoKg: number;
  imcValor: number;
  tmbValor: number;
  /** true quando o TMB vem da bioimpedância, não da fórmula. */
  tmbMedido: boolean;
  tdeeValor: number;
  meta: Macros;
  idadeAnos: number;
  gorduraPct: number | null;
  visceral: number | null;
  musculoPct: number | null;
  massaMagraKg: number | null;
  metaAguaMl: number;
}

export async function resumo(): Promise<Resumo | null> {
  const perfil = await getPerfil();
  if (!perfil) return null;

  const medida = await ultimaMedida();
  const bio = await ultimaBioimpedancia();
  const pesoKg = medida?.peso_kg ?? 70;
  const idadeAnos = idade(perfil.data_nascimento);

  // TMB medido por bioimpedância ganha da estimativa: a fórmula assume uma
  // composição corporal média, e quem treina costuma estar longe da média.
  const estimado = tmb(pesoKg, perfil.altura_cm, idadeAnos, perfil.genero);
  const usaMedido = !!(perfil.usa_tmb_medido && perfil.tmb_medido_kcal);
  const basal = usaMedido ? perfil.tmb_medido_kcal! : estimado;
  const gasto = tdee(basal, perfil.nivel_atividade);

  const gorduraPct = bio?.gordura_pct ?? null;
  const massaMagraKg = gorduraPct !== null ? Math.round(pesoKg * (1 - gorduraPct / 100) * 10) / 10 : null;

  const salva = await metaAtual();
  const meta: Macros = salva
    ? {
        kcal: salva.kcal,
        proteina_g: salva.proteina_g,
        carbo_g: salva.carbo_g,
        gordura_g: salva.gordura_g,
      }
    : calcularMeta(gasto, pesoKg, perfil.objetivo, gorduraPct, dadosParaEstimar(perfil));

  return {
    perfil,
    pesoKg,
    imcValor: pesoKg / Math.pow(perfil.altura_cm / 100, 2),
    tmbValor: Math.round(basal),
    tmbMedido: usaMedido,
    tdeeValor: Math.round(gasto),
    meta,
    idadeAnos,
    gorduraPct,
    visceral: bio?.gordura_visceral ?? null,
    musculoPct: bio?.musculo_pct ?? null,
    massaMagraKg,
    metaAguaMl: perfil.meta_agua_ml ?? metaDiaria(pesoKg, true),
  };
}

/**
 * Meta de macros conforme o objetivo.
 * Recomposição tem regra própria: déficit leve e proteína calculada sobre a
 * massa magra, não sobre o peso total.
 */
/**
 * O que a estimativa de massa magra precisa do perfil.
 *
 * Devolve `undefined` se faltar algum campo: estimar com idade zerada daria um
 * número plausível e errado, que é pior que não estimar.
 */
function dadosParaEstimar(
  p: Profile
): { alturaCm: number; idade: number; genero: string } | undefined {
  const anos = idade(p.data_nascimento);
  if (!p.altura_cm || !anos) return undefined;
  return { alturaCm: p.altura_cm, idade: anos, genero: p.genero ?? 'outro' };
}

export function calcularMeta(
  gasto: number,
  pesoKg: number,
  objetivo: Profile['objetivo'],
  gorduraPct: number | null,
  // Sem bioimpedância, permite estimar a massa magra pelo IMC em vez de
  // calcular proteína para o peso inteiro.
  estimar?: { alturaCm: number; idade: number; genero: string }
): Macros {
  if (objetivo === 'recomposicao') {
    return macrosRecomposicao(
      Math.round(gasto * DEFICIT_RECOMPOSICAO), pesoKg, gorduraPct, estimar
    );
  }
  return macros(metaCalorica(gasto, objetivo), pesoKg, objetivo);
}

/**
 * A meta que o app calcularia sozinho agora — sem gravar nada.
 *
 * É o único ponto de cálculo: o recálculo automático grava isto e a tela de
 * ajuste preenche os campos com isto. Refazer a conta na tela com `macros()`
 * direto já ressuscitou a proteína sobre o peso total na recomposição — o
 * caminho certo passa pela massa magra, e só `calcularMeta` sabe disso.
 */
export async function metaAutomatica(): Promise<Macros | null> {
  const r = await resumo();
  if (!r) return null;
  return calcularMeta(
    r.tdeeValor, r.pesoKg, r.perfil.objetivo, r.gorduraPct, dadosParaEstimar(r.perfil)
  );
}

/** Recalcula a meta a partir do peso atual — chamado ao registrar novo peso. */
export async function recalcularMeta() {
  const m = await metaAutomatica();
  if (m) await salvarMeta(m, 'auto');
}

/** Meta de calorias definida à mão — mantém os macros proporcionais. */
export async function definirMetaCalorica(kcal: number) {
  const r = await resumo();
  if (!r) return;
  const base = calcularMeta(
    r.tdeeValor, r.pesoKg, r.perfil.objetivo, r.gorduraPct, dadosParaEstimar(r.perfil)
  );
  // Proteína e gordura são pisos de saúde; o ajuste sai do carboidrato.
  const restante = kcal - base.proteina_g * 4 - base.gordura_g * 9;
  await salvarMeta(
    {
      kcal,
      proteina_g: base.proteina_g,
      gordura_g: base.gordura_g,
      carbo_g: Math.max(0, Math.round(restante / 4)),
    },
    'manual'
  );
}

export async function definirMetaAgua(ml: number) {
  await run('UPDATE profile SET meta_agua_ml = ? WHERE id = 1', [ml]);
}

export async function definirPreferenciaEquipamento(pref: string) {
  await run('UPDATE profile SET preferencia_equipamento = ? WHERE id = 1', [pref]);
}

export async function salvarTempoPorDia(minutosPorDia: number[]) {
  await run('UPDATE profile SET minutos_por_dia = ? WHERE id = 1', [minutosPorDia.join(',')]);
}

export async function salvarLembretes(ativos: boolean, medida: boolean) {
  await run('UPDATE profile SET lembretes_ativos = ?, lembrete_medida = ? WHERE id = 1', [
    ativos ? 1 : 0,
    medida ? 1 : 0,
  ]);
}

/** Domingo a sábado. Sem configuração, 60 min na semana e 90 no fim de semana. */
export function lerTempoPorDia(csv: string | null): number[] {
  if (!csv) return [90, 60, 60, 60, 60, 60, 90];
  const v = csv.split(',').map((x) => parseInt(x, 10));
  return v.length === 7 && v.every((n) => n > 0) ? v : [90, 60, 60, 60, 60, 60, 90];
}

export async function salvarDiagnostico(d: {
  incomodo: string | null;
  onde_acumula: string | null;
  desistencia: string | null;
  dores: string;
  minutos_sessao: number;
  passos_alvo: number | null;
  cardio_sessoes: number;
}) {
  await run(
    `UPDATE profile SET incomodo = ?, onde_acumula = ?, desistencia = ?, dores = ?,
            minutos_sessao = ?, passos_alvo = ?, cardio_sessoes = ?
      WHERE id = 1`,
    [
      d.incomodo,
      d.onde_acumula,
      d.desistencia,
      d.dores,
      d.minutos_sessao,
      d.passos_alvo,
      d.cardio_sessoes,
    ]
  );
}
