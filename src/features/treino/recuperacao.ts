import { all } from '@/db/client';

/**
 * Mapa de recuperação por grupo muscular.
 *
 * Responde a pergunta que se faz no vestiário: "dá para treinar peito hoje ou
 * ainda tá acabado de terça?".
 *
 * ── Como o número sai ────────────────────────────────────────────────────
 *
 * Síntese proteica muscular fica elevada por volta de 24 a 48 h depois do
 * treino em quem já treina, e mais tempo em iniciante. Fadiga e dano seguem
 * curva parecida: a maior parte se resolve em 48 h, o resto vai até uns
 * 3 dias em grupo grande com volume alto.
 *
 * Então a recuperação aqui é uma curva de tempo desde o último estímulo,
 * ajustada por quanto volume aquele grupo levou. Vinte séries de perna não
 * recuperam no mesmo prazo que seis.
 *
 * **Isto é estimativa, não medição.** Não existe sensor no app; o que existe
 * é o histórico de séries. Serve para evitar empilhar o mesmo grupo em dias
 * seguidos sem perceber — não para substituir o que o corpo está dizendo.
 * Por isso a tela mostra o número junto da frase que o relativiza.
 */

export interface RecuperacaoGrupo {
  grupo: string;
  /** 0 a 1. 1 = recuperado. */
  pronto: number;
  horasDesde: number | null;
  /** Séries que o grupo levou na última vez (diretas + metade das indiretas). */
  seriesUltimaVez: number;
  estado: 'pronto' | 'quase' | 'cansado' | 'acabado';
}

const GRUPOS = [
  'peito',
  'costas',
  'ombro',
  'biceps',
  'triceps',
  'quadriceps',
  'posterior',
  'gluteo',
  'panturrilha',
  'abdomen',
];

/**
 * Horas para recuperar, em função do volume levado.
 *
 * Base de 48 h, subindo até 72 h quando o volume passa de 15 séries e caindo
 * para 24 h em sessão leve. Grupos pequenos recuperam mais rápido.
 */
function horasNecessarias(series: number, grupo: string): number {
  const pequeno = ['biceps', 'triceps', 'panturrilha', 'abdomen'].includes(grupo);
  const base = pequeno ? 36 : 48;
  if (series <= 4) return base * 0.6;
  if (series >= 15) return base * 1.5;
  return base * (0.6 + (series - 4) * 0.082);
}

export async function mapaDeRecuperacao(): Promise<RecuperacaoGrupo[]> {
  // Só os últimos 10 dias: além disso tudo está recuperado de qualquer forma.
  const desde = Date.now() - 10 * 86400000;

  const linhas = await all<{
    iniciado_em: number;
    grupo_primario: string;
    grupos_secundarios: string;
    n: number;
  }>(
    `SELECT ws.iniciado_em, e.grupo_primario, e.grupos_secundarios, COUNT(sl.id) AS n
       FROM set_logs sl
       JOIN workout_sessions ws ON ws.id = sl.session_id
       JOIN exercises e ON e.id = sl.exercise_id
      WHERE ws.iniciado_em >= ?
      GROUP BY ws.iniciado_em, e.id`,
    [desde]
  );

  // Para cada grupo: quando foi o último estímulo e quanto levou naquele dia.
  const ultimo = new Map<string, { quando: number; series: number }>();

  const registrar = (grupo: string, quando: number, series: number) => {
    const atual = ultimo.get(grupo);
    if (!atual || quando > atual.quando) {
      ultimo.set(grupo, { quando, series });
    } else if (quando === atual.quando) {
      atual.series += series;
    }
  };

  for (const l of linhas) {
    registrar(l.grupo_primario, l.iniciado_em, l.n);
    for (const sec of l.grupos_secundarios.split(',').map((x) => x.trim()).filter(Boolean)) {
      // Indireta pesa metade, mesma lógica da auditoria de volume.
      registrar(sec, l.iniciado_em, l.n * 0.5);
    }
  }

  return GRUPOS.map((grupo) => {
    const u = ultimo.get(grupo);
    if (!u) {
      return {
        grupo,
        pronto: 1,
        horasDesde: null,
        seriesUltimaVez: 0,
        estado: 'pronto' as const,
      };
    }
    const horas = (Date.now() - u.quando) / 3600000;
    const necessarias = horasNecessarias(u.series, grupo);
    const pronto = Math.min(1, horas / necessarias);
    return {
      grupo,
      pronto,
      horasDesde: Math.round(horas),
      seriesUltimaVez: Math.round(u.series * 10) / 10,
      estado:
        pronto >= 0.95
          ? ('pronto' as const)
          : pronto >= 0.7
            ? ('quase' as const)
            : pronto >= 0.4
              ? ('cansado' as const)
              : ('acabado' as const),
    };
  }).sort((a, b) => a.pronto - b.pronto);
}

export const ROTULO_ESTADO = {
  pronto: 'pronto',
  quase: 'quase lá',
  cansado: 'ainda cansado',
  acabado: 'acabado',
} as const;

/**
 * Sugestão de qual grupo treinar hoje: o mais recuperado que também está
 * devendo volume. Recuperado sozinho não basta — panturrilha fica sempre
 * pronta e nem por isso deve abrir todo treino.
 */
export function sugerirFoco(mapa: RecuperacaoGrupo[]): string | null {
  const grandes = ['peito', 'costas', 'quadriceps', 'ombro', 'posterior'];
  const candidatos = mapa
    .filter((m) => grandes.includes(m.grupo) && m.pronto >= 0.9)
    .sort((a, b) => (b.horasDesde ?? 9999) - (a.horasDesde ?? 9999));
  return candidatos[0]?.grupo ?? null;
}
