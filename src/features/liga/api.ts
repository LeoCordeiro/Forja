import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { all, first, run } from '@/db/client';
import { hoje } from '@/shared/utils/date';

/**
 * Liga de amigos: check-in, ranking e temporada.
 *
 * ── O que sai do celular, e o que não sai ────────────────────────────────
 *
 * Só o que precisa ser comparado entre pessoas: apelido, data do check-in,
 * tipo e pontos. Peso, medidas, gordura corporal, dieta e histórico de carga
 * **nunca saem daqui**. Ranking de quem apareceu não precisa saber quanto você
 * pesa, e guardar isso num servidor seria assumir uma responsabilidade que o
 * app não precisa ter.
 *
 * Sem e-mail e sem senha: cada participante é um id anônimo gerado no
 * dispositivo. Entrar numa liga é colar um código. Menos atrito e nenhuma
 * credencial de ninguém sob nossa guarda.
 *
 * ── Por que check-in, e não volume levantado ─────────────────────────────
 *
 * Ranking por carga premia quem já é forte e desmotiva quem começou — é o
 * jeito mais rápido de matar uma liga de amigos. Ranking por aparecer premia
 * o único comportamento que todo mundo controla: ir. Volume aparece como
 * informação, não como pontuação.
 *
 * ── Funciona sem servidor? ───────────────────────────────────────────────
 *
 * O app inteiro continua funcionando sem nada disto. Sem credencial
 * configurada, os check-ins ficam locais e a liga vira solo — contra o próprio
 * histórico. Configurar o Supabase só acrescenta os amigos.
 */

// ── Configuração ──────────────────────────────────────────────────────────

const CHAVE_CFG = 'forja.liga.cfg';
const CHAVE_EU = 'forja.liga.eu';

interface Config {
  url: string;
  anonKey: string;
}

