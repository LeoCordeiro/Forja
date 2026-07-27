import { all } from '@/db/client';

/**
 * Detecção de estagnação — e o que fazer com ela.
 *
 * "Não vi resultado" é o motivo número um de largar treino, e quase sempre
 * chega tarde: a pessoa percebe depois de dois meses parada no mesmo peso.
 * O dado para perceber em duas semanas já está no banco desde o primeiro dia
 * — só ninguém olha.
 *
 * ── O que este arquivo NÃO faz ───────────────────────────────────────────
 *
 * Não grita "você estagnou" e vai embora. Diagnóstico sem conduta é pior que
 * silêncio: cria ansiedade e não muda nada. Cada travamento aqui vem com a
 * causa mais provável dado o contexto e uma ação concreta.
 *
 * ── Por que 3 sessões ────────────────────────────────────────────────────
 *
 * Duas sessões iguais é ruído: dormiu mal, comeu pouco, dia ruim. Três seguidas
 * sem sair do lugar já é padrão. Menos que isso gera alarme falso, e alarme
 * falso ensina a ignorar o alarme.
 */

export interface Travado {
  exerciseId: number;
  nome: string;
  grupo: string;
  /** Sessões seguidas sem aumentar carga nem repetição. */
  sessoes: number;
  cargaAtual: number;
  repsAtual: number;
  diasNoMesmoPeso: number;
  causaProvavel: string;
  acao: string;
}

interface Ponto {
  exercise_id: number;
  nome: string;
  grupo_primario: string;
  iniciado_em: number;
  melhorCarga: number;
  melhorReps: number;
}

/**
 * Contexto que muda o diagnóstico.
 *
 * A mesma carga travada significa coisas diferentes em déficit calórico, em
 * quem dorme 5 h, ou em quem faz o exercício há 3 meses. Sem isso, o conselho
 * seria genérico — e conselho genérico é o que a internet já dá de graça.
 */
export interface ContextoEstagnacao {
  emDeficit: boolean;
  horasSonoMedia: number | null;
  semanaDoBloco: number;
  proteinaOk: boolean;
}

export async function detectarTravados(ctx: ContextoEstagnacao): Promise<Travado[]> {
  // Melhor série de cada exercício em cada sessão dos últimos 90 dias.
  const linhas = await all<Ponto>(
    `SELECT sl.exercise_id, e.nome, e.grupo_primario, ws.iniciado_em,
            MAX(COALESCE(sl.peso_kg,0)) AS melhorCarga,
            MAX(COALESCE(sl.reps,0))    AS melhorReps
       FROM set_logs sl
       JOIN workout_sessions ws ON ws.id = sl.session_id
       JOIN exercises e ON e.id = sl.exercise_id
      WHERE ws.finalizado_em IS NOT NULL
        AND ws.iniciado_em >= ?
        AND sl.peso_kg IS NOT NULL
      GROUP BY sl.exercise_id, ws.id
      ORDER BY sl.exercise_id, ws.iniciado_em DESC`,
    [Date.now() - 90 * 86400000]
  );

  const porExercicio = new Map<number, Ponto[]>();
  for (const l of linhas) {
    if (!porExercicio.has(l.exercise_id)) porExercicio.set(l.exercise_id, []);
    porExercicio.get(l.exercise_id)!.push(l);
  }

  const travados: Travado[] = [];

  for (const [id, pts] of porExercicio) {
    if (pts.length < 3) continue; // sem histórico suficiente para afirmar nada

    // Volume da melhor série é o critério: subir carga OU repetição conta como
    // progresso. Olhar só o peso marcaria como travado quem foi de 8 para 11
    // repetições — que é exatamente o caminho da progressão dupla.
    const score = (p: Ponto) => p.melhorCarga * Math.max(1, p.melhorReps);
    const recente = pts[0];
    let sessoes = 1;
    for (let i = 1; i < pts.length; i++) {
      if (score(pts[i]) >= score(recente) - 0.01) sessoes++;
      else break;
    }
    if (sessoes < 3) continue;

    const dias = Math.round((Date.now() - pts[sessoes - 1].iniciado_em) / 86400000);
    const { causaProvavel, acao } = diagnosticar(ctx, sessoes, dias, recente.grupo_primario);

    travados.push({
      exerciseId: id,
      nome: recente.nome,
      grupo: recente.grupo_primario,
      sessoes,
      cargaAtual: recente.melhorCarga,
      repsAtual: recente.melhorReps,
      diasNoMesmoPeso: dias,
      causaProvavel,
      acao,
    });
  }

  return travados.sort((a, b) => b.sessoes - a.sessoes);
}

