import type { Genero } from '@/db/types';

/**
 * Recomposição corporal — ganhar músculo e perder gordura ao mesmo tempo.
 *
 * Durante muito tempo se ensinou que era impossível. A evidência atual mostra
 * que é não só possível como esperado em três perfis:
 *   1. quem nunca treinou;
 *   2. quem está voltando depois de uma pausa (memória muscular);
 *   3. quem tem percentual de gordura elevado — sobra substrato próprio.
 *
 * O que faz acontecer, na ordem de importância:
 *   - treino de força levado a sério (sem ele o déficit consome massa magra);
 *   - proteína alta (2,4–3,0 g/kg em déficit, acima do 1,6 do bulking);
 *   - déficit MODERADO (10–20%). Déficit agressivo mata a recuperação e a
 *     recomposição junto.
 *
 * Referências: Barakat et al. 2020 (revisão de recomposição); Longland 2016
 * (2,4 g/kg em déficit resultou em ganho de massa magra); Helms 2014
 * (proteína em déficit para atletas naturais).
 */

export const DEFICIT_RECOMPOSICAO = 0.85; // 15% abaixo do gasto

/** Perfis em que a recomposição tem alta chance de funcionar. */
export interface AptidaoRecomp {
  apto: boolean;
  motivos: string[];
  ressalva?: string;
}

export function avaliarRecomposicao(dados: {
  gorduraPct: number | null;
  genero: Genero;
  mesesParado: number;
  experiencia: string;
}): AptidaoRecomp {
  const motivos: string[] = [];
  const { gorduraPct, genero, mesesParado, experiencia } = dados;

  // Os limiares diferem por sexo: a faixa saudável feminina é naturalmente
  // mais alta, então usar o mesmo corte para os dois classificaria errado.
  const limiar = genero === 'feminino' ? 28 : 20;
  if (gorduraPct !== null && gorduraPct > limiar) {
    motivos.push(`Gordura corporal em ${gorduraPct.toFixed(1)}% — há reserva para o corpo usar como energia`);
  }
  if (mesesParado >= 1) {
    motivos.push(`${mesesParado} ${mesesParado === 1 ? 'mês parado' : 'meses parado'} — memória muscular acelera a retomada`);
  }
  if (experiencia === 'iniciante') {
    motivos.push('Iniciante — a resposta ao treino é máxima nos primeiros meses');
  }

  const apto = motivos.length > 0;
  return {
    apto,
    motivos: apto ? motivos : ['Perfil já treinado e magro — recomposição fica lenta'],
    ressalva: apto
      ? undefined
      : 'Com pouca gordura e anos de treino, alternar fases de ganho e de corte costuma render mais que recompor.',
  };
}

/**
 * Proteína por quilo, conforme objetivo.
 *
 * Em déficit a necessidade SOBE, não desce: a proteína passa a ter dupla
 * função — construir e proteger o que já existe.
 */
/**
 * Percentual de gordura estimado pelo IMC (equação de Deurenberg, 1991).
 *
 * Serve para uma coisa só: dar uma base de massa magra a quem não tem balança
 * de bioimpedância. Erra em quem tem muita massa muscular — o IMC não sabe
 * distinguir músculo de gordura — e por isso o app segue pedindo a medição de
 * verdade. Mas errar por alguns pontos percentuais é muito melhor que a
 * alternativa anterior, que era calcular proteína para o peso inteiro como se
 * gordura consumisse proteína.
 */
export function gorduraPorImc(
  pesoKg: number,
  alturaCm: number,
  idade: number,
  genero: string
): number {
  const bmi = pesoKg / (alturaCm / 100) ** 2;
  const homem = genero === 'masculino' ? 1 : genero === 'feminino' ? 0 : 0.5;
  const pct = 1.2 * bmi + 0.23 * idade - 10.8 * homem - 5.4;
  // Fora desta faixa a equação deixa de ser plausível e é melhor não usar.
  return Math.min(55, Math.max(8, Math.round(pct * 10) / 10));
}

/**
 * De onde saiu o percentual de gordura que virou massa magra.
 *
 * `bioimpedancia` é a medição do dia; `ajustada` é a mesma medição depois de
 * acompanhar o peso (ver `gorduraVigente` em `meta.ts`); `imc` é a equação de
 * Deurenberg, sem medição nenhuma. Os três eram dois — e a medição de três
 * meses atrás, aplicada ao peso de hoje, se apresentava como `bioimpedancia`.
 */
export type OrigemComposicao = 'bioimpedancia' | 'ajustada' | 'imc';

