import type { Genero, Macros, Objetivo } from '@/db/types';
import { metaCalorica } from './calculos';
import {
  DEFICIT_RECOMPOSICAO,
  KCAL_POR_KG_GORDURA,
  deficitMaximoSeguro,
  gorduraPorImc,
  massaMagraDe,
  tetoQueMorde,
  type OrigemComposicao,
} from './recomposicao';

/**
 * A meta do dia — **um lugar só, com os freios ligados**.
 *
 * ── Por que este arquivo existe (e por que é puro) ───────────────────────
 *
 * Duas razões, e as duas são cicatriz:
 *
 * 1. **A conta morava em `perfil/api.ts`, que importa o banco.** Isso a tornava
 *    inalcançável para o harness — e é por isso que a proteína de emagrecimento
 *    ficou anos calculada sobre o peso total sem nenhum invariante para pegar.
 *    Aqui não entra `@/db/client`: dá para varrer 672 corpos num teste.
 * 2. **Os freios existiam e não eram chamados.** `deficitMaximoSeguro` estava
 *    escrito em `recomposicao.ts` desde sempre, com a fonte no comentário, e
 *    grep no repositório inteiro não achava nenhum chamador. Não havia piso
 *    calórico nenhum, e o carboidrato ia a 0 g em silêncio.
 *
 * ── As três decisões que este arquivo toma ───────────────────────────────
 *
 * · **Proteína de déficit sai da MASSA MAGRA, não do peso.** Emagrecimento
 *   usava 2,2 g/kg de peso total: 264 g/dia para alguém de 120 kg com 40% de
 *   gordura — 1.056 kcal só de proteína, inatingível, e espremendo o carbo. A
 *   mesma pessoa em "recomposição", com o mesmo déficit, recebia ~173 g. Dois
 *   números muito diferentes para o mesmo corpo é incoerência de modelo, não
 *   refinamento. Agora os dois passam pelo mesmo mecanismo.
 * · **Existe piso, e ele é o maior entre o metabolismo basal e o que a gordura
 *   corporal consegue entregar por dia.**
 * · **Nada disso é armazenado.** Regra 6 do projeto: TMB, TDEE e IMC são função
 *   de peso, altura, idade e objetivo. O que `nutrition_targets` guarda é a
 *   META (uma decisão), não o derivado.
 *
 * ── Fontes ───────────────────────────────────────────────────────────────
 *
 * As duas verificadas na auditoria de nutrição de 29/07, e só elas:
 * Helms et al. 2014 (https://pubmed.ncbi.nlm.nih.gov/24092765/) — 2,3-3,1 g/kg
 * de **massa magra** em déficit para treinados; ISSN / Jäger et al. 2017
 * (https://pubmed.ncbi.nlm.nih.gov/28642676/) — 1,4-2,0 g/kg/dia geral e
 * 2,3-3,1 g/kg/dia em restrição calórica. O teto de mobilização de gordura
 * (~31 kcal por kg de gordura por dia, Alpert 2005) já estava citado em
 * `recomposicao.ts` e **não foi reaberto nesta sessão** — entra como estava.
 */

/**
 * Proteína em g por kg de MASSA MAGRA, nos objetivos que criam déficit.
 *
 * 2,4 nos dois. A faixa defensável é 2,3-3,1 (Helms) e o topo dela é de atleta
 * muito magro em corte agressivo — não de quem está com 40% de gordura
 * começando a perder peso. E o mesmo número nos dois objetivos é de propósito:
 * o déficit é o mesmo (15%), então a proteína também é. Era a diferença entre
 * eles que não tinha explicação.
 */
export const PROTEINA_ALVO_G_POR_KG_MM = 2.4;

export const PROTEINA_G_POR_KG_MM: Partial<Record<Objetivo, number>> = {
  emagrecimento: PROTEINA_ALVO_G_POR_KG_MM,
  recomposicao: PROTEINA_ALVO_G_POR_KG_MM,
};

/**
 * Proteína em g por kg de PESO, nos objetivos sem déficit.
 *
 * Continuam sobre o PESO, e isso é decisão, não sobra: o alvo do superávit é
 * um platô de dose-resposta que a meta-análise mediu por kg de peso corporal
 * (Morton 2018), não a retenção de um tecido específico. Trocar o denominador
 * para massa magra aqui seria responder a pergunta errada.
 */
const PROTEINA_G_POR_KG_PESO: Record<string, number> = { hipertrofia: 1.9, manutencao: 1.8 };

