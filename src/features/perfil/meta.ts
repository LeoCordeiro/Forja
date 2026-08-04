import type { Genero, Macros, Objetivo } from '@/db/types';
import { metaCalorica } from './calculos';
import { DEFICIT_RECOMPOSICAO, deficitMaximoSeguro, massaMagraDe } from './recomposicao';

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
export const PROTEINA_G_POR_KG_MM: Partial<Record<Objetivo, number>> = {
  emagrecimento: 2.4,
  recomposicao: 2.4,
};

/** Proteína em g por kg de PESO, nos objetivos sem déficit. */
const PROTEINA_G_POR_KG_PESO: Record<string, number> = { hipertrofia: 1.9, manutencao: 1.8 };

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
  estimar?: { alturaCm: number; idade: number; genero: string };
  genero?: Genero | string | null;
}

export interface MetaCalculada {
  meta: Macros;
  /** O que o usuário precisa saber sobre esta meta. Vazio quando não há nada. */
  avisos: string[];
  /** De onde a proteína saiu, em uma linha, para a tela mostrar. */
  baseCalculo: string;
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
  const magra = massaMagraDe(e.pesoKg, e.gorduraPct, e.estimar);
  // O teto de mobilização: a gordura corporal entrega ~31 kcal por kg por dia.
  // Passar disso, o déficit sai de massa magra — é o que faz gente emagrecer e
  // ficar flácida. A função existia e nunca tinha sido chamada.
  const porGordura = magra ? Math.round(e.tdee - deficitMaximoSeguro(e.pesoKg, magra.pct)) : 0;
  const piso = emDeficit ? Math.max(basal, porGordura) : 0;

  let kcal = bruta;
  if (emDeficit && kcal < piso) {
    kcal = piso;
    if (piso === porGordura && porGordura > basal) {
      avisos.push(
        `Seu déficit foi limitado a ${kcalTxt(Math.round(e.tdee) - kcal)} kcal por dia: é o máximo que ` +
          `${((e.pesoKg * (magra ? magra.pct : 0)) / 100).toFixed(1).replace('.', ',')} kg de gordura consegue entregar. ` +
          `Cortar mais tira massa magra, não gordura.`
      );
    } else {
      avisos.push(
        `A meta parou em ${kcalTxt(kcal)} kcal — abaixo disso ela ficaria menor que o que seu corpo gasta ` +
          `parado. Perder mais rápido a partir daqui é perder músculo junto.`
      );
    }
  }

  // ── Proteína ───────────────────────────────────────────────────────────
  const gPorKgMM = PROTEINA_G_POR_KG_MM[e.objetivo];
  let proteina_g: number;
  let baseCalculo: string;

  if (gPorKgMM && magra) {
    proteina_g = Math.round(magra.kg * gPorKgMM);
    baseCalculo =
      `${gPorKgMM.toString().replace('.', ',')} g por kg de massa magra ` +
      // Vírgula decimal, como o resto do app: `toFixed` devolve ponto, e um
      // "74.4 kg" no meio de uma frase em português é sujeira que só aparece
      // na tela.
      `(${magra.kg.toFixed(1).replace('.', ',')} kg${magra.estimada ? ', estimada pelo IMC' : ''})`;
  } else if (gPorKgMM) {
    // Sem altura, idade ou gênero não dá para estimar a massa magra. Aí o peso
    // total é o que sobra — e com um coeficiente menor, porque ele já embute a
    // gordura que não consome proteína.
    proteina_g = Math.round(e.pesoKg * 1.8);
    baseCalculo = '1,8 g por kg de peso — sem dados para estimar a massa magra';
  } else {
    const g = PROTEINA_G_POR_KG_PESO[e.objetivo] ?? 1.8;
    proteina_g = Math.round(e.pesoKg * g);
    baseCalculo = `${g.toString().replace('.', ',')} g por kg de peso`;
  }

  const divisao = dividirCalorias(kcal, proteina_g);
  return { meta: divisao.meta, avisos: [...avisos, ...divisao.avisos], baseCalculo, piso };
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

