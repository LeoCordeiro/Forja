import { padraoDe, perfilDeResistencia } from './classificacao';

/**
 * B8 — variar o estímulo entre ciclos sem perder comparabilidade.
 *
 * A tensão que este arquivo resolve é antiga e real: variedade e progressão
 * puxam para lados opostos. Trocar exercício toda semana deixa o treino
 * interessante e a progressão invisível; nunca trocar deixa a progressão nítida
 * e o estímulo estagnado num punhado de padrões.
 *
 * A saída de B8 é não tratar isso como um dial único, e sim como TRÊS níveis com
 * escopos diferentes — de forma que a comparabilidade fique inteira no nível 0 e
 * a variedade viva nos níveis 1 e 2, que não entram no gráfico.
 *
 * ── Nível 0 — a âncora. Não muda dentro do bloco (8 semanas) ─────────────
 *
 * O PRINCIPAL de cada grupo, na posição 1, com o mesmo nome e a mesma faixa de
 * repetições o bloco inteiro. É a única série cuja carga alimenta o gráfico e o
 * e1RM.
 *
 * Isso já existia por construção — e não estava garantido. Medido nesta rodada,
 * num perfil de casa com halteres e 3 dias: o peito abria o dia A com
 * `Supino inclinado com halteres` (principal) e o dia B com `Supino reto com
 * halteres` (principal). Dois exercícios diferentes alimentando o MESMO gráfico
 * dentro do MESMO bloco. A causa é a de sempre neste pipeline: um passo posterior
 * (o corte por tempo) removeu o primeiro exercício de um dos dias, e quem sobrou
 * virou principal sem ninguém reavaliar o bloco. `fixarPrincipalDoBloco` fecha
 * isso depois de todo mundo que remove exercício.
 *
 * ── Nível 1 — entre blocos ───────────────────────────────────────────────
 *
 * No bloco novo o principal PODE trocar, **dentro do mesmo padrão**. Quando
 * troca, o app quebra a curva do gráfico explicitamente: nova âncora, nova linha
 * de base, duas curvas separadas. Fingir continuidade entre exercícios diferentes
 * é pior que admitir a quebra — um ponto de supino com halteres colado ao fim da
 * série do supino com barra não é progresso nem regressão, é ruído com cara de
 * dado.
 *
 * ── Nível 2 — entre sessões dentro do bloco ──────────────────────────────
 *
 * Só complementares e isoladores, rodízio DENTRO do mesmo padrão, nunca criando
 * nem eliminando um padrão da sessão. É o candidato 14 do roadmap: com
 * preferência por máquina, o melhor de cada padrão é o mesmo nos dois dias e o
 * peito repetia os três mesmos exercícios nos dias A e D. O critério de aceite
 * registrado é o perfil de resistência — máquina no dia A, cabo ou halter no dia
 * D, mesmo padrão.
 *
 * ── O que este arquivo NÃO faz ───────────────────────────────────────────
 *
 * Não escolhe exercício do zero, não conta série e não sabe de tempo. Recebe os
 * dias já montados e devolve trocas nome-por-nome, com o mesmo número de séries.
 * Quem monta é o gerador; quem decide se cabe é `duracao.ts`.
 */

// ── O que o arquivo precisa saber de cada linha ───────────────────────────

export interface LinhaDoDia {
  nome: string;
  grupo: string;
  equipamento?: string | null;
  papel?: string | null;
  ancora?: boolean;
  series: number;
}

export interface DiaComExercicios<T extends LinhaDoDia> {
  nome: string;
  exercicios: T[];
}

export interface CandidatoDeTroca {
  nome: string;
  grupo_primario: string;
  equipamento: string | null;
  /**
   * `peso_reps`, `peso_corporal`, `tempo`…
   *
   * Entra aqui por causa de um caso medido: numa casa com halteres, o único
   * exercício de agachamento com perfil de resistência diferente do halter é o
   * `Agachamento livre sem peso`. Trocar um goblet por um agachamento sem carga
   * "varia o perfil" e piora o treino — variedade que custa carga não é variedade,
   * é regressão com outro nome.
   */
  tipo_carga?: string | null;
}

const perfilDe = (nome: string, equipamento?: string | null) =>
  perfilDeResistencia(nome, equipamento);

// ── Nível 0 ───────────────────────────────────────────────────────────────

/**
 * Quem alimenta o gráfico em cada grupo — **o PRINCIPAL, não quem abre o bloco**.
 *
 * A diferença não é sutil e já custou uma régua errada nesta fase. Abrir o bloco
 * do grupo é POSIÇÃO: alguém sempre abre, mesmo quando é um face pull de 2
 * séries. Ser principal é PRESCRIÇÃO: multiarticular, carga ajustável, o
 * exercício cuja carga o app compara semana a semana.
 *
 * Cobrar "mesma âncora no bloco" quebraria A9: no dia de empurrar o ombro entra
 * por abdução (nenhum principal), e no dia em que o ombro é o tema ele abre com
 * desenvolvimento (principal). Exigir o mesmo nome nos dois obrigaria a pôr um
 * desenvolvimento pesado num dia de empurrar — exatamente o que A9 proíbe e o
 * invariante (b) já testa. Onde o grupo não tem principal na sessão, não há
 * curva para proteger.
 */