/**
 * Sem composição corporal nenhuma, a régua é a da ISSN, por peso total.
 *
 * 2,0 é o topo da faixa geral (1,4-2,0) e fica acima dos 1,9 do superávit —
 * senão a ordenação abaixo se inverteria justamente no ramo em que não há
 * denominador para escondê-la. Era 1,8, e 1,8 < 1,9.
 */
const PROTEINA_SEM_COMPOSICAO = 2.0;

/**
 * Teto de proteína em g por kg de MASSA MAGRA — e ele é o MESMO número do alvo.
 *
 * Não é coincidência e não pode virar uma: se o teto do superávit fosse mais
 * frouxo que o alvo do déficit, "ganhar massa" voltaria a passar na frente de
 * "perder gordura" assim que a gordura corporal subisse o bastante. Com o
 * mesmo número nos dois, a ordenação deixa de depender de aritmética e passa a
 * ser estrutural — ver `proteinaDoDia`. Por isso deriva da constante acima em
 * vez de repetir o `2.4`.
 */
const PROTEINA_TETO_G_POR_KG_MM = PROTEINA_ALVO_G_POR_KG_MM;

/**
 * Onde a evidência aberta termina: 3,1 g por kg de massa magra (Helms 2014,
 * topo da faixa de atleta em corte agressivo).
 *
 * O app nunca MIRA aqui. O número existe para responder uma pergunta só:
 * "o que saiu ainda está dentro de alguma fonte?". Acima de ~48% de gordura o
 * piso de Morton sozinho já estoura este limite, e aí não há denominador que
 * cubra o corpo — o número sai mesmo assim, porque não comer proteína não é
 * opção, mas sai declarado.
 */
const PROTEINA_LIMITE_EVIDENCIA_MM = 3.1;

/**
 * Piso de proteína em g por kg de PESO, para todo objetivo.
 *
 * Morton et al. 2018 (https://pubmed.ncbi.nlm.nih.gov/28698222/, aberta e
 * conferida): *"Protein supplementation beyond total protein intakes of
 * 1.62 g/kg/day resulted in no further RET-induced gains in FFM"*, IC 95%
 * 1,03-2,20. É o platô de dose-resposta, medido por kg de PESO CORPORAL —
 * e é ele que impede o teto de massa magra de empurrar a proteína abaixo do
 * que a meta-análise sustenta.
 */
const PROTEINA_PISO_G_POR_KG_PESO = 1.6;

/**
 * A proteína do dia — **um envelope só, para os quatro objetivos** (N11).
 *
 * ── O que este envelope conserta ─────────────────────────────────────────
 *
 * A Fase 5 tirou a proteína de emagrecimento do peso total e a pôs na massa
 * magra (N3, correto). Só que mexeu num ramo e não olhou o outro: hipertrofia
 * e manutenção continuaram multiplicando o PESO INTEIRO, e os dois ramos nunca
 * se olhavam. O resultado é que, acima de ~21% de gordura, "ganhar massa"
 * passou a receber MAIS proteína que "perder gordura" — 228 g contra 173 g
 * para 120 kg com 40%. O ponto de cruzamento é algébrico:
 * `2,4 × (1 − GC) = 1,9` → **GC = 20,8%**.
 *
 * Isso inverte uma relação que a evidência afirma explicitamente: a ISSN dá
 * 2,3-3,1 g/kg em restrição calórica contra 1,4-2,0 geral, e Helms escala com
 * a severidade do déficit. Em déficit a proteína tem dupla função — construir
 * e proteger o que já existe. Antes da Fase 5 a ordem estava certa por
 * acidente (264 > 228, os dois sobre o peso total).
 *
 * ── O envelope ───────────────────────────────────────────────────────────
 *
 *     max( PISO × peso , min( dose , TETO × massa magra ) )
 *
 * · **Déficit** não tem `dose`: o alvo É o tecido, então vale o teto de
 *   2,4 g/kg de massa magra direto — a decisão de N3, intacta.
 * · **Superávit e manutenção** têm `dose = 1,9 / 1,8 g/kg de peso`, agora
 *   limitada pelo mesmo teto de massa magra que o déficit já usava.
 * · **O piso de Morton** vale para todos, para o teto nunca empurrar abaixo do
 *   platô que a meta-análise sustenta.
 *
 * E a ordenação passa a ser **algébrica, não numérica**: superávit é
 * `max(piso, min(dose, teto))` e déficit é `max(piso, teto)`; como
 * `min(dose, teto) ≤ teto`, o déficit nunca fica abaixo. Não depende de nenhum
 * dos números continuarem como estão — que é a propriedade que faltava, já que
 * o defeito nasceu de mudar um número num ramo só.
 */
