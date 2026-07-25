import { all, first, run } from '@/db/client';
import type { BodyMetric, Macros, NutritionTarget, Profile } from '@/db/types';
import { hoje } from '@/shared/utils/date';
import { idade } from '@/shared/utils/date';
import { macros, metaCalorica, tdee, tmb } from './calculos';

export async function getPerfil(): Promise<Profile | null> {
  return first<Profile>('SELECT * FROM profile WHERE id = 1');
}

export async function salvarPerfil(p: Omit<Profile, 'id' | 'criado_em'>) {
  await run(
    `INSERT INTO profile
       (id, nome, data_nascimento, genero, altura_cm, nivel_atividade, objetivo,
        peso_meta_kg, onboarding_completo, criado_em)
     VALUES (1,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       data_nascimento = excluded.data_nascimento,
       genero = excluded.genero,
       altura_cm = excluded.altura_cm,
       nivel_atividade = excluded.nivel_atividade,
       objetivo = excluded.objetivo,
       peso_meta_kg = excluded.peso_meta_kg,
       onboarding_completo = excluded.onboarding_completo`,
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
    ]
  );
}

/** Uma medição por dia: registrar de novo no mesmo dia sobrescreve. */
export async function salvarMedida(m: Partial<BodyMetric> & { medido_em?: string }) {
  const data = m.medido_em ?? hoje();
  await run(
    `INSERT INTO body_metrics
       (medido_em, peso_kg, gordura_pct, cintura_cm, peito_cm, quadril_cm,
        braco_cm, coxa_cm, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(medido_em) DO UPDATE SET
       peso_kg     = COALESCE(excluded.peso_kg,     body_metrics.peso_kg),
       gordura_pct = COALESCE(excluded.gordura_pct, body_metrics.gordura_pct),
       cintura_cm  = COALESCE(excluded.cintura_cm,  body_metrics.cintura_cm),
       peito_cm    = COALESCE(excluded.peito_cm,    body_metrics.peito_cm),
       quadril_cm  = COALESCE(excluded.quadril_cm,  body_metrics.quadril_cm),
       braco_cm    = COALESCE(excluded.braco_cm,    body_metrics.braco_cm),
       coxa_cm     = COALESCE(excluded.coxa_cm,     body_metrics.coxa_cm)`,
    [
      data,
      m.peso_kg ?? null,
      m.gordura_pct ?? null,
      m.cintura_cm ?? null,
      m.peito_cm ?? null,
      m.quadril_cm ?? null,
      m.braco_cm ?? null,
      m.coxa_cm ?? null,
      Date.now(),
    ]
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
  idadeAnos: number;
}

export async function resumo(): Promise<Resumo | null> {
  const perfil = await getPerfil();
  if (!perfil) return null;

  const medida = await ultimaMedida();
  const pesoKg = medida?.peso_kg ?? 70;
  const idadeAnos = idade(perfil.data_nascimento);

  const basal = tmb(pesoKg, perfil.altura_cm, idadeAnos, perfil.genero);
  const gasto = tdee(basal, perfil.nivel_atividade);

  const salva = await metaAtual();
  const meta: Macros = salva
    ? {
        kcal: salva.kcal,
        proteina_g: salva.proteina_g,
        carbo_g: salva.carbo_g,
        gordura_g: salva.gordura_g,
      }
    : macros(metaCalorica(gasto, perfil.objetivo), pesoKg, perfil.objetivo);

  return {
    perfil,
    pesoKg,
    imcValor: pesoKg / Math.pow(perfil.altura_cm / 100, 2),
    tmbValor: Math.round(basal),
    tdeeValor: Math.round(gasto),
    meta,
    idadeAnos,
  };
}

/** Recalcula a meta a partir do peso atual — chamado ao registrar novo peso. */
export async function recalcularMeta() {
  const r = await resumo();
  if (!r) return;
  const nova = macros(metaCalorica(r.tdeeValor, r.perfil.objetivo), r.pesoKg, r.perfil.objetivo);
  await salvarMeta(nova, 'auto');
}
