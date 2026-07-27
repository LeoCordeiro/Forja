import { all, first, run } from '@/db/client';
import { hoje } from '@/shared/utils/date';
import { darPontos } from '../gamificacao/api';

export async function registrarSessao(rotina: string, duracaoSeg: number) {
  await run(
    'INSERT INTO mobilidade_log (data, rotina, duracao_seg, criado_em) VALUES (?,?,?,?)',
    [hoje(), rotina, duracaoSeg, Date.now()]
  );
  // Pontua menos que treino: é complemento, não substituto.
  await darPontos(15, 'mobilidade', undefined, 'Sessão de mobilidade');
}

export async function sessoesDoDia(data = hoje()) {
  return all<{ id: number; rotina: string; duracao_seg: number }>(
    'SELECT id, rotina, duracao_seg FROM mobilidade_log WHERE data = ?',
    [data]
  );
}

export async function totalSessoes(): Promise<number> {
  const r = await first<{ n: number }>('SELECT COUNT(*) AS n FROM mobilidade_log');
  return r?.n ?? 0;
}

export interface HistoricoMobilidade {
  /** Quantos dias distintos com mobilidade nos últimos 7. */
  diasNaSemana: number;
  totalSessoes: number;
  ultima: { rotina: string; data: string; diasAtras: number } | null;
  /** Quantas vezes cada rotina foi feita — alimenta o "você nunca fez esta". */
  porRotina: Record<string, number>;
}

/**
 * Frequência ganha de duração aqui.
 *
 * Cinco minutos todo dia rendem mais que quarenta minutos uma vez por semana:
 * tecido conjuntivo responde a estímulo repetido, não a maratona. Por isso o
 * número que a tela mostra é "dias na semana", não "minutos acumulados".
 */
export async function historicoMobilidade(): Promise<HistoricoMobilidade> {
  const linhas = await all<{ data: string; rotina: string; criado_em: number }>(
    'SELECT data, rotina, criado_em FROM mobilidade_log ORDER BY criado_em DESC LIMIT 200'
  );

  const limite = Date.now() - 7 * 86400000;
  const dias = new Set(linhas.filter((l) => l.criado_em >= limite).map((l) => l.data));

  const porRotina: Record<string, number> = {};
  for (const l of linhas) porRotina[l.rotina] = (porRotina[l.rotina] ?? 0) + 1;

  const u = linhas[0];
  return {
    diasNaSemana: dias.size,
    totalSessoes: linhas.length,
    porRotina,
    ultima: u
      ? {
          rotina: u.rotina,
          data: u.data,
          diasAtras: Math.floor((Date.now() - u.criado_em) / 86400000),
        }
      : null,
  };
}