function proteinaDoDia(
  pesoKg: number,
  objetivo: Objetivo,
  magraKg: number | null
): { gramas: number; foraDaFaixa: boolean } {
  if (magraKg === null)
    return { gramas: Math.round(pesoKg * PROTEINA_SEM_COMPOSICAO), foraDaFaixa: false };

  const piso = PROTEINA_PISO_G_POR_KG_PESO * pesoKg;
  const teto = PROTEINA_TETO_G_POR_KG_MM * magraKg;
  // Déficit: o alvo É o tecido, então a dose é o próprio teto.
  // Superávit e manutenção: a dose é por peso, limitada pelo mesmo teto.
  const dose = PROTEINA_G_POR_KG_MM[objetivo]
    ? teto
    : Math.min((PROTEINA_G_POR_KG_PESO[objetivo] ?? 1.8) * pesoKg, teto);

  // O arredondamento não pode ser o que fura o teto: 105,7 g viram 106 e a
  // razão passa de 3,1 por um milésimo. Quando o teto é quem manda, desce.
  const alvo = Math.max(piso, dose);
  const gramas = alvo > teto && piso <= teto ? Math.floor(teto) : Math.round(alvo);

  return {
    gramas,
    foraDaFaixa: gramas > PROTEINA_LIMITE_EVIDENCIA_MM * magraKg,
  };
}

/**
 * Piso absoluto por gênero, abaixo do metabolismo basal já não caber.
 *
 * Prática comum, sem citação — está aqui como rede, não como recomendação: o
 * piso que morde de verdade nos cálculos automáticos é o basal.
 */
const MINIMO_ABSOLUTO: Record<string, number> = { feminino: 1200, masculino: 1500, outro: 1300 };

/** Gordura em 25% das calorias; abaixo de 20% começa a atrapalhar hormônio. */
const GORDURA_ALVO = 0.25;
const GORDURA_PISO = 0.2;

/** Abaixo disso o carboidrato deixou de ser escolha e virou sobra da conta. */
const CARBO_MINIMO_G = 30;

/** "2.128" — o resto do app escreve caloria assim, e o aviso é texto de tela. */
const kcalTxt = (n: number) => Math.round(n).toLocaleString('pt-BR');

/** Vírgula decimal com uma casa: "74.4" no meio de uma frase em PT é sujeira. */
const vg = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');

/** Como a tela chama cada origem de composição corporal. */
const TEXTO_ORIGEM_MAGRA: Record<OrigemComposicao, string> = {
  bioimpedancia: 'da bioimpedância',
  ajustada: 'da bioimpedância, ajustada para o seu peso de hoje',
  imc: 'estimada pelo IMC',
};

export function pisoCalorico(basal: number, genero?: string | null): number {
  return Math.max(Math.round(basal), MINIMO_ABSOLUTO[genero ?? 'outro'] ?? MINIMO_ABSOLUTO.outro);
}

export interface EntradaMeta {
  /** Gasto diário total já calculado (TMB × fator de atividade). */
  tdee: number;
  /** Metabolismo basal — vigente, ou seja já passado por `tmbVigente`. */
  basal: number;
  pesoKg: number;
  objetivo: Objetivo;
  /** Da bioimpedância. `null` faz a massa magra ser estimada pelo IMC. */
  gorduraPct: number | null;
  /** Se `gorduraPct` é a medição do dia ou ela já ajustada para o peso de hoje. */
  gorduraOrigem?: OrigemComposicao;
  estimar?: { alturaCm: number; idade: number; genero: string };
  genero?: Genero | string | null;
}

export interface MetaCalculada {
  meta: Macros;
  /** O que o usuário precisa saber sobre esta meta. Vazio quando não há nada. */
  avisos: string[];
  /** De onde a proteína saiu, em uma linha, para a tela mostrar. */
  baseCalculo: string;
  /** Por que a base é essa — e não a outra que o app usa no objetivo vizinho. */
  porqueBase: string;
  /** O menor valor calórico aceitável para este corpo. */
  piso: number;
}

/**
 * Divide as calorias em macros — com a escada que faltava.
 *
 * ── O que a escada conserta ──────────────────────────────────────────────
 *
 * `Math.max(0, Math.round(restante / 4))` aparecia em três pontos do código e
 * significava: quando a conta estoura, o carboidrato vira zero e ninguém fica
 * sabendo. Zero grama de carboidrato não é dieta baixa em carbo — é uma conta
 * que não fechou, gravada como se fosse prescrição.
 *
 * A ordem certa é: a gordura cede primeiro (até 20% das calorias, que é o piso
 * hormonal), e só depois o carboidrato aperta. Se nem assim couber, o app
 * **fala** em vez de gravar calado.
 */
