import { all, first, run } from '@/db/client';
import { hoje } from '@/shared/utils/date';

/**
 * Passos do dia.
 *
 * A variável mais subestimada em perda de gordura, e por um motivo simples:
 * ela aumenta o gasto diário sem cobrar recuperação. Três mil passos a mais
 * não atrapalham o treino de amanhã — trinta minutos de corrida atrapalham.
 *
 * Em quem come em déficit, o gasto por atividade não-exercício (NEAT) é
 * justamente o que o corpo corta primeiro, e sem medir ninguém percebe: a
 * pessoa jura que está fazendo tudo igual e o gasto caiu 300 kcal por dia.
 * Contar passos é o jeito barato de enxergar essa queda.
 *
 * O app não lê o pedômetro do celular — leitura de sensor de saúde exigiria
 * permissão de dados sensíveis e biblioteca nativa. O número entra à mão,
 * copiado do app de saúde. Toque a mais por dia, zero dado seu saindo daqui.
 */

export interface DiaPassos {
  data: string;
  passos: number;
}

export async function registrarPassos(passos: number, data = hoje()) {
  await run(
    `INSERT INTO passos_log (data, passos, criado_em) VALUES (?,?,?)
     ON CONFLICT(data) DO UPDATE SET passos = excluded.passos`,
    [data, passos, Date.now()]
  );
}

export async function passosDoDia(data = hoje()): Promise<number> {
  const r = await first<{ passos: number }>('SELECT passos FROM passos_log WHERE data = ?', [data]);
  return r?.passos ?? 0;
}

export async function historicoPassos(dias = 30): Promise<DiaPassos[]> {
  const r = await all<DiaPassos>(
    'SELECT data, passos FROM passos_log ORDER BY data DESC LIMIT ?',
    [dias]
  );
  return r.reverse();
}

export interface ResumoPassos {
  hoje: number;
  alvo: number;
  /** Média dos últimos 7 dias com registro. */
  media7: number;
  /** Dias que bateram o alvo nos últimos 7. */
  diasNaMeta: number;
  /** Estimativa de gasto extra pelos passos acima do sedentário. */
  kcalExtra: number;
  mensagem: string;
}

/**
 * Gasto por passo ≈ 0,04 kcal/kg — regra prática que sai da economia de
 * caminhada (~0,5 kcal por kg por km, com passada média de 0,75 m). Serve para
 * dar ordem de grandeza, não para fechar conta calórica.
 */
export function kcalDePassos(passos: number, pesoKg: number): number {
  return Math.round(passos * 0.0004 * pesoKg);
}

export async function resumoPassos(alvo: number, pesoKg: number): Promise<ResumoPassos> {
  const hist = await historicoPassos(7);
  const h = await passosDoDia();
  const comRegistro = hist.filter((d) => d.passos > 0);
  const media7 = comRegistro.length
    ? Math.round(comRegistro.reduce((a, d) => a + d.passos, 0) / comRegistro.length)
    : 0;
  const diasNaMeta = hist.filter((d) => d.passos >= alvo).length;

  // Base sedentária de 4 mil: só o que passa disso é ganho de verdade.
  const kcalExtra = kcalDePassos(Math.max(0, media7 - 4000), pesoKg);

  let mensagem: string;
  if (h === 0) {
    mensagem = 'Copie o número do app de saúde do celular. Leva cinco segundos.';
  } else if (h >= alvo) {
    mensagem = `Meta batida. Isso são cerca de ${kcalDePassos(Math.max(0, h - 4000), pesoKg)} kcal a mais gastas hoje, sem tirar nada da recuperação.`;
  } else {
    const faltam = alvo - h;
    mensagem = `Faltam ${faltam.toLocaleString('pt-BR')} passos — dá uns ${Math.round(faltam / 110)} minutos de caminhada.`;
  }

  return { hoje: h, alvo, media7, diasNaMeta, kcalExtra, mensagem };
}