export function ancorasDoPlano<T extends LinhaDoDia>(
  dias: DiaComExercicios<T>[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of dias)
    for (const e of d.exercicios)
      if (e.papel === 'principal' && !out[e.grupo]) out[e.grupo] = e.nome;
  return out;
}

/**
 * O principal de um grupo é o MESMO em todas as sessões do bloco.
 *
 * Roda depois de tudo que remove exercício. Quando dois dias divergem, quem
 * ganha é a **primeira** aparição da semana: é a que já foi escolhida com o dia
 * inteiro disponível, antes de qualquer corte, e é a que a pessoa vê primeiro.
 *
 * A correção é uma TROCA de nome com o mesmo número de séries — nunca um
 * acréscimo. Acrescentar aqui reabriria o teto por sessão que `aplicarTetosDaSessao`
 * acabou de fechar, que é o modo como as correções de meio de pipeline se
 * desfizeram nas fases anteriores.
 *
 * `podeTrocar` é a porta do chamador: o gerador passa a régua que já usa (cabe no
 * padrão, não estoura o teto fracionado). Sem ela, esta função poderia consertar
 * a comparabilidade quebrando o volume.
 */
export function fixarPrincipalDoBloco<T extends LinhaDoDia, D extends DiaComExercicios<T>>(
  dias: D[],
  trocar: (dia: D, alvo: T, nomeNovo: string) => boolean
): { grupo: string; de: string; para: string }[] {
  const feitas: { grupo: string; de: string; para: string }[] = [];
  const escolhido: Record<string, string> = {};

  for (const d of dias) {
    for (const e of d.exercicios) {
      if (e.papel !== 'principal') continue;
      const jaEscolhido = escolhido[e.grupo];
      if (!jaEscolhido) {
        escolhido[e.grupo] = e.nome;
        continue;
      }
      if (jaEscolhido === e.nome) continue;
      // Divergiu: o dia de agora recebe o principal da primeira aparição.
      if (trocar(d, e, jaEscolhido)) feitas.push({ grupo: e.grupo, de: e.nome, para: jaEscolhido });
    }
  }
  return feitas;
}

// ── Nível 1 ───────────────────────────────────────────────────────────────

export interface QuebraDeAncora {
  grupo: string;
  /** O exercício que alimentava o gráfico no bloco anterior. */
  de: string;
  /** O que passa a alimentar. */
  para: string;
  /** O padrão de movimento, que é o mesmo nos dois — é o que torna a troca legítima. */
  padrao: string;
  /** Frase pronta para a tela, porque a quebra precisa ser dita onde a curva mora. */
  texto: string;
}

/**
 * Escolhe o principal do bloco NOVO, dado o do bloco anterior.
 *
 * Regra: dentro do mesmo padrão, o primeiro candidato que não seja o exercício
 * anterior. "Dentro do mesmo padrão" não é decoração — é o que mantém o novo
 * bloco comparável ao antigo em termos de o que está sendo treinado, mesmo com a
 * curva do gráfico partida. Trocar supino reto por crucifixo mudaria o que a
 * âncora mede.
 *
 * Devolve `null` quando não há alternativa: nesse caso o principal fica, e ficar
 * é a resposta certa — inventar variação onde o catálogo do local não tem é como
 * a régua de variedade semanal ficou aberta em 168 perfis antes de G2.1.
 */
export function escolherPrincipalDoBloco(
  candidatos: CandidatoDeTroca[],
  grupo: string,
  anterior: string | undefined
): string | null {
  if (!anterior) return null;
  const padrao = padraoDe(anterior, grupo);
  const mesmoPadrao = candidatos.filter(
    (c) => c.grupo_primario === grupo && padraoDe(c.nome, grupo) === padrao && c.nome !== anterior
  );
  if (!mesmoPadrao.length) return null;
  // Preferir quem muda o PERFIL DE RESISTÊNCIA: dois blocos com a mesma curva de
  // carga são o mesmo estímulo com outro nome — e trocar sem mudar nada teria o
  // custo (quebrar a curva) sem o benefício.
  const perfilAnterior = perfilDe(anterior);
  const outraCurva = mesmoPadrao.find((c) => perfilDe(c.nome, c.equipamento) !== perfilAnterior);
  return (outraCurva ?? mesmoPadrao[0]).nome;
}

/**
 * O que mudou entre o bloco anterior e o novo — a QUEBRA, dita com todas as
 * letras.
 *
 * Só reporta grupos que existiam nos dois blocos: grupo novo não quebra curva
 * nenhuma, ele começa uma.
 */
