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