  const magra = massaMagraDe(ctx.pesoKg, ctx.gorduraPct, ctx.estimar);
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

// ── TMB medido: vale, mas não para sempre (N6) ─────────────────────────────

/** Depois disso, uma bioimpedância descreve outro corpo. */
export const VALIDADE_TMB_DIAS = 56; // 8 semanas
/** Desvio de peso que basta para a medição deixar de descrever você. */
export const DESVIO_PESO_TMB = 0.03; // 3%

export interface EntradaTmb {
  medidoKcal: number | null;
  /** `YYYY-MM-DD` do dia da bioimpedância. */
  medidoEm: string | null;
  /** O peso daquele dia — é ele que diz se a medição ainda descreve o corpo. */
  pesoNaMedicao: number | null;
  pesoAtual: number;
  /** Mifflin-St Jeor com os dados de hoje. */
  estimado: number;
  hojeIso: string;
}

export interface TmbVigente {
  valor: number;
  /** `true` quando o número veio da balança, não da fórmula. */
  medido: boolean;
  /** Por que a medição saiu de cena. `null` quando ela vale (ou nunca existiu). */
  motivo: string | null;
  diasDesde: number | null;
  desvioPct: number | null;
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const ddmm = (iso: string) => {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}` : iso;
};

/**
 * Qual TMB vale hoje — e, quando o medido não vale mais, por quê.
 *
 * ── O erro que isto conserta ─────────────────────────────────────────────
 *
 * Uma bioimpedância gravava `usa_tmb_medido = 1` e o valor passava a definir o
 * TDEE **para sempre**. Só que recomposição funcionando = peso caindo = TMB
 * real caindo: com o número de três meses atrás o gasto fica superestimado, o
 * "déficit de 15%" vira 8-10% real, e o progresso trava sem nada na tela
 * explicando. É o inverso exato do que a regra 6 do projeto quis evitar —
 * congelar um derivado e criar histórico mentiroso.
 *
 * Expira por dois caminhos, e os dois são necessários: por **desvio de peso**,
 * porque é o peso que move o TMB; e por **tempo**, porque idade e composição
 * mudam mesmo com o peso parado.
 *
 * Não apaga nada: a medição continua em `body_metrics`. O que muda é qual
 * número o dia usa — e a decisão é tomada na leitura, nunca gravada.
 */
export function tmbVigente(e: EntradaTmb): TmbVigente {
  if (!e.medidoKcal)
    return { valor: Math.round(e.estimado), medido: false, motivo: null, diasDesde: null, desvioPct: null };

  const diasDesde = e.medidoEm ? diasEntre(e.medidoEm, e.hojeIso) : null;
  const desvioPct =
    e.pesoNaMedicao && e.pesoNaMedicao > 0
      ? (e.pesoAtual - e.pesoNaMedicao) / e.pesoNaMedicao
      : null;

  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

  if (desvioPct !== null && Math.abs(desvioPct) > DESVIO_PESO_TMB) {
    return {
      valor: Math.round(e.estimado),
      medido: false,
      motivo:
        `A bioimpedância mediu seu metabolismo com ${fmt(e.pesoNaMedicao!)} kg e hoje você está ` +
        `com ${fmt(e.pesoAtual)} kg — ${fmt(Math.abs(desvioPct) * 100)}% de diferença. ` +
        `Voltamos para a estimativa até você refazer a medição.`,
      diasDesde,
      desvioPct,
    };
  }

  if (diasDesde !== null && diasDesde > VALIDADE_TMB_DIAS) {
    return {
      valor: Math.round(e.estimado),
      medido: false,
      motivo:
        `Sua bioimpedância é de ${ddmm(e.medidoEm!)} — mais de ${Math.floor(VALIDADE_TMB_DIAS / 7)} ` +
        `semanas. O metabolismo medido continua no histórico, mas a meta voltou para a estimativa. ` +
        `Refazendo a medição, ela volta a valer.`,
      diasDesde,
      desvioPct,
    };
  }

  return { valor: Math.round(e.medidoKcal), medido: true, motivo: null, diasDesde, desvioPct };
}