export function dividirCalorias(kcal: number, proteina_g: number): { meta: Macros; avisos: string[] } {
  const avisos: string[] = [];
  let gordura_g = Math.round((kcal * GORDURA_ALVO) / 9);
  let restante = kcal - proteina_g * 4 - gordura_g * 9;

  if (restante < CARBO_MINIMO_G * 4) {
    const piso_g = Math.round((kcal * GORDURA_PISO) / 9);
    if (piso_g < gordura_g) {
      gordura_g = piso_g;
      restante = kcal - proteina_g * 4 - gordura_g * 9;
      avisos.push(
        `Para caber em ${kcalTxt(kcal)} kcal, a gordura desceu para ${gordura_g} g — o piso de ` +
          `20% das calorias. Abaixo disso começa a mexer com hormônio.`
      );
    }
  }

  const carbo_g = Math.max(0, Math.round(restante / 4));
  if (restante < 0) {
    avisos.push(
      `Esta meta não fecha: só a proteína e o piso de gordura já somam ` +
        `${kcalTxt(proteina_g * 4 + gordura_g * 9)} kcal, mais que as ${kcalTxt(kcal)} kcal pedidas. ` +
        `Ou a meta sobe, ou a proteína desce — treinar com zero carboidrato não é a terceira opção.`
    );
  } else if (carbo_g < CARBO_MINIMO_G) {
    avisos.push(
      `Sobraram ${carbo_g} g de carboidrato no dia. Dá para viver com isso por pouco tempo, mas o ` +
        `treino pesado é a primeira coisa que sente.`
    );
  }

  return { meta: { kcal: Math.round(kcal), proteina_g, carbo_g, gordura_g }, avisos };
}

/**
 * A meta que o app calcularia sozinho — **o único ponto de cálculo do app**.
 *
 * Refazer a conta na tela com `macros()` direto já ressuscitou uma vez a
 * proteína sobre o peso total na recomposição (o bug que o commit `774fd4c`
 * tinha matado, de volta pelo botão "Recalcular"). Por isso a rota é uma só.
 */