/**
 * Massa magra em kg — medida quando existe bioimpedância, estimada quando não.
 *
 * ── Por que a estimativa está aqui, e não um fallback para o peso total ──
 *
 * Porque o peso total é o erro. 2,4 g/kg de 84 kg com 42% de gordura pede
 * 202 g de proteína para alimentar 48 kg de tecido magro; a gordura não
 * consome proteína. A equação de Deurenberg erra alguns pontos percentuais em
 * quem tem muito músculo — e errar alguns pontos é muito melhor do que
 * multiplicar pela gordura inteira.
 *
 * `null` só quando não há como estimar (falta altura, idade ou gênero). Aí
 * quem chama decide o que fazer, em vez de receber um número inventado.
 *
 * ── `estimada` deixou de ser um booleano de duas pontas ──────────────────
 *
 * Um percentual medido há três meses, aplicado ao peso de hoje, voltava com
 * `estimada: false` — palpite com etiqueta de medição, e a suposição
 * escondida era que todo peso ganho ou perdido no meio tempo tinha a
 * composição da medição antiga. Quem chama passa `origem` e o retorno diz a
 * verdade; `estimada` continua existindo e significa "não é uma medição
 * direta", que é o que a tela precisa saber para não mentir.
 */
export function massaMagraDe(
  pesoKg: number,
  gorduraPct: number | null,
  estimar?: { alturaCm: number; idade: number; genero: string },
  origem: OrigemComposicao = 'bioimpedancia'
): { kg: number; pct: number; estimada: boolean; origem: OrigemComposicao } | null {
  if (gorduraPct !== null && gorduraPct !== undefined)
    return {
      kg: pesoKg * (1 - gorduraPct / 100),
      pct: gorduraPct,
      estimada: origem !== 'bioimpedancia',
      origem,
    };
  if (!estimar) return null;
  const pct = gorduraPorImc(pesoKg, estimar.alturaCm, estimar.idade, estimar.genero);
  return { kg: pesoKg * (1 - pct / 100), pct, estimada: true, origem: 'imc' };
}

/** Massa magra e massa gorda em kg, a partir do percentual da bioimpedância. */
export function composicao(pesoKg: number, gorduraPct: number) {
  const gorduraKg = (pesoKg * gorduraPct) / 100;
  return {
    gorduraKg: Math.round(gorduraKg * 10) / 10,
    magraKg: Math.round((pesoKg - gorduraKg) * 10) / 10,
  };
}

/**
 * Classificação de gordura visceral (escala de bioimpedância, 1–59).
 *
 * É o marcador que mais importa para saúde metabólica — gordura visceral
 * envolve os órgãos e se associa a resistência à insulina e doença
 * cardiovascular, diferente da subcutânea, que é sobretudo estética.
 */
export function classificarVisceral(v: number): {
  texto: string;
  cor: string;
  risco: string;
} {
  if (v <= 9)
    return {
      texto: 'Saudável',
      cor: '#00D68F',
      risco: 'Faixa de menor risco metabólico. Manter aqui.',
    };
  if (v <= 14)
    return {
      texto: 'Alto',
      cor: '#FFB020',
      risco: 'Acima do ideal. Associado a resistência à insulina — reduzir é prioridade de saúde, não de estética.',
    };
  return {
    texto: 'Muito alto',
    cor: '#FF4757',
    risco: 'Faixa de risco elevado para doença metabólica e cardiovascular. Vale conversa com médico.',
  };
}

/** Classificação de percentual de gordura por idade e sexo (faixas Tanita). */
export function classificarGordura(
  pct: number,
  idade: number,
  genero: Genero
): { texto: string; cor: string } {
  const fem = genero === 'feminino';
  let baixo: number, normalTopo: number, altoTopo: number;

  if (idade < 40) {
    baixo = fem ? 21 : 8;
    normalTopo = fem ? 32.9 : 19.9;
    altoTopo = fem ? 38.9 : 24.9;
  } else if (idade < 60) {
    baixo = fem ? 23 : 11;
    normalTopo = fem ? 33.9 : 21.9;
    altoTopo = fem ? 39.9 : 27.9;
  } else {
    baixo = fem ? 24 : 13;
    normalTopo = fem ? 35.9 : 24.9;
    altoTopo = fem ? 41.9 : 29.9;
  }

  if (pct < baixo) return { texto: 'Baixo', cor: '#3B9EFF' };
  if (pct <= normalTopo) return { texto: 'Saudável', cor: '#00D68F' };
  if (pct <= altoTopo) return { texto: 'Alto', cor: '#FFB020' };
  return { texto: 'Muito alto', cor: '#FF4757' };
}

/** 1 kg de gordura corporal ≈ 7.700 kcal. */
export const KCAL_POR_KG_GORDURA = 7700;