function diagnosticar(
  ctx: ContextoEstagnacao,
  sessoes: number,
  dias: number,
  grupo: string
): { causaProvavel: string; acao: string } {
  // A ordem importa: a causa mais provável primeiro, não a mais interessante.
  if (ctx.horasSonoMedia !== null && ctx.horasSonoMedia < 6.5) {
    return {
      causaProvavel: `Sono de ${ctx.horasSonoMedia.toFixed(1)} h por noite. Abaixo de 6h30 a força cai antes de qualquer outra coisa — e cai primeiro justamente nos compostos.`,
      acao: 'Antes de mexer no treino, resolva o sono. Nenhum ajuste de série compensa isso.',
    };
  }

  if (!ctx.proteinaOk) {
    return {
      causaProvavel: 'Proteína abaixo do alvo nos últimos dias. Sem matéria-prima, o estímulo não vira tecido.',
      acao: 'Fechar a proteína por 2 semanas antes de concluir que o exercício é o problema.',
    };
  }

  if (ctx.emDeficit) {
    return {
      causaProvavel: `Você está em déficit calórico. Manter carga comendo menos já é vitória — ${sessoes} sessões estável não é estagnação, é preservação.`,
      acao: 'Não force carga agora. Segure o peso e busque 1 repetição a mais quando aparecer.',
    };
  }

  if (ctx.semanaDoBloco >= 7) {
    return {
      causaProvavel: 'Fim do bloco. A fadiga acumulada de 7 semanas mascara a força que você de fato ganhou.',
      acao: 'Faça a semana leve. A carga costuma subir sozinha na semana seguinte.',
    };
  }

  if (dias > 35) {
    return {
      causaProvavel: `${dias} dias no mesmo peso. Neste ponto o exercício já entregou o que tinha para entregar neste bloco.`,
      acao: `Troque por uma variação do mesmo padrão de movimento. O músculo continua o mesmo; o estímulo, não.`,
    };
  }

  const pequeno = ['biceps', 'triceps', 'panturrilha', 'ombro'].includes(grupo);
  return {
    causaProvavel: `${sessoes} sessões no mesmo número. Provavelmente o salto de carga pedido é grande demais para este exercício.`,
    acao: pequeno
      ? 'Suba 1,25 kg de cada lado em vez de 2,5 — em grupo pequeno o degrau padrão é alto demais.'
      : 'Adicione 1 série antes de adicionar carga. Volume destrava o que peso sozinho não destrava.',
  };
}

/** Também vale saber o que está subindo — só cobrança desanima. */
export async function evoluindo(dias = 60): Promise<{ nome: string; ganhoPct: number }[]> {
  const linhas = await all<{ nome: string; primeiro: number; ultimo: number }>(
    `SELECT e.nome,
            (SELECT MAX(s2.peso_kg) FROM set_logs s2
               JOIN workout_sessions w2 ON w2.id = s2.session_id
              WHERE s2.exercise_id = sl.exercise_id
              ORDER BY w2.iniciado_em ASC LIMIT 1) AS primeiro,
            MAX(sl.peso_kg) AS ultimo
       FROM set_logs sl
       JOIN workout_sessions ws ON ws.id = sl.session_id
       JOIN exercises e ON e.id = sl.exercise_id
      WHERE ws.iniciado_em >= ? AND sl.peso_kg IS NOT NULL
      GROUP BY sl.exercise_id`,
    [Date.now() - dias * 86400000]
  );

  return linhas
    .filter((l) => l.primeiro > 0 && l.ultimo > l.primeiro)
    .map((l) => ({
      nome: l.nome,
      ganhoPct: Math.round(((l.ultimo - l.primeiro) / l.primeiro) * 100),
    }))
    .sort((a, b) => b.ganhoPct - a.ganhoPct)
    .slice(0, 5);
}