export function calcularMetaDetalhada(e: EntradaMeta): MetaCalculada {
  const avisos: string[] = [];

  const bruta =
    e.objetivo === 'recomposicao'
      ? Math.round(e.tdee * DEFICIT_RECOMPOSICAO)
      : metaCalorica(e.tdee, e.objetivo);

  // ── Piso ───────────────────────────────────────────────────────────────
  //
  // Só faz sentido onde existe déficit. Em hipertrofia e manutenção a meta já
  // nasce acima do gasto, e um piso ali seria número decorativo.
  const emDeficit = bruta < e.tdee;
  const basal = pisoCalorico(e.basal, e.genero);
  const magra = massaMagraDe(e.pesoKg, e.gorduraPct, e.estimar, e.gorduraOrigem);
  // O teto de déficit, agora pelo menor de dois: quanto a gordura entrega por
  // dia (Alpert, 69,3 kcal/kg — não os 31 que eram o valor por libra) e quão
  // rápido dá para perder (0,5-1,0% do peso por semana). Ver `recomposicao.ts`.
  const porGordura = magra ? Math.round(e.tdee - deficitMaximoSeguro(e.pesoKg, magra.pct)) : 0;
  const piso = emDeficit ? Math.max(basal, porGordura) : 0;

  let kcal = bruta;
  if (emDeficit && kcal < piso) {
    kcal = piso;
    if (piso === porGordura && porGordura > basal) {
      const gorduraKg = (e.pesoKg * (magra ? magra.pct : 0)) / 100;
      const porSemana = ((Math.round(e.tdee) - kcal) * 7) / KCAL_POR_KG_GORDURA;
      avisos.push(
        tetoQueMorde(e.pesoKg, magra ? magra.pct : 0) === 'gordura'
          ? `Seu déficit foi limitado a ${kcalTxt(Math.round(e.tdee) - kcal)} kcal por dia: é o máximo que ` +
              `${gorduraKg.toFixed(1).replace('.', ',')} kg de gordura conseguem entregar por dia ` +
              `(cerca de 69 kcal por kg de gordura). Cortar mais tira massa magra, não gordura.`
          : `Seu déficit foi limitado a ${kcalTxt(Math.round(e.tdee) - kcal)} kcal por dia — cerca de ` +
              `${porSemana.toFixed(1).replace('.', ',')} kg por semana, que é o ritmo máximo em que dá para ` +
              `perder peso sem perder músculo junto (1% do peso por semana).`
      );
    } else {
      avisos.push(
        `A meta parou em ${kcalTxt(kcal)} kcal — abaixo disso ela ficaria menor que o que seu corpo gasta ` +
          `parado. Perder mais rápido a partir daqui é perder músculo junto.`
      );
    }
  }

  // ── Proteína ───────────────────────────────────────────────────────────
  const p = proteinaDoDia(e.pesoKg, e.objetivo, magra ? magra.kg : null);
  const proteina_g = p.gramas;
  const baseCalculo = magra
    ? // Vírgula decimal, como o resto do app: `toFixed` devolve ponto, e um
      // "74.4 kg" no meio de uma frase em português é sujeira que só aparece
      // na tela.
      `${vg(proteina_g / magra.kg)} g por kg de massa magra ` +
      `(${vg(magra.kg)} kg, ${TEXTO_ORIGEM_MAGRA[magra.origem]}) · ${vg(proteina_g / e.pesoKg)} g por kg de peso`
    : `${vg(PROTEINA_SEM_COMPOSICAO)} g por kg de peso — sem dados para estimar a massa magra`;

  // ── Por que a BASE muda com o objetivo ─────────────────────────────────
  //
  // Duas bases sem explicação são indistinguíveis de bug — e o app imprime as
  // duas na mesma tela. A frase não é enfeite: é o que separa "o app usa dois
  // denominadores porque a pergunta é outra" de "o app usa dois denominadores
  // porque ninguém unificou".
  const porqueBase = PROTEINA_G_POR_KG_MM[e.objetivo]
    ? 'Em déficit o alvo é RETER um tecido, então o tecido é a conta: a gordura não consome proteína. ' +
      'Por isso a base é a massa magra, e não o peso.'
    : 'Fora do déficit o alvo é um platô de dose-resposta que a pesquisa mediu por kg de PESO corporal, ' +
      'não a retenção de um tecido. Por isso a base aqui é o peso — com teto pela massa magra, para quem ' +
      'tem muita gordura não receber proteína de um corpo que não tem.';

  if (p.foraDaFaixa)
    avisos.push(
      `Com a gordura corporal estimada em ${vg(magra ? magra.pct : 0)}%, sua massa magra é pequena demais ` +
        `para a referência de proteína: ${proteina_g} g dão ${vg(proteina_g / (magra ? magra.kg : 1))} g por kg ` +
        `de massa magra, acima da faixa de qualquer estudo. O número está no mínimo que a pesquisa sustenta ` +
        `por peso corporal — trate como ponto de partida e refaça quando tiver uma bioimpedância.`
    );

  const divisao = dividirCalorias(kcal, proteina_g);
  return {
    meta: divisao.meta,
    avisos: [...avisos, ...divisao.avisos],
    baseCalculo,
    porqueBase,
    piso,
  };
}

/**
 * Meta calórica escolhida à mão, com proteína e gordura da meta automática.
 *
 * Proteína continua sendo piso de saúde; o que muda é que a gordura passou a
 * ceder antes do carboidrato, e que a conta impossível é dita em vez de virar
 * `carbo 0 g` no banco.
 */
export function macrosParaMetaManual(kcal: number, base: Macros): { meta: Macros; avisos: string[] } {
  return dividirCalorias(kcal, base.proteina_g);
}

/**
 * O que há de errado com uma meta JÁ SALVA — inclusive uma escolhida à mão.
 *
 * `resumo()` prefere a meta persistida, então a meta automática pode estar
 * impecável e a tela mostrar outra coisa. Auditar na leitura é o que faz o
 * aviso continuar valendo quando o peso muda meses depois.
 */
