import { all, first, run } from '@/db/client';
import type { BodyMetric, Macros, NutritionTarget, Profile } from '@/db/types';
import { hoje } from '@/shared/utils/date';
import { idade } from '@/shared/utils/date';
import { tdee, tmb } from './calculos';
import {
  avisosDaMeta,
  calcularMetaDetalhada,
  decidirRecalculo,
  gorduraVigente,
  tmbVigente,
  type TmbVigente,
} from './meta';
import type { OrigemComposicao } from './recomposicao';
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

/**
 * A última medição que trouxe TMB — com o PESO daquele dia junto.
 *
 * É o peso que responde "esta medição ainda descreve este corpo?". Sem ele o
 * TMB medido não teria como envelhecer, que é exatamente o estado anterior.
 */
export async function ultimaComTmb(): Promise<BodyMetric | null> {
  return first<BodyMetric>(
    `SELECT * FROM body_metrics
      WHERE tmb_kcal IS NOT NULL
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
  tdeeValor: number;
  meta: Macros;
  /** De onde a proteína saiu. Uma linha, para a tela mostrar. */
  baseCalculoMeta: string;
  /** Por que a base é essa, e não a que o objetivo vizinho usa. */
  porqueBaseMeta: string;
  /**
   * **Por que esta meta é essa** — informativo, permanente, nunca alerta.
   *
   * O piso calórico que mordeu, o teto de mobilização de gordura, a gordura
   * que teve que descer para a conta caber. Era calculado e jogado fora:
   * `recalcularMeta` desestruturava os avisos só para descartá-los, e
   * `resumo()` só usava os da automática **quando não existia meta salva** —
   * o que, depois do onboarding, nunca acontece. No estado estável o piso
   * mordia em silêncio.
   */
  razaoMeta: string[];
  /**
   * **O que está ERRADO com a meta vigente** — alerta, e só aparece quando há.
   *
   * Pergunta diferente da de cima, e por isso lista diferente: a meta
   * automática pode ter uma razão longa e zero problemas. Juntar as duas sob o
   * mesmo rótulo laranja transformaria toda explicação em alarme.
   */
  avisosMeta: string[];
  /** `true` quando a meta vigente foi escolhida à mão. */
  metaManual: boolean;
  /** A caloria que o app calcularia sozinho hoje — para comparar com a manual. */
  metaAutomaticaKcal: number;
  idadeAnos: number;
  /** Já envelhecido: a bioimpedância de 3 meses ajustada ao peso de hoje. */
  gorduraPct: number | null;
  /** O percentual cru da última bioimpedância, como ela saiu da balança. */
  gorduraMedidaPct: number | null;
  gorduraOrigem: OrigemComposicao;
  visceral: number | null;
  musculoPct: number | null;
  massaMagraKg: number | null;
  metaAguaMl: number;
  /**
   * De onde o TMB de hoje veio: medido, ajustado ao peso atual, ou estimado.
   *
   * Substituiu `tmbMedido: boolean` **e** `tmbMotivo: string | null`. O
   * booleano tinha dois estados para três situações e fazia a bioimpedância de
   * três meses atrás se apresentar como a de hoje; o motivo era o card laranja
   * que a expiração precisava e o envelhecimento não precisa. Os dois viraram
   * uma legenda permanente — e ficaram fora do `Resumo`, porque campo morto ao
   * lado do campo vivo é o que a próxima pessoa acha primeiro.
   */
  tmbOrigem: 'medido' | 'ajustado' | 'estimado';
}

export async function resumo(): Promise<Resumo | null> {
  const perfil = await getPerfil();
  if (!perfil) return null;

  const medida = await ultimaMedida();
  const bio = await ultimaBioimpedancia();
  const pesoKg = medida?.peso_kg ?? 70;
  const idadeAnos = idade(perfil.data_nascimento);

  const estimar = dadosParaEstimar(perfil);

  // ── TMB: a fórmula de hoje, mais o desvio que a balança mediu ───────────
  //
  // A fórmula assume composição corporal média e quem treina está longe dela,
  // então a bioimpedância acrescenta informação — mas o que ela acrescenta é o
  // DESVIO deste corpo, não o valor absoluto. Guardar o valor fazia o TDEE
  // ficar superestimado com o peso caindo (N6); expirar o valor jogava fora a
  // informação individual junto com a velha (N18). O desvio acompanha o peso e
  // envelhece — ver `tmbVigente`.
  const estimado = tmb(pesoKg, perfil.altura_cm, idadeAnos, perfil.genero);
  const medicaoTmb = await ultimaComTmb();
  const vigente: TmbVigente = tmbVigente({
    medidoKcal: perfil.usa_tmb_medido ? (perfil.tmb_medido_kcal ?? null) : null,
    medidoEm: medicaoTmb?.medido_em ?? null,
    pesoNaMedicao: medicaoTmb?.peso_kg ?? null,
    estimadoNaMedicao: medicaoTmb?.peso_kg
      ? tmb(medicaoTmb.peso_kg, perfil.altura_cm, idadeAnos, perfil.genero)
      : null,
    pesoAtual: pesoKg,
    estimado,
    hojeIso: hoje(),
  });
  const basal = vigente.valor;
  const gasto = tdee(basal, perfil.nivel_atividade);

  // ── E a GORDURA da mesma linha, pela MESMA política (N15) ──────────────
  //
  // Era `bio?.gordura_pct` cru, valendo para sempre — a mesma medição com duas
  // políticas contraditórias dentro deste mesmo `resumo()`, e a que ficou de
  // fora é a que decide a proteína.
  const gordura = gorduraVigente({
    medidoPct: bio?.gordura_pct ?? null,
    medidoEm: bio?.medido_em ?? null,
    pesoNaMedicao: bio?.peso_kg ?? null,
    pesoAtual: pesoKg,
    hojeIso: hoje(),
    estimar,
  });
  const gorduraPct = gordura.pct;
  const massaMagraKg = gorduraPct !== null ? Math.round(pesoKg * (1 - gorduraPct / 100) * 10) / 10 : null;

  const ctxMeta = {
    basal,
    tdee: gasto,
    pesoKg,
    gorduraPct,
    gorduraOrigem: gordura.origem,
    estimar,
    genero: perfil.genero,
    objetivo: perfil.objetivo,
  };
  const automatica = calcularMetaDetalhada({ ...ctxMeta, tdee: gasto, basal, pesoKg });

  const salva = await metaAtual();
  const manual = salva?.origem === 'manual';
  const meta: Macros = salva
    ? {
        kcal: salva.kcal,
        proteina_g: salva.proteina_g,
        carbo_g: salva.carbo_g,
        gordura_g: salva.gordura_g,
      }
    : automatica.meta;

  return {
    perfil,
    pesoKg,
    imcValor: pesoKg / Math.pow(perfil.altura_cm / 100, 2),
    tmbValor: Math.round(basal),
    tmbOrigem: vigente.origem,
    tdeeValor: Math.round(gasto),
    meta,
    baseCalculoMeta: automatica.baseCalculo,
    porqueBaseMeta: automatica.porqueBase,
    // ── As duas listas, e elas respondem perguntas diferentes (N14) ─────
    //
    // A RAZÃO é a da meta automática e vale sempre — o piso mordeu, o teto de
    // gordura mordeu, a gordura desceu para caber. Só some quando a meta
    // vigente é manual: aí a razão da automática não descreve o que está na
    // tela, e o que a pessoa precisa saber é outra coisa (N13).
    razaoMeta: manual
      ? [decidirRecalculo({ vigente: { ...meta, origem: 'manual' }, automatica: automatica.meta }).aviso ?? '']
          .filter(Boolean)
      : automatica.avisos,
    // O ALERTA é sobre a meta que está valendo, inclusive uma manual antiga:
    // auditar na LEITURA é o que faz o aviso continuar valendo quando o peso
    // muda meses depois.
    avisosMeta: avisosDaMeta(meta, ctxMeta),
    metaManual: manual,
    metaAutomaticaKcal: automatica.meta.kcal,
    idadeAnos,
    gorduraPct,
    gorduraMedidaPct: bio?.gordura_pct ?? null,
    gorduraOrigem: gordura.origem,
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

/**
 * A meta que o app calcularia sozinho agora — sem gravar nada.
 *
 * É o único ponto de cálculo: o recálculo automático grava isto e a tela de
 * ajuste preenche os campos com isto. Refazer a conta na tela com `macros()`
 * direto já ressuscitou a proteína sobre o peso total na recomposição, e a
 * conta certa mora inteira em `meta.ts` — inclusive o piso calórico e o teto de
 * déficit, que existiam escritos e não eram chamados por ninguém.
 */
export async function metaAutomatica(): Promise<(Macros & { avisos: string[] }) | null> {
  const r = await resumo();
  if (!r) return null;
  const c = calcularMetaDetalhada({
    tdee: r.tdeeValor,
    basal: r.tmbValor,
    pesoKg: r.pesoKg,
    objetivo: r.perfil.objetivo,
    gorduraPct: r.gorduraPct,
    gorduraOrigem: r.gorduraOrigem,
    estimar: dadosParaEstimar(r.perfil),
    genero: r.perfil.genero,
  });
  return { ...c.meta, avisos: c.avisos };
}

/**
 * Recalcula a meta a partir do peso atual — sem atropelar a escolha da pessoa.
 *
 * Disparada em toda pesagem, toda bioimpedância e toda edição de perfil. Ela
 * gravava `'auto'` **sem consultar a origem da meta vigente**: quem ajustava
 * para 1.800 kcal via a meta voltar para 2.464 na manhã seguinte, ao se pesar,
 * sem nada na tela. Devolve o que aconteceu para a tela dizer — a decisão em si
 * mora em `meta.ts`, testável (N13).
 */
export async function recalcularMeta(): Promise<{ gravou: boolean; aviso: string | null }> {
  const m = await metaAutomatica();
  if (!m) return { gravou: false, aviso: null };
  const { avisos, ...macros } = m;
  const vigente = await metaAtual();
  const d = decidirRecalculo({ vigente, automatica: macros });
  if (!d.gravar) return { gravou: false, aviso: d.aviso };
  await salvarMeta(macros, 'auto');
  // Os avisos não são gravados: são derivados do peso de hoje, e congelá-los
  // em `nutrition_targets` criaria a explicação mentirosa que a regra 6 do
  // projeto proíbe. `resumo()` os recalcula na leitura, em `razaoMeta`.
  void avisos;
  return { gravou: true, aviso: null };
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