/**
 * Taxa máxima de perda de peso, como fração do peso corporal por semana.
 *
 * Ruiz-Castellano et al. 2021, *Nutrients* 13(9):3255 — "Achieving an Optimal
 * Fat Loss Phase in Resistance-Trained Athletes"
 * (https://pmc.ncbi.nlm.nih.gov/articles/PMC8471721/, aberta e conferida):
 * *"a loss of BW of 0.5–1.0 %/week, accompanied by a high protein intake and
 * resistance exercises, could favor the retention of FFM"*. Os autores pedem
 * a ponta de baixo conforme a gordura corporal cai — o que aqui acontece
 * sozinho, porque o teto de mobilização abaixo aperta junto.
 *
 * 1,0% é o TETO, não a recomendação: o app usa 15% de déficit e quase nunca
 * chega perto disso.
 */
export const TAXA_PERDA_SEMANAL_MAX = 0.01;

/**
 * Energia que a gordura corporal consegue entregar por dia, em kcal por kg.
 *
 * Alpert 2005 (https://pubmed.ncbi.nlm.nih.gov/15615615/, aberta e conferida):
 * *"a value of (290+/-25) kJ/kgd"*. 290 kJ ÷ 4,184 = **69,3 kcal por kg de
 * gordura por dia**.
 *
 * ── O erro que este número conserta ──────────────────────────────────────
 *
 * O código dizia **31**, citando o mesmo artigo. 31,4 é o valor por LIBRA
 * (31,4 kcal/lb ≈ 69,2 kcal/kg) — aplicado por quilograma vira um teto 2,2×
 * mais apertado que a fonte. Enquanto esta função era código morto isso não
 * custava nada; a Fase 5 a ligou como piso calórico e o número passou a
 * INFLAR a meta de quem é magro: 75 kg com 8% de gordura tem teto de 186 kcal
 * pelo número errado e 416 pelo da fonte, então um déficit pedido de 386 era
 * cortado para 186 e a meta subia 200 kcal — com a tela explicando o corte
 * citando o artigo.
 */
export const KCAL_POR_KG_GORDURA_DIA = 290 / 4.184;

/**
 * O maior déficit diário que este corpo aguenta — pelo menor dos dois tetos.
 *
 * São duas perguntas diferentes e as duas limitam:
 *   · **Quanto a gordura entrega por dia** (Alpert). Aperta em quem é magro:
 *     6 kg de gordura só liberam ~416 kcal/dia, e cortar mais que isso tira
 *     massa magra — é o que faz gente emagrecer e ficar flácida.
 *   · **Quão rápido dá para perder** (Ruiz-Castellano). Aperta em quem tem
 *     muita gordura: 63 kg de gordura "entregariam" 4.366 kcal/dia pelo
 *     primeiro teto, o que seria perder 4% do peso por semana.
 *
 * Nenhum dos dois sozinho cobre os dois corpos, então vale o menor.
 */
export function deficitMaximoSeguro(pesoKg: number, gorduraPct: number): number {
  const gorduraKg = (pesoKg * gorduraPct) / 100;
  const porMobilizacao = gorduraKg * KCAL_POR_KG_GORDURA_DIA;
  const porTaxaDePerda = (pesoKg * TAXA_PERDA_SEMANAL_MAX * KCAL_POR_KG_GORDURA) / 7;
  return Math.round(Math.min(porMobilizacao, porTaxaDePerda));
}

/** Qual dos dois tetos está mordendo — a tela precisa dizer o motivo certo. */
export function tetoQueMorde(pesoKg: number, gorduraPct: number): 'gordura' | 'ritmo' {
  const gorduraKg = (pesoKg * gorduraPct) / 100;
  return gorduraKg * KCAL_POR_KG_GORDURA_DIA <= (pesoKg * TAXA_PERDA_SEMANAL_MAX * KCAL_POR_KG_GORDURA) / 7
    ? 'gordura'
    : 'ritmo';
}

export const LABEL_OBJETIVO_V2: Record<string, string> = {
  recomposicao: 'Ganhar massa e perder gordura',
  hipertrofia: 'Ganhar massa',
  emagrecimento: 'Perder gordura',
  manutencao: 'Manter o peso',
};

export const DESC_OBJETIVO_V2: Record<string, string> = {
  recomposicao:
    'Déficit leve com proteína alta. Funciona bem para quem tem gordura a perder ou está voltando de uma pausa.',
  hipertrofia: 'Superávit de 15%. Ganho de massa mais rápido, com algum ganho de gordura junto.',
  emagrecimento: 'Déficit de 15% com proteína alta para proteger a massa magra.',
  manutencao: 'Calorias iguais ao gasto. Mantém o que já tem.',
};