export function avisosDaMeta(
  meta: Macros,
  ctx: {
    basal: number;
    tdee: number;
    pesoKg: number;
    gorduraPct: number | null;
    gorduraOrigem?: OrigemComposicao;
    estimar?: { alturaCm: number; idade: number; genero: string };
    genero?: Genero | string | null;
    objetivo: Objetivo;
  }
): string[] {
  const out: string[] = [];
  const piso = pisoCalorico(ctx.basal, ctx.genero);
  if (meta.kcal < piso)
    out.push(
      `Sua meta está em ${kcalTxt(meta.kcal)} kcal, abaixo do piso de ${kcalTxt(piso)} kcal para o seu corpo — o ` +
        `metabolismo basal é o que você gasta dormindo. Comer menos que isso por semanas cobra ` +
        `massa magra e não acelera a perda de gordura.`
    );

  const magra = massaMagraDe(ctx.pesoKg, ctx.gorduraPct, ctx.estimar, ctx.gorduraOrigem);
  if (magra) {
    const teto = deficitMaximoSeguro(ctx.pesoKg, magra.pct);
    const deficit = Math.round(ctx.tdee) - meta.kcal;
    if (deficit > teto)
      out.push(
        `O déficit de ${kcalTxt(deficit)} kcal por dia passa do que sua gordura corporal entrega ` +
          `(${kcalTxt(teto)} kcal). A diferença sai de músculo.`
      );
  }

  if (meta.carbo_g <= 0)
    out.push('A meta está com 0 g de carboidrato — a conta não fechou, não é uma escolha de dieta.');
  else if (meta.carbo_g < CARBO_MINIMO_G)
    out.push(`Só ${meta.carbo_g} g de carboidrato no dia: o treino pesado é o primeiro a sentir.`);

  if (meta.gordura_g * 9 < meta.kcal * (GORDURA_PISO - 0.005))
    out.push(
      `A gordura está em ${Math.round((meta.gordura_g * 9 * 100) / Math.max(1, meta.kcal))}% das ` +
        `calorias, abaixo dos 20% que a produção hormonal pede.`
    );

  return out;
}

// ── A medição ENVELHECE, não expira (N6, N15, N18) ─────────────────────────
//
// ── O que N6 acertou, e onde ela parou no meio ──────────────────────────────
//
// Uma bioimpedância gravava `usa_tmb_medido = 1` e o valor passava a definir o
// TDEE **para sempre**. Recomposição funcionando = peso caindo = TMB real
// caindo: com o número de três meses atrás o gasto fica superestimado, o
// "déficit de 15%" vira 8-10% real, e o progresso trava sem nada na tela
// explicando. Diagnóstico certo.
//
// A correção foi expiração dura — desvio de peso > 3% ou idade > 8 semanas — e
// ela tem três problemas, que juntos custam mais do que resolvem:
//
// 1. **Ficou só no TMB.** O `gordura_pct` da MESMA LINHA continuou valendo
//    para sempre, e é ele que decide a proteína. Duas políticas contraditórias
//    para a mesma medição, dentro do mesmo `resumo()`.
// 2. **É desproporcional.** O Leonardo cai pelos dois gatilhos (4,39% e 92
//    dias) e o que a expiração troca são ~35 kcal, num caso em que a fórmula
//    acertou com 2 kcal de diferença. Ele veria um card laranja de alerta por
//    isso.
// 3. **Joga fora a informação individual junto com a velha.** O que a medição
//    acrescenta à fórmula não é o valor absoluto: é o quanto ESTE corpo difere
//    do que a fórmula prevê para ele. Esse desvio continua valendo quando o
//    peso muda — só precisa ser aplicado sobre a estimativa do peso novo.
//
// ── A política, uma só para os dois números ────────────────────────────────
//
//     offset  = medido − estimado(peso do dia da medição)
//     vigente = estimado(peso de hoje) + offset × envelhecer(dias)
//
// Acompanha o peso sozinho, não descarta nada, não precisa de card de alerta,
// e não dá degrau: com a expiração, o número trocava 134 kcal de uma quinta
// para uma sexta sem nada ter acontecido com o corpo — que é o defeito que a
// própria Fase 5 nomeou ("um número que muda sozinho e não se explica é pior
// que o número velho") aplicado à regra que ela escreveu para consertá-lo.
//
// Nada armazenado além do que `body_metrics` já tem, e a decisão continua
// sendo tomada na LEITURA — regra 6 do projeto.
//
// ── E a balança não mede metabolismo ───────────────────────────────────────
//
// Ela estima a massa livre de gordura por impedância e joga numa equação
// interna: é fórmula substituindo fórmula, não medição substituindo
// estimativa. Karagun & Baklaci 2024 (Medicine 103(35):e39542,
// https://pmc.ncbi.nlm.nih.gov/articles/PMC11365691/, aberta e conferida): a
// BIA superestima em ~185 kcal contra calorimetria indireta, e só 36,1% dos
// casos caem dentro de ±10%. Foi essa confusão que deu à balança poder de veto
// sobre a fórmula — e que fez a correção ser "expirar" em vez de "misturar".

/** Em quanto tempo o desvio individual medido deixa de descrever o corpo. */
export const ENVELHECIMENTO_DIAS = 112; // 16 semanas

/**
 * Quanto do desvio medido ainda vale hoje — 1 no dia da medição, 0 no fim.
 *
 * Linear de propósito: qualquer curva aqui seria precisão inventada, e o que
 * importa é a propriedade, não a forma — o número muda um pouquinho todo dia
 * em vez de trocar de valor num dia só.
 */
