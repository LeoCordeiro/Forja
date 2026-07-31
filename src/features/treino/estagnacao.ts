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

interface MelhorSerie {
  exercise_id: number;
  nome: string;
  grupo_primario: string;
  iniciado_em: number;
  peso_kg: number;
  reps: number;
  /** peso × reps DA MESMA série — o critério de progresso entre sessões. */
  score: number;
}

/**
 * A melhor série real de cada exercício em cada sessão da janela, da sessão
 * mais recente para a mais antiga.
 *
 * `MAX(sl.peso_kg * sl.reps)` como única agregação: o SQLite documenta que,
 * nesse caso, as colunas nuas (`sl.peso_kg`, `sl.reps`) vêm da linha
 * vencedora do MAX — peso e repetição da MESMA série. A versão anterior
 * agregava `MAX(peso)` e `MAX(reps)` separados, e uma pirâmide 100×5 + 80×12
 * virava o score fictício 100×12, que nenhuma série fez.
 *
 * Só série concluída e que não é aquecimento: série desmarcada ou de aquecer
 * não é desempenho — contá-la mascarava tanto o travamento quanto o avanço.
 */
async function melhoresSeriesPorSessao(dias: number): Promise<MelhorSerie[]> {
  return all<MelhorSerie>(
    `SELECT sl.exercise_id, e.nome, e.grupo_primario, ws.iniciado_em,
            sl.peso_kg, sl.reps,
            MAX(sl.peso_kg * sl.reps) AS score
       FROM set_logs sl
       JOIN workout_sessions ws ON ws.id = sl.session_id
       JOIN exercises e ON e.id = sl.exercise_id
      WHERE ws.finalizado_em IS NOT NULL
        AND ws.iniciado_em >= ?
        AND sl.concluida = 1
        AND sl.tipo <> 'aquecimento'
        AND sl.peso_kg IS NOT NULL
        AND sl.reps IS NOT NULL
      GROUP BY sl.exercise_id, ws.id
      ORDER BY sl.exercise_id, ws.iniciado_em DESC`,
    [Date.now() - dias * 86400000]
  );
}

/** Agrupa por exercício preservando a ordem (recente → antiga) da consulta. */
function porExercicio(linhas: MelhorSerie[]): Map<number, MelhorSerie[]> {
  const mapa = new Map<number, MelhorSerie[]>();
  for (const l of linhas) {
    if (!mapa.has(l.exercise_id)) mapa.set(l.exercise_id, []);
    mapa.get(l.exercise_id)!.push(l);
  }
  return mapa;
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
  const grupos = porExercicio(await melhoresSeriesPorSessao(90));
  const travados: Travado[] = [];

  for (const [id, pts] of grupos) {
    if (pts.length < 3) continue; // sem histórico suficiente para afirmar nada

    // Volume da melhor série é o critério: subir carga OU repetição conta como
    // progresso. Olhar só o peso marcaria como travado quem foi de 8 para 11
    // repetições — que é exatamente o caminho da progressão dupla.
    const recente = pts[0];
    let sessoes = 1;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].score >= recente.score - 0.01) sessoes++;
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
      // Da série vencedora, não de máximos soltos: é a carga e a repetição
      // que a pessoa reconhece como "onde eu estou" neste exercício.
      cargaAtual: recente.peso_kg,
      repsAtual: recente.reps,
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

/**
 * Também vale saber o que está subindo — só cobrança desanima.
 *
 * Compara o peso da melhor série da PRIMEIRA sessão do período com o da
 * ÚLTIMA, por exercício. A versão em SQL puro tinha uma subquery com MAX sem
 * GROUP BY que colapsava no máximo all-time — `ultimo > primeiro` nunca era
 * verdade e a lista nasceu vazia. Comparar em JS sobre as melhores séries é
 * verificável a olho.
 */
export async function evoluindo(dias = 60): Promise<{ nome: string; ganhoPct: number }[]> {
  const grupos = porExercicio(await melhoresSeriesPorSessao(dias));
  const out: { nome: string; ganhoPct: number }[] = [];

  for (const pts of grupos.values()) {
    if (pts.length < 2) continue; // uma sessão só não é tendência
    const ultimo = pts[0]; // a lista vem da mais recente para a mais antiga
    const primeiro = pts[pts.length - 1];
    if (primeiro.peso_kg > 0 && ultimo.peso_kg > primeiro.peso_kg) {
      out.push({
        nome: ultimo.nome,
        ganhoPct: Math.round(((ultimo.peso_kg - primeiro.peso_kg) / primeiro.peso_kg) * 100),
      });
    }
  }

  return out.sort((a, b) => b.ganhoPct - a.ganhoPct).slice(0, 5);
}
