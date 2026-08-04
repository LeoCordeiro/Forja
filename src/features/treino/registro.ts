import type { LinhaDeSerie } from './series';
import { pesoDeVolta } from './progressao';

/**
 * As regras do gesto de registrar uma série — puras, fora do componente.
 *
 * ── Por que isto existe ───────────────────────────────────────────────────
 *
 * A auditoria mediu o caminho mais frequente do app ("fiz a mesma carga de
 * sempre, marca aí") em 4 toques e 2 teclados; medido no app real a 390×844
 * eram **5 toques**, porque o pulo automático do peso para as repetições
 * abria o campo VAZIO — a herança só acontecia quando se tocava no campo
 * direto. Ou seja: a tela tinha duas regras de herança diferentes para a
 * mesma informação, e a pior delas estava no caminho automático.
 *
 * Com as regras aqui existe UMA regra, e ela é testável sem abrir o app:
 * `npm run testar:gerador`, seção 23, dirige a mesma função que a tela chama e
 * CONTA os toques. Enquanto isso morava dentro de `app/sessao/[id].tsx`, a
 * única forma de conferir a contagem era clicar 20 vezes no navegador.
 *
 * Mesma lição de `series.ts`, um nível acima: `serie_index` é posição, e a
 * remoção de linha mexe exatamente nisso.
 */

/** O mínimo de uma execução anterior que a herança precisa conhecer. */
export interface ExecucaoAnterior {
  peso_kg: number | null;
  reps: number | null;
  registrado_em: number;
}

export type CampoSerie = 'peso' | 'reps';

/**
 * O que muda a carga herdada nesta sessão.
 *
 * Os três casos são excludentes e a ordem importa: readaptação ganha da
 * progressão (semana de proteção não empurra carga), e progressão ganha da
 * repetição pura (bateu o topo da faixa → o caminho de menor atrito passa a
 * ser a carga nova). É a mesma ordem que o selo do cabeçalho usa — o número
 * herdado e o número prometido pelo selo têm que ser o mesmo.
 */
export interface ContextoHeranca {
  /** Exercício por tempo: o campo de carga ali guarda segundos, não kg. */
  porTempo: boolean;
  /** Rampa de volta: % da carga PRÉ-pausa. Null fora da readaptação. */
  readaptacao: { cargaPct: number; retomadaEmMs: number } | null;
  /** Progressão dupla mandou subir: a carga já calculada e arredondada. */
  pesoSugerido: number | null;
}

const virgula = (n: number) => String(n).replace('.', ',');

/** Quantos kg/reps a linha herda da última vez — a regra ÚNICA de herança. */
export function valorHerdado(
  campo: CampoSerie,
  ant: ExecucaoAnterior | undefined,
  ctx: ContextoHeranca
): string {
  if (!ant) return '';
  if (campo === 'reps') return ant.reps ? String(ant.reps) : '';
  // Só exercício com carga entra na modulação: 67% da prancha não é proteção
  // de tendão, é bug.
  if (ctx.porTempo || !ant.peso_kg) return '';
  if (ctx.readaptacao && ant.registrado_em < ctx.readaptacao.retomadaEmMs) {
    // O percentual da rampa é sobre a carga PRÉ-pausa. Série já registrada
    // depois da retomada carrega a redução embutida — reaplicar o percentual
    // sobre ela viraria queda geométrica (100 → 67 → 45…).
    return virgula(pesoDeVolta(ant.peso_kg, ctx.readaptacao.cargaPct));
  }
  if (ctx.pesoSugerido != null) return virgula(ctx.pesoSugerido);
  return virgula(ant.peso_kg);
}

/**
 * Põe a carga da última vez NO ESTADO da sessão, não no placeholder.
 *
 * O placeholder cinza dizia "já está preenchido, é só marcar" e marcar abria o
 * teclado — a tela prometendo um gesto que ela não entregava. Com o valor no
 * estado, o check grava em 1 toque e quem quer mudar toca no campo antes.
 *
 * `herdado` existe para a tela não MENTIR do outro jeito: valor emprestado da
 * semana passada aparece em tom de referência, valor digitado hoje aparece em
 * tom de dado. Some na primeira edição e na conclusão.
 */