export function envelhecer(offset: number, diasDesde: number | null): number {
  if (diasDesde === null) return offset;
  const d = Math.max(0, Math.min(ENVELHECIMENTO_DIAS, diasDesde));
  return offset * (1 - d / ENVELHECIMENTO_DIAS);
}

export interface EntradaTmb {
  medidoKcal: number | null;
  /** `YYYY-MM-DD` do dia da bioimpedância. */
  medidoEm: string | null;
  /** O peso daquele dia — só para o texto; a conta usa o estimado abaixo. */
  pesoNaMedicao: number | null;
  /** Mifflin-St Jeor com o peso do DIA DA MEDIÇÃO. É ele que dá o offset. */
  estimadoNaMedicao: number | null;
  pesoAtual: number;
  /** Mifflin-St Jeor com os dados de hoje. */
  estimado: number;
  hojeIso: string;
}

export type OrigemNumero = 'medido' | 'ajustado' | 'estimado';

export interface TmbVigente {
  valor: number;
  /** `true` só quando o número é a medição pura — mesmo peso, mesmo dia. */
  medido: boolean;
  origem: OrigemNumero;
  /** Quanto este corpo difere da fórmula, medido no dia da bioimpedância. */
  offset: number | null;
  diasDesde: number | null;
  desvioPct: number | null;
}