function armazem(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function lerJson<T>(chave: string): T | null {
  try {
    const v = armazem()?.getItem(chave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function gravarJson(chave: string, valor: unknown) {
  try {
    armazem()?.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo privado recusa; a liga então não sobrevive ao fechar */
  }
}

export function getConfig(): Config | null {
  return lerJson<Config>(CHAVE_CFG);
}

export function salvarConfig(url: string, anonKey: string) {
  gravarJson(CHAVE_CFG, { url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() });
  cliente = null; // força reconexão com as credenciais novas
}

export function limparConfig() {
  armazem()?.removeItem(CHAVE_CFG);
  cliente = null;
}

let cliente: SupabaseClient | null = null;

function sb(): SupabaseClient | null {
  if (cliente) return cliente;
  const cfg = getConfig();
  if (!cfg?.url || !cfg.anonKey) return null;
  try {
    cliente = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cliente;
  } catch {
    return null;
  }
}

export const ligaAtiva = () => !!getConfig();

// ── Identidade ────────────────────────────────────────────────────────────

export interface Eu {
  id: string;
  apelido: string;
  emoji: string;
  ligaId: string | null;
}

function uuid(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback simples: só precisa ser único entre um punhado de amigos.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getEu(): Eu {
  const salvo = lerJson<Eu>(CHAVE_EU);
  if (salvo) return salvo;
  const novo: Eu = { id: uuid(), apelido: '', emoji: '💪', ligaId: null };
  gravarJson(CHAVE_EU, novo);
  return novo;
}

export function salvarEu(e: Partial<Eu>) {
  gravarJson(CHAVE_EU, { ...getEu(), ...e });
}

// ── Pontuação ─────────────────────────────────────────────────────────────

/**
 * Pontos por check-in.
 *
 * Deliberadamente achatado: treino vale mais que mobilidade, mas não dez vezes
 * mais. Diferença grande demais faz a pessoa ignorar tudo que não é o item de
 * maior pontuação — e aí a liga passa a punir quem faz o dia leve certo.
 */
export const PONTOS = { treino: 10, cardio: 6, mobilidade: 4 } as const;
export type TipoCheckin = keyof typeof PONTOS;

/** Bônus de constância: 3 dias seguidos rendem mais que 3 dias soltos. */
export function bonusSequencia(diasSeguidos: number): number {
  if (diasSeguidos >= 7) return 5;
  if (diasSeguidos >= 3) return 2;
  return 0;
}

// ── Check-in ──────────────────────────────────────────────────────────────

/**
 * Grava local SEMPRE, e tenta o servidor depois.
 *
 * A ordem importa: gravar primeiro no celular garante que o check-in existe
 * mesmo sem sinal na academia — que é o cenário normal. Falhar em sincronizar
 * não pode fazer o registro sumir.
 */
export async function checkin(tipo: TipoCheckin, extra?: { duracaoMin?: number; volumeKg?: number }) {
  const data = hoje();
  const eu = getEu();
  const seq = await sequenciaLocal();
  const pontos = PONTOS[tipo] + bonusSequencia(seq);

  await run(
    `INSERT INTO checkin_log (data, tipo, pontos, duracao_min, volume_kg, sincronizado, criado_em)
     VALUES (?,?,?,?,?,0,?)
     ON CONFLICT(data, tipo) DO UPDATE SET
       pontos = excluded.pontos,
       duracao_min = COALESCE(excluded.duracao_min, checkin_log.duracao_min),
       volume_kg = COALESCE(excluded.volume_kg, checkin_log.volume_kg)`,
    [data, tipo, pontos, extra?.duracaoMin ?? null, extra?.volumeKg ?? null, Date.now()]
  );

  void sincronizar();
  return pontos;
}

export async function checkinsDoDia(data = hoje()) {
  return all<{ tipo: string; pontos: number }>(
    'SELECT tipo, pontos FROM checkin_log WHERE data = ?',
    [data]
  );
}

/** Dias seguidos com pelo menos um check-in, contando de hoje para trás. */
export async function sequenciaLocal(): Promise<number> {
  const dias = await all<{ data: string }>(
    'SELECT DISTINCT data FROM checkin_log ORDER BY data DESC LIMIT 60'
  );
  if (!dias.length) return 0;

  const set = new Set(dias.map((d) => d.data));
  let n = 0;
  const cursor = new Date();
  // Começa de hoje; se hoje ainda não tem, começa de ontem — o dia não acabou.
  if (!set.has(hoje())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!set.has(iso)) break;
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

// ── Sincronização ─────────────────────────────────────────────────────────

export async function sincronizar(): Promise<{ enviados: number } | null> {
  const c = sb();
  const eu = getEu();
  if (!c || !eu.ligaId || !eu.apelido) return null;

  const pendentes = await all<{
    id: number;
    data: string;
    tipo: string;
    pontos: number;
    duracao_min: number | null;
    volume_kg: number | null;
  }>('SELECT * FROM checkin_log WHERE sincronizado = 0 ORDER BY data LIMIT 100');
  if (!pendentes.length) return { enviados: 0 };

  const { error } = await c.from('checkins').upsert(
    pendentes.map((p) => ({
      membro_id: eu.id,
      liga_id: eu.ligaId,
      data: p.data,
      tipo: p.tipo,
      duracao_min: p.duracao_min,
      volume_kg: p.volume_kg,
      pontos: p.pontos,
    })),
    { onConflict: 'membro_id,data,tipo' }
  );
  if (error) return null;

  for (const p of pendentes) {
    await run('UPDATE checkin_log SET sincronizado = 1 WHERE id = ?', [p.id]);
  }
  return { enviados: pendentes.length };
}

// ── Liga ──────────────────────────────────────────────────────────────────

function codigoCurto(): string {
  // Sem 0/O/1/I: o código é ditado em voz alta no grupo do WhatsApp.
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');
}

export async function criarLiga(nome: string, metaSemanal: number): Promise<string | null> {
  const c = sb();
  if (!c) return null;
  const id = codigoCurto();
  const { error } = await c.from('ligas').insert({ id, nome, meta_semanal: metaSemanal });
  if (error) return null;
  await entrarNaLiga(id, getEu().apelido || 'Eu');
  return id;
}

export async function entrarNaLiga(ligaId: string, apelido: string, emoji = '💪'): Promise<boolean> {
  const c = sb();
  if (!c) return false;
  const eu = getEu();
  const { error } = await c
    .from('membros')
    .upsert({ id: eu.id, liga_id: ligaId.toUpperCase(), apelido, emoji }, { onConflict: 'id' });
  if (error) return false;
  salvarEu({ ligaId: ligaId.toUpperCase(), apelido, emoji });
  // Manda o histórico junto: entrar numa liga com ranking zerado desanima.
  await run('UPDATE checkin_log SET sincronizado = 0');
  await sincronizar();
  return true;
}

export interface LinhaRanking {
  membro_id: string;
  apelido: string;
  emoji: string;
  checkins: number;
  pontos: number;
  ultimo: string | null;
  souEu: boolean;
}

export async function ranking(desdeIso: string): Promise<LinhaRanking[] | null> {
  const c = sb();
  const eu = getEu();
  if (!c || !eu.ligaId) return null;
  const { data, error } = await c.rpc('ranking', { p_liga: eu.ligaId, p_desde: desdeIso });
  if (error || !data) return null;
  return (data as Omit<LinhaRanking, 'souEu'>[]).map((l) => ({ ...l, souEu: l.membro_id === eu.id }));
}

export async function infoLiga(): Promise<{ nome: string; meta_semanal: number } | null> {
  const c = sb();
  const eu = getEu();
  if (!c || !eu.ligaId) return null;
  const { data } = await c.from('ligas').select('nome, meta_semanal').eq('id', eu.ligaId).single();
  return (data as { nome: string; meta_semanal: number } | null) ?? null;
}

export async function sairDaLiga() {
  salvarEu({ ligaId: null });
}

// ── Liga solo ─────────────────────────────────────────────────────────────

export interface ResumoSolo {
  sequencia: number;
  pontosSemana: number;
  pontosTotal: number;
  checkinsSemana: number;
  /** Melhor semana já feita — o adversário de quem treina sozinho. */
  recordeSemana: number;
}

export async function resumoSolo(): Promise<ResumoSolo> {
  const seq = await sequenciaLocal();
  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7));
  const iso = inicioSemana.toISOString().slice(0, 10);

  const semana = await first<{ p: number; n: number }>(
    'SELECT COALESCE(SUM(pontos),0) AS p, COUNT(*) AS n FROM checkin_log WHERE data >= ?',
    [iso]
  );
  const total = await first<{ p: number }>('SELECT COALESCE(SUM(pontos),0) AS p FROM checkin_log');

  // Recorde: maior soma de pontos numa mesma semana ISO já registrada.
  const semanas = await all<{ p: number }>(
    `SELECT SUM(pontos) AS p FROM checkin_log
      GROUP BY strftime('%Y-%W', data) ORDER BY p DESC LIMIT 1`
  );

  return {
    sequencia: seq,
    pontosSemana: semana?.p ?? 0,
    pontosTotal: total?.p ?? 0,
    checkinsSemana: semana?.n ?? 0,
    recordeSemana: semanas[0]?.p ?? 0,
  };
}