export function prePreencher(
  linhas: LinhaDeSerie[],
  anteriores: ExecucaoAnterior[],
  ctx: ContextoHeranca
): LinhaDeSerie[] {
  return linhas.map((l, i) => {
    // Quem manda é o banco: série gravada nunca é sobrescrita.
    if (l.salvaId || l.concluida) return l;
    // Aproximação já nasce com a carga calculada por `anilhas.ts`.
    if (l.aquecimento) return l;
    // Digitado nesta sessão também não se toca.
    if (l.peso || l.reps) return l;

    const ant = anteriores[i] ?? anteriores[anteriores.length - 1];
    const peso = valorHerdado('peso', ant, ctx);
    const reps = valorHerdado('reps', ant, ctx);
    if (!peso && !reps) return l;
    return { ...l, peso, reps, herdado: true };
  });
}

/**
 * Qual campo ainda falta para a série poder ser gravada — ou null, se dá para
 * gravar direto. É a MESMA condição que `registrarSerie` valida.
 */
export function precisaTeclado(linha: LinhaDeSerie, porTempo: boolean): CampoSerie | null {
  if (porTempo) return null;
  if (!(parseFloat((linha.peso ?? '').replace(',', '.')) || null)) return 'peso';
  if (!(parseInt(linha.reps ?? '', 10) || null)) return 'reps';
  return null;
}

/**
 * Para onde o teclado vai depois do Confirmar.
 *
 * Pular do peso para as repetições era "o fluxo natural de quem registra"
 * quando as repetições nasciam vazias. Com a herança elas já vêm preenchidas,
 * e o pulo passou a ser um toque a mais para confirmar o que já estava certo.
 * Agora só pula quando falta mesmo.
 *
 * E NÃO conclui a série: o teclado é usado também para preparar a próxima
 * série durante o descanso ("na próxima eu ponho 85"). Concluir no Confirmar
 * gravaria uma série que ninguém fez — mentira mais cara do que um toque.
 */
export function campoDepoisDeConfirmar(campo: CampoSerie, linha: LinhaDeSerie): CampoSerie | null {
  if (campo !== 'peso') return null;
  return parseInt(linha.reps ?? '', 10) ? null : 'reps';
}

/**
 * Quantas linhas a reabertura do app devolveria para este exercício.
 *
 * É `hidratarSeries` visto do outro lado: o maior entre o alvo da semana e o
 * maior índice gravado + 1. Serve de piso para a remoção — remover abaixo
 * disso faria a linha voltar no próximo carregamento, que é exatamente a
 * incoerência que a auditoria descreveu ("o mesmo treino tem dois estados
 * dependendo de reabrir").
 */
export function pisoDeLinhas(linhas: LinhaDeSerie[], alvoDaSemana: number): number {
  const maiorGravado = linhas.reduce((m, l, i) => (l.salvaId ? Math.max(m, i + 1) : m), 0);
  return Math.max(alvoDaSemana, maiorGravado);
}

/**
 * Tira uma linha de série — ou recusa, com o motivo escrito.
 *
 * Três recusas, e nenhuma é preciosismo:
 *
 * 1. **Linha já gravada.** Apagar aqui deixaria o `set_log` no banco sem linha
 *    na tela. Desmarcar é o caminho certo: ele apaga o registro E recalcula os
 *    PRs derivados (regra 5 do AGENTS.md).
 * 2. **Série gravada DEPOIS desta.** `serie_index` é a POSIÇÃO no array —
 *    remover no meio renumera tudo que vem depois, e na reabertura
 *    `hidratarSeries` devolve as gravadas nos índices antigos. Tela e banco
 *    passariam a discordar em silêncio, que é como o aquecimento sumiu em G2.
 * 3. **Abaixo do piso.** A linha voltaria na próxima abertura. Recusar é dizer
 *    a verdade; permitir seria fingir que removeu.
 *
 * A recusa é FRASE, não `false`: quem tocou precisa saber por que nada mudou.
 */
export function removerSerie(
  linhas: LinhaDeSerie[],
  idx: number,
  piso: number
): { linhas: LinhaDeSerie[]; recusa?: undefined } | { recusa: string; linhas?: undefined } {
  const alvo = linhas[idx];
  if (!alvo) return { recusa: 'Esta série não está mais aqui.' };
  if (alvo.salvaId) {
    return {
      recusa:
        'Esta série já está gravada. Desmarque primeiro — desmarcar apaga o registro e refaz os recordes.',
    };
  }
  if (linhas.slice(idx + 1).some((l) => l.salvaId)) {
    return {
      recusa: 'Tem série gravada depois desta. Remover agora trocaria o número das que já foram.',
    };
  }
  if (linhas.length <= piso) {
    return {
      recusa: `Seu plano pede ${piso} séries aqui. Se eu tirasse, ela voltaria na próxima vez que o treino abrisse.`,
    };
  }
  return { linhas: linhas.filter((_, i) => i !== idx) };
}
