import type { SerieAquecimento } from './anilhas';

/**
 * As linhas de série da tela de execução — e as duas operações que mexem nelas.
 *
 * ── Por que isto saiu da tela ────────────────────────────────────────────
 *
 * `serie_index` no banco é a POSIÇÃO da linha no array da tela. Não é detalhe
 * de implementação: é o contrato que a reabertura usa para devolver cada série
 * ao lugar dela (`salvas.find(s => s.serie_index === i)`). Qualquer operação
 * que insira linha ANTES de uma já gravada quebra esse contrato em silêncio, e
 * o estrago só aparece no recarregamento — que num PWA acontece no meio do
 * treino, sem aviso.
 *
 * Foi exatamente o que a criação de aproximações fazia: com a série 1 já
 * gravada (`serie_index = 0`), o prepend empurrava tudo e o aquecimento nascia
 * também com `serie_index = 0`. Na reabertura, `find` devolvia só a primeira
 * das duas: **o aquecimento sumia da tela e ficava em `set_logs` sem `salvaId`,
 * sem como desmarcar nem corrigir** — a regra 5 do AGENTS.md ("séries são
 * editáveis e removíveis de verdade") quebrada, e uma linha vazia aparecendo no
 * lugar errado de quebra.
 *
 * Com as duas operações aqui, elas rodam no app E no teste. Enquanto moravam
 * dentro do componente, a única forma de conferir era abrir o app, gravar uma
 * série, tocar um botão e recarregar a página na mão.
 */
export interface LinhaDeSerie {
  peso: string;
  reps: string;
  concluida: boolean;
  /** id em `set_logs`. Presente = já existe linha no banco para esta posição. */
  salvaId?: number;
  aquecimento?: boolean;
  /**
   * O valor veio da última sessão, não do dedo de hoje.
   *
   * Existe para a tela conseguir dizer as duas coisas ao mesmo tempo: "isto é
   * o que vou gravar se você marcar" e "isto ainda é a semana passada". Sem a
   * marca, pré-preencher trocaria um defeito (placeholder que não é estado)
   * por outro (número que parece digitado e não foi). Some na primeira edição
   * e na conclusão — ver `registro.ts`.
   */
  herdado?: boolean;
}

/** O que a reabertura lê do banco. */
export interface SerieSalva {
  id: number;
  serie_index: number;
  peso_kg: number | null;
  reps: number | null;
  tipo: string;
}

/**
 * Reconstrói as linhas da tela a partir do que está no banco.
 *
 * O total é o maior entre o alvo da semana e o maior índice gravado + 1: com
 * índices esparsos (série 3 gravada, série 1 desmarcada) contar linhas
 * esconderia série que continua no banco.
 */
export function hidratarSeries(salvas: SerieSalva[], alvoDaSemana: number): LinhaDeSerie[] {
  const total = Math.max(
    alvoDaSemana,
    salvas.length ? Math.max(...salvas.map((x) => x.serie_index)) + 1 : 0
  );
  return Array.from({ length: total }, (_, i) => {
    const salva = salvas.find((s) => s.serie_index === i);
    return salva
      ? {
          peso: salva.peso_kg ? String(salva.peso_kg).replace('.', ',') : '',
          reps: salva.reps ? String(salva.reps) : '',
          concluida: true,
          salvaId: salva.id,
          aquecimento: salva.tipo === 'aquecimento',
        }
      : { peso: '', reps: '', concluida: false };
  });
}

/**
 * Põe as aproximações na frente — ou recusa, com o motivo escrito.
 *
 * Recusa quando já existe série gravada, porque aí o prepend renumeraria linhas
 * que o banco já endereçou por posição. A alternativa (renumerar as gravadas)
 * exigiria UPDATE em `set_logs` de linhas concluídas para consertar uma
 * conveniência de tela — mexer no histórico para acomodar um botão é o caminho
 * mais curto para o histórico deixar de ser confiável.
 *
 * E a recusa é uma FRASE, não um `false`: quem tocou o botão precisa saber por
 * que nada aconteceu.
 */
export function inserirAproximacoes(
  linhas: LinhaDeSerie[],
  passos: SerieAquecimento[]
): { linhas: LinhaDeSerie[]; recusa?: undefined } | { recusa: string; linhas?: undefined } {
  if (!passos.length) {
    return { recusa: 'Sem carga conhecida para calcular a aproximação.' };
  }
  if (linhas.some((l) => l.salvaId)) {
    return { recusa: 'Aproximação é antes da primeira série valendo. Este exercício já começou.' };
  }

  return {
    linhas: [
      ...passos.map((p) => ({
        peso: String(p.peso).replace('.', ','),
        reps: String(p.reps),
        concluida: false,
        aquecimento: true,
      })),
      // Aproximação criada duas vezes não empilha: a anterior, ainda não
      // gravada, dá lugar à nova.
      ...linhas.filter((l) => !l.aquecimento),
    ],
  };
}

/** Quantas séries VALENDO existem até esta posição — a numeração que a tela mostra. */
export function numeroValendo(linhas: LinhaDeSerie[], idx: number): number {
  return linhas.slice(0, idx + 1).filter((l) => !l.aquecimento).length;
}