export function quebrasDeAncora(
  anterior: Record<string, string>,
  atual: Record<string, string>
): QuebraDeAncora[] {
  const out: QuebraDeAncora[] = [];
  for (const [grupo, de] of Object.entries(anterior)) {
    const para = atual[grupo];
    if (!para || para === de) continue;
    const padrao = padraoDe(de, grupo);
    out.push({
      grupo,
      de,
      para,
      padrao,
      texto:
        `${de} saiu e ${para} entrou como exercício de referência. É o mesmo padrão de movimento, ` +
        `então o treino não mudou de direção — mas a CARGA de um não continua a do outro. O gráfico ` +
        `de ${de} para aqui e o de ${para} começa do zero, de propósito: emendar as duas curvas ` +
        `mostraria uma queda ou um salto que você não teve.`,
    });
  }
  return out;
}

// ── Nível 2 ───────────────────────────────────────────────────────────────

/**
 * Rodízio de acessórios entre as sessões do bloco, DENTRO do mesmo padrão.
 *
 * ── O defeito que ela fecha (candidato 14 do roadmap) ────────────────────
 *
 * Com 4 dias e ênfase em peito, os dias A e D saíam com os MESMOS quatro
 * exercícios de peito, na mesma ordem de padrões. O `rodar()` do gerador roda a
 * lista de candidatos a partir do segundo, mas com preferência por máquina o
 * melhor de cada padrão é o mesmo nos dois dias — e o teto por padrão fecha a
 * porta para o resto. O rodízio existia e não tinha por onde acontecer.
 *
 * ── A restrição literal de B8 ────────────────────────────────────────────
 *
 * "Nunca criando nem eliminando um padrão da sessão." Então a troca é sempre
 * dentro do mesmo padrão, e o que muda é o PERFIL DE RESISTÊNCIA: máquina no
 * primeiro dia, cabo ou halter no segundo. Isso não é variedade cosmética — é o
 * mesmo argumento que `perfilDeResistencia` já sustenta no projeto para permitir
 * dois exercícios do mesmo padrão na sessão: a curva de carga é outra.
 *
 * ── E a âncora nunca é tocada ────────────────────────────────────────────
 *
 * Nível 0 tem precedência absoluta. Só linhas com `ancora === false` entram,
 * e o principal está sempre entre as âncoras.
 */
export function variarEntreSessoes<
  T extends LinhaDoDia & { tipoCarga?: string | null },
  D extends DiaComExercicios<T>,
>(
  dias: D[],
  candidatos: CandidatoDeTroca[],
  trocar: (dia: D, alvo: T, nomeNovo: string) => boolean
): { grupo: string; dia: string; de: string; para: string }[] {
  const feitas: { grupo: string; dia: string; de: string; para: string }[] = [];

  // Onde cada grupo aparece, na ordem dos dias.
  const aparicoes = new Map<string, { d: D; e: T }[]>();
  for (const d of dias)
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio') continue;
      if (!aparicoes.has(e.grupo)) aparicoes.set(e.grupo, []);
      aparicoes.get(e.grupo)!.push({ d, e });
    }

  for (const [grupo, linhas] of aparicoes) {
    const nomesDeDia = [...new Set(linhas.map((x) => x.d.nome))];
    if (nomesDeDia.length < 2) continue;

    // Tudo que já está em uso naquele grupo, em qualquer dia. O rodízio serve
    // para a semana ter mais exercícios distintos, não para embaralhar os mesmos.
    const emUso = new Set(linhas.map((x) => x.e.nome));

    // Do SEGUNDO dia em diante: o primeiro é a referência, como o nível 0 pede.
    for (const nomeDia of nomesDeDia.slice(1)) {
      const doDia = linhas.filter((x) => x.d.nome === nomeDia);
      const doPrimeiro = linhas.filter((x) => x.d.nome === nomesDeDia[0]);

      for (const { d, e } of doDia) {
        if (e.ancora) continue;
        // Só repete se o mesmo exercício está no dia de referência.
        if (!doPrimeiro.some((x) => x.e.nome === e.nome)) continue;

        const padrao = padraoDe(e.nome, grupo);
        const perfilAtual = perfilDe(e.nome, e.equipamento);
        // Todas as alternativas, não a primeira: `trocar` é quem conhece o teto
        // da sessão e o teto por padrão, e desistir na primeira recusa deixaria
        // a variedade dependendo da ordem do catálogo. Foi assim que a troca da
        // SEMANA ficou aberta em 168 perfis antes de G2.1.
        const alternativas = candidatos.filter(
          (c) =>
            c.grupo_primario === grupo &&
            !emUso.has(c.nome) &&
            padraoDe(c.nome, grupo) === padrao &&
            perfilDe(c.nome, c.equipamento) !== perfilAtual &&
            // Mesmo tipo de carga: variar não pode trocar carga externa por peso
            // do corpo. Ver o comentário de `tipo_carga` em `CandidatoDeTroca`.
            (c.tipo_carga ?? 'peso_reps') === (e.tipoCarga ?? 'peso_reps')
        );
        const escolhida = alternativas.find((c) => trocar(d, e, c.nome));
        if (!escolhida) continue;
        emUso.delete(e.nome);
        emUso.add(escolhida.nome);
        feitas.push({ grupo, dia: nomeDia, de: e.nome, para: escolhida.nome });
      }
    }
  }

  return feitas;
}
