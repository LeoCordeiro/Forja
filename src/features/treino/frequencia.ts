import { all } from '@/db/client';
import { hoje, isoDe } from '@/shared/utils/date';

/**
 * Frequência semanal — o calendário que aparece na home.
 *
 * Ver os dias marcados é o feedback mais barato que existe: dois quadradinhos
 * apagados no meio da semana dizem mais do que qualquer gráfico.
 */

export interface DiaSemana {
  data: string;
  diaSemana: number;
  letra: string;
  treinou: boolean;
  volume: number;
  nome: string | null;
  hoje: boolean;
  futuro: boolean;
}

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Segunda-feira da semana da data informada. */
function inicioDaSemana(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  // getDay(): 0 = domingo. Queremos a semana começando na segunda.
  const desloc = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - desloc);
  return dt;
}

export async function semanaAtual(referencia = hoje()): Promise<DiaSemana[]> {
  const inicio = inicioDaSemana(referencia);
  const dias: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    dias.push(isoDe(d));
  }

  /**
   * O agrupamento por dia acontece no JS, não no SQL.
   *
   * `date(..., 'localtime')` não serve: no SQLite compilado para WebAssembly
   * não existe fuso do sistema, então 'localtime' é UTC. Treino das 21h de
   * Brasília (00h UTC) era contabilizado no dia seguinte — o quadradinho de
   * hoje ficava vazio e o de amanhã aparecia marcado.
   */
  const inicioMs = new Date(inicio).setHours(0, 0, 0, 0);
  const fimMs = inicioMs + 7 * 86400000;

  const treinos = await all<{ iniciado_em: number; volume: number; nome: string }>(
    `SELECT iniciado_em, COALESCE(volume_total_kg,0) AS volume, nome
       FROM workout_sessions
      WHERE finalizado_em IS NOT NULL
        AND iniciado_em >= ? AND iniciado_em < ?`,
    [inicioMs, fimMs]
  );

  const mapa = new Map<string, { volume: number; nome: string }>();
  for (const t of treinos) {
    const chave = isoDe(new Date(t.iniciado_em));
    const atual = mapa.get(chave);
    mapa.set(chave, {
      volume: (atual?.volume ?? 0) + t.volume,
      nome: atual?.nome ?? t.nome,
    });
  }
  const h = hoje();

  return dias.map((data) => {
    const t = mapa.get(data);
    const [y, m, d] = data.split('-').map(Number);
    const ds = new Date(y, m - 1, d).getDay();
    return {
      data,
      diaSemana: ds,
      letra: LETRAS[ds],
      treinou: !!t,
      volume: t?.volume ?? 0,
      nome: t?.nome ?? null,
      hoje: data === h,
      futuro: data > h,
    };
  });
}

export interface ResumoSemana {
  dias: DiaSemana[];
  feitos: number;
  meta: number;
  restantes: number;
  diasUteisRestantes: number;
  /** true quando ainda dá para bater a meta com os dias que sobram. */
  alcancavel: boolean;
  mensagem: string;
}

export async function resumoSemana(metaDias: number): Promise<ResumoSemana> {
  const dias = await semanaAtual();
  const feitos = dias.filter((d) => d.treinou).length;
  const restantes = Math.max(0, metaDias - feitos);
  const diasUteisRestantes = dias.filter((d) => d.futuro || d.hoje).length;
  const alcancavel = restantes <= diasUteisRestantes;

  let mensagem: string;
  if (feitos >= metaDias) {
    mensagem = `Meta da semana batida: ${feitos} de ${metaDias} treinos.`;
  } else if (restantes === 0) {
    mensagem = 'Semana completa.';
  } else if (!alcancavel) {
    // Sem culpa: a semana já passou, o que importa é a próxima.
    mensagem = `Faltam ${restantes} e sobram ${diasUteisRestantes} dias. Fecha o que der e retoma na segunda.`;
  } else if (restantes === diasUteisRestantes) {
    mensagem = `Faltam ${restantes} treinos em ${diasUteisRestantes} dias — não dá para pular nenhum.`;
  } else {
    mensagem = `Faltam ${restantes} treino${restantes > 1 ? 's' : ''} nesta semana.`;
  }

  return { dias, feitos, meta: metaDias, restantes, diasUteisRestantes, alcancavel, mensagem };
}

/** Média de treinos por semana nas últimas N semanas — mede consistência real. */
export async function mediaSemanal(semanas = 4): Promise<number> {
  const r = await all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workout_sessions
      WHERE finalizado_em IS NOT NULL
        AND iniciado_em >= ?`,
    [Date.now() - semanas * 7 * 86400000]
  );
  return Math.round(((r[0]?.n ?? 0) / semanas) * 10) / 10;
}

/** Dias desde o último treino — usado para avisar quando a pausa está esticando. */
export async function diasSemTreinar(): Promise<number | null> {
  const r = await all<{ ultimo: number }>(
    'SELECT MAX(iniciado_em) AS ultimo FROM workout_sessions WHERE finalizado_em IS NOT NULL'
  );
  const ultimo = r[0]?.ultimo;
  if (!ultimo) return null;
  return Math.floor((Date.now() - ultimo) / 86400000);
}