// **Não existe mais um `motivo`, e a ausência é a decisão.**
//
// A expiração precisava de uma frase de alerta porque acontecia de um dia para
// o outro: o número trocava 134 kcal numa sexta-feira e alguém tinha que
// explicar. Envelhecer não é evento — é o passar do tempo, alguns kcal por
// semana — e não tem o que anunciar. O que a tela mostra no lugar é a legenda
// permanente derivada de `origem`, que é informação, não alarme.
//
// O Leonardo caía nos dois gatilhos da expiração (4,39% de desvio e 92 dias) e
// veria um card laranja para trocar 35 kcal, num caso em que a fórmula acertou
// com 2 kcal de diferença.

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** "2026-06-01" → "01/06". A tela mostra a data da medição junto da legenda. */
export const ddmm = (iso: string) => {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}` : iso;
};

/** Quanto do desvio individual ainda pesa — usado pelas duas vigências. */
function pesoDoOffset(medido: number, estimadoEntao: number, diasDesde: number | null): number {
  return envelhecer(medido - estimadoEntao, diasDesde);
}

/**
 * Qual TMB vale hoje: a fórmula com o peso de hoje, mais o desvio que a
 * bioimpedância mediu neste corpo, com esse desvio envelhecendo.
 */
export function tmbVigente(e: EntradaTmb): TmbVigente {
  const semMedicao: TmbVigente = {
    valor: Math.round(e.estimado),
    medido: false,
    origem: 'estimado',
    offset: null,
    diasDesde: null,
    desvioPct: null,
  };
  if (!e.medidoKcal || e.estimadoNaMedicao == null) return semMedicao;

  const diasDesde = e.medidoEm ? diasEntre(e.medidoEm, e.hojeIso) : null;
  const desvioPct =
    e.pesoNaMedicao && e.pesoNaMedicao > 0 ? (e.pesoAtual - e.pesoNaMedicao) / e.pesoNaMedicao : null;

  const offset = e.medidoKcal - e.estimadoNaMedicao;
  const vivo = pesoDoOffset(e.medidoKcal, e.estimadoNaMedicao, diasDesde);
  const valor = Math.round(e.estimado + vivo);

  // "Medido" só quando é literalmente a medição: mesmo dia, mesmo peso.
  // Qualquer outra coisa é a medição ajustada, e a tela precisa dizer isso —
  // era `estimada: false` para um número meio fórmula que fazia a bioimpedância
  // de três meses atrás se apresentar como a de hoje.
  const puro = (diasDesde === null || diasDesde === 0) && (desvioPct === null || desvioPct === 0);

  return {
    valor,
    medido: puro,
    origem: puro ? 'medido' : vivo === 0 ? 'estimado' : 'ajustado',
    offset: Math.round(offset),
    diasDesde,
    desvioPct,
  };
}

/** Rótulo curto para a tela — a explicação permanente que substituiu o card. */
export const TEXTO_ORIGEM_TMB: Record<OrigemNumero, string> = {
  medido: 'da bioimpedância',
  ajustado: 'da bioimpedância, ajustado ao seu peso de hoje',
  estimado: 'estimado por fórmula',
};

export interface EntradaGordura {
  /** Percentual da bioimpedância. `null` quando nunca houve uma. */
  medidoPct: number | null;
  medidoEm: string | null;
  pesoNaMedicao: number | null;
  pesoAtual: number;
  hojeIso: string;
  /** Sem altura/idade/gênero não há como envelhecer: a medição fica como está. */
  estimar?: { alturaCm: number; idade: number; genero: string };
}

export interface GorduraVigente {
  pct: number | null;
  origem: OrigemComposicao;
  diasDesde: number | null;
}

/**
 * Qual percentual de gordura vale hoje — **a mesma política do TMB** (N15).
 *
 * N6 pôs validade no TMB e deixou este número valer para sempre. É a mesma
 * medição, do mesmo dia, do mesmo aparelho — e é ESTE que decide a proteína.
 * Misturar o peso de hoje com a gordura de três meses atrás assume que todo
 * peso ganho ou perdido teve a composição da medição antiga; ninguém escreveu
 * essa suposição e o app fazia.
 *
 * A base aqui é Deurenberg (`gorduraPorImc`), que é a estimativa que o app já
 * usa quando não há balança: o offset é o quanto a bioimpedância discordou
 * dela naquele dia, e ele envelhece igual.
 */
export function gorduraVigente(e: EntradaGordura): GorduraVigente {
  if (e.medidoPct == null) return { pct: null, origem: 'imc', diasDesde: null };
  const diasDesde = e.medidoEm ? diasEntre(e.medidoEm, e.hojeIso) : null;

  // Sem altura/idade, ou sem o peso do dia da medição, não há offset a
  // calcular — e portanto não há ajuste. O valor devolvido é a medição crua, e
  // é assim que ele se apresenta: chamá-lo de "ajustada" seria dizer que uma
  // conta aconteceu quando não aconteceu, que é o mesmo tipo de mentira que
  // N15 aponta na direção contrária.
  if (!e.estimar || !e.pesoNaMedicao)
    return { pct: e.medidoPct, origem: 'bioimpedancia', diasDesde };

  const { alturaCm, idade, genero } = e.estimar;
  const entao = gorduraPorImc(e.pesoNaMedicao, alturaCm, idade, genero);
  const hoje = gorduraPorImc(e.pesoAtual, alturaCm, idade, genero);
  const vivo = pesoDoOffset(e.medidoPct, entao, diasDesde);
  const pct = Math.min(60, Math.max(3, Math.round((hoje + vivo) * 10) / 10));

  const puro = (diasDesde === null || diasDesde === 0) && e.pesoNaMedicao === e.pesoAtual;
  return { pct, origem: puro ? 'bioimpedancia' : vivo === 0 ? 'imc' : 'ajustada', diasDesde };
}

// ── A meta manual não pode morrer na próxima pesagem (N13) ─────────────────

export interface DecisaoRecalculo {
  /** `false` quando a meta vigente foi escolhida à mão e continua valendo. */
  gravar: boolean;
  /** O que a tela precisa dizer quando NÃO gravou. `null` quando gravou. */
  aviso: string | null;
}

/**
 * Sobrescrever a meta vigente pela automática — sim ou não, e por quê.
 *
 * `recalcularMeta` gravava `salvarMeta(macros, 'auto')` **sem consultar a
 * origem da meta vigente**, e é disparada em toda pesagem, toda bioimpedância
 * e toda edição de perfil. A pessoa ajustava para 1.800 kcal, lia os avisos,
 * aceitava — e na manhã seguinte, ao se pesar, a meta voltava para 2.464 sem
 * nada na tela. A Fase 5 investiu a fase inteira em fazer o caminho manual bom
 * (a escada de gordura, os avisos, a conferência que soma) e ele era descartado
 * na pesagem seguinte.
 *
 * A regra mora aqui, e não em `api.ts`, pelo motivo de sempre neste arquivo:
 * o que vive junto do banco é inalcançável para o harness, e foi assim que a
 * proteína sobre o peso total sobreviveu anos sem nenhum invariante.
 */
export function decidirRecalculo(e: {
  vigente: (Macros & { origem?: string | null }) | null;
  automatica: Macros;
}): DecisaoRecalculo {
  if (e.vigente?.origem !== 'manual') return { gravar: true, aviso: null };
  return {
    gravar: false,
    aviso:
      `Sua meta manual de ${kcalTxt(e.vigente.kcal)} kcal continua valendo. Com o seu peso de hoje, a ` +
      `automática seria ${kcalTxt(e.automatica.kcal)} kcal — toque em "Macros da meta" para trocar.`,
  };
}
