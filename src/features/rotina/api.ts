import { all, first, run } from '@/db/client';
import { hoje, ultimosDias } from '@/shared/utils/date';
import { totalDoDia as aguaDoDia } from '../agua/api';
import { macrosDoDia } from '../dieta/api';
import { sessoesDoDia as mobilidadeDoDia } from '../mobilidade/api';

/**
 * Checklist do dia.
 *
 * Vida fitness é rotina, e rotina se sustenta quando é visível. Um item que o
 * app consegue verificar sozinho (treinou? bebeu água?) nunca deveria pedir
 * marcação manual — marcar à mão o que o sistema já sabe é atrito puro, e
 * atrito é o que faz alguém largar.
 */

export interface ItemRotina {
  chave: string;
  titulo: string;
  emoji: string;
  horario: string | null;
  automatico: boolean;
  concluido: boolean;
  detalhe?: string;
  rota?: string;
}

const PADRAO: {
  chave: string;
  titulo: string;
  emoji: string;
  horario: string | null;
  automatico: number;
  ordem: number;
}[] = [
  { chave: 'pesar', titulo: 'Pesar em jejum', emoji: '⚖️', horario: '07:00', automatico: 1, ordem: 0 },
  { chave: 'cafe', titulo: 'Café da manhã', emoji: '🍳', horario: '07:30', automatico: 1, ordem: 1 },
  { chave: 'treino', titulo: 'Treinar', emoji: '🏋️', horario: null, automatico: 1, ordem: 2 },
  { chave: 'almoco', titulo: 'Almoço', emoji: '🍽️', horario: '12:30', automatico: 1, ordem: 3 },
  { chave: 'agua', titulo: 'Bater a meta de água', emoji: '💧', horario: null, automatico: 1, ordem: 4 },
  { chave: 'jantar', titulo: 'Jantar', emoji: '🌙', horario: '19:30', automatico: 1, ordem: 5 },
  { chave: 'mobilidade', titulo: 'Alongar', emoji: '🧘', horario: null, automatico: 1, ordem: 6 },
  { chave: 'sono', titulo: 'Dormir 7h ou mais', emoji: '😴', horario: '23:00', automatico: 1, ordem: 7 },
];

export async function garantirItens() {
  const r = await first<{ n: number }>('SELECT COUNT(*) AS n FROM rotina_itens');
  if ((r?.n ?? 0) > 0) return;
  for (const i of PADRAO) {
    await run(
      `INSERT OR IGNORE INTO rotina_itens (chave, titulo, emoji, horario, automatico, ordem)
       VALUES (?,?,?,?,?,?)`,
      [i.chave, i.titulo, i.emoji, i.horario, i.automatico, i.ordem]
    );
  }
}

/**
 * Monta o checklist de hoje.
 *
 * Cada item automático consulta a própria fonte de verdade — treino olha as
 * sessões, água olha o total do dia. Só o que o app não tem como saber sozinho
 * fica marcável à mão.
 */
export async function checklistDoDia(data = hoje(), metaAguaMl = 2500): Promise<ItemRotina[]> {
  await garantirItens();

  const defs = await all<{
    chave: string;
    titulo: string;
    emoji: string;
    horario: string | null;
    automatico: number;
  }>('SELECT chave, titulo, emoji, horario, automatico FROM rotina_itens WHERE ativo = 1 ORDER BY ordem');

  const manuais = await all<{ chave: string }>(
    'SELECT chave FROM rotina_log WHERE data = ? AND concluido = 1',
    [data]
  );
  const marcados = new Set(manuais.map((m) => m.chave));

  const [treinou, agua, refeicoes, mobilidade, sono, pesou] = await Promise.all([
    first<{ n: number; nome: string }>(
      `SELECT COUNT(*) AS n, MAX(nome) AS nome FROM workout_sessions
        WHERE finalizado_em IS NOT NULL
          AND date(iniciado_em/1000, 'unixepoch', 'localtime') = ?`,
      [data]
    ),
    aguaDoDia(data),
    all<{ tipo: string }>('SELECT tipo FROM meal_logs WHERE data = ?', [data]),
    mobilidadeDoDia(data),
    first<{ horas: number }>('SELECT horas FROM sono_log WHERE data = ?', [data]),
    first<{ n: number }>('SELECT COUNT(*) AS n FROM body_metrics WHERE medido_em = ?', [data]),
  ]);

  const tiposComidos = new Set(refeicoes.map((r) => r.tipo));
  const macros = await macrosDoDia(data);

  return defs.map((d) => {
    let concluido = marcados.has(d.chave);
    let detalhe: string | undefined;
    let rota: string | undefined;

    switch (d.chave) {
      case 'treino':
        concluido = (treinou?.n ?? 0) > 0;
        detalhe = concluido ? treinou?.nome : 'Nenhum treino hoje';
        rota = '/treino';
        break;
      case 'agua':
        concluido = agua >= metaAguaMl;
        detalhe = `${(agua / 1000).toFixed(1).replace('.', ',')} L de ${(metaAguaMl / 1000)
          .toFixed(1)
          .replace('.', ',')} L`;
        rota = '/agua';
        break;
      case 'cafe':
      case 'almoco':
      case 'jantar':
        concluido = tiposComidos.has(d.chave);
        detalhe = concluido ? 'Registrado' : 'Não registrado';
        rota = '/dieta';
        break;
      case 'mobilidade':
        concluido = mobilidade.length > 0;
        detalhe = concluido ? `${mobilidade.length} sessão(ões)` : 'Nenhuma sessão';
        rota = '/mobilidade';
        break;
      case 'sono':
        concluido = (sono?.horas ?? 0) >= 7;
        detalhe = sono ? `${String(sono.horas).replace('.', ',')} h` : 'Não registrado';
        break;
      case 'pesar':
        concluido = (pesou?.n ?? 0) > 0;
        detalhe = concluido ? 'Registrado' : 'Não registrado';
        rota = '/evolucao';
        break;
    }

    return {
      chave: d.chave,
      titulo: d.titulo,
      emoji: d.emoji,
      horario: d.horario,
      automatico: !!d.automatico,
      concluido,
      detalhe,
      rota,
    };
  });
}

export async function marcarManual(chave: string, data = hoje()) {
  await run(
    `INSERT INTO rotina_log (chave, data, concluido, registrado_em) VALUES (?,?,1,?)
     ON CONFLICT(chave, data) DO UPDATE SET concluido = 1 - rotina_log.concluido`,
    [chave, data, Date.now()]
  );
}

export async function registrarSono(horas: number, qualidade?: number, data = hoje()) {
  await run(
    `INSERT INTO sono_log (data, horas, qualidade, criado_em) VALUES (?,?,?,?)
     ON CONFLICT(data) DO UPDATE SET horas = excluded.horas, qualidade = excluded.qualidade`,
    [data, horas, qualidade ?? null, Date.now()]
  );
}

export async function sonoRecente(dias = 7) {
  const desde = ultimosDias(dias)[0];
  return all<{ data: string; horas: number; qualidade: number | null }>(
    'SELECT data, horas, qualidade FROM sono_log WHERE data >= ? ORDER BY data',
    [desde]
  );
}

/** Percentual de itens cumpridos — vira o número de constância da home. */
export async function aderencia(dias = 7, metaAguaMl = 2500): Promise<number> {
  const datas = ultimosDias(dias);
  let feitos = 0;
  let total = 0;
  for (const d of datas) {
    const itens = await checklistDoDia(d, metaAguaMl);
    feitos += itens.filter((i) => i.concluido).length;
    total += itens.length;
  }
  return total > 0 ? Math.round((feitos / total) * 100) : 0;
}
