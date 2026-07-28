import type { Genero, Macros, Objetivo } from '@/db/types';

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

export function proteinaPorKg(objetivo: Objetivo | 'recomposicao'): number {
  switch (objetivo) {
    case 'recomposicao':
      return 2.6;
    case 'emagrecimento':
      return 2.4;
    case 'hipertrofia':
      return 1.9;
    default:
      return 1.8;
  }
}

/**
 * Macros para recomposição.
 *
 * A proteína é calculada sobre a MASSA MAGRA quando existe bioimpedância —
 * é o tecido que consome proteína. Usar o peso total superestima em quem tem
 * gordura alta: 2,6 g/kg de 88 kg dá 229 g, o que é desnecessário e caro.
 */
export function macrosRecomposicao(
  kcalAlvo: number,
  pesoKg: number,
  gorduraPct: number | null,
  estimar?: { alturaCm: number; idade: number; genero: string }
): Macros & { baseCalculo: string } {
  // Sem bioimpedância, ESTIMA em vez de cair no peso total.
  //
  // O comentário acima já dizia que 2,6 g/kg de 88 kg dá 229 g e que isso é
  // desnecessário e caro — e o código fazia exatamente isso sempre que faltava
  // a balança de bioimpedância, que é o caso de quase todo mundo. A conta ficava
  // pior justamente em quem tem mais gordura: 84 kg com 42% de gordura pediam
  // 218 g de proteína para alimentar 48 kg de tecido magro.
  //
  // A estimativa por IMC não substitui medir, mas erra muito menos que ignorar.
  const pct =
    gorduraPct ?? (estimar ? gorduraPorImc(pesoKg, estimar.alturaCm, estimar.idade, estimar.genero) : null);
  const massaMagra = pct !== null ? pesoKg * (1 - pct / 100) : null;

  // 2,4 g por kg de massa magra. A faixa defensável para déficit é 2,2 a 3,1
  // (Helms et al., 2014), e o topo dela é de atleta muito magro em corte
  // agressivo — não de quem está começando recomposição. 2,4 protege a massa
  // magra sem virar meta que ninguém cumpre e sem encarecer a lista de compras.
  const proteina_g = massaMagra
    ? Math.round(massaMagra * 2.4)
    : Math.round(pesoKg * proteinaPorKg('recomposicao'));

  // Gordura em 25% das calorias: abaixo de ~20% começa a atrapalhar hormônio.
  const gordura_g = Math.round((kcalAlvo * 0.25) / 9);

  const restante = kcalAlvo - proteina_g * 4 - gordura_g * 9;
  const carbo_g = Math.max(0, Math.round(restante / 4));

  return {
    kcal: kcalAlvo,
    proteina_g,
    carbo_g,
    gordura_g,
    baseCalculo: massaMagra
      ? `2,4 g por kg de massa magra (${massaMagra.toFixed(1)} kg` +
        `${gorduraPct === null ? ', estimada pelo IMC' : ''})`
      : `2,6 g por kg de peso corporal`,
  };
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

/**
 * Projeção realista de perda de gordura.
 *
 * O teto de mobilização de gordura corporal é de aproximadamente 31 kcal por
 * kg de gordura por dia (Alpert, 2005). Passar disso, o déficit sai de massa
 * magra — é o que faz gente emagrecer e ficar flácida.
 */
export function deficitMaximoSeguro(pesoKg: number, gorduraPct: number): number {
  const gorduraKg = (pesoKg * gorduraPct) / 100;
  return Math.round(gorduraKg * 31);
}

export interface Projecao {
  semanas: number;
  pesoFinal: number;
  gorduraFinalPct: number;
  perdaGorduraKg: number;
  ganhoMagraKg: number;
}

/**
 * Projeta a evolução da composição corporal.
 *
 * Em recomposição, parte do déficit vem da gordura e ainda se ganha massa
 * magra — devagar. O ganho aqui é conservador de propósito: prometer 1 kg de
 * músculo por mês para quem não é iniciante é fantasia, e frustração é o que
 * mais faz gente largar.
 */
export function projetar(
  pesoKg: number,
  gorduraPct: number,
  deficitDiario: number,
  semanas: number,
  apto: boolean
): Projecao {
  const { gorduraKg, magraKg } = composicao(pesoKg, gorduraPct);

  // 7.700 kcal ≈ 1 kg de gordura.
  const perdaGorduraKg = Math.round(((deficitDiario * 7 * semanas) / 7700) * 10) / 10;
  // Iniciante/retomando: ~0,25 kg/semana de massa magra; caso contrário, ~0,05.
  const ganhoMagraKg = Math.round((apto ? 0.25 : 0.05) * semanas * 10) / 10;

  const novaGordura = Math.max(gorduraKg * 0.05, gorduraKg - perdaGorduraKg);
  const novaMagra = magraKg + ganhoMagraKg;
  const pesoFinal = Math.round((novaGordura + novaMagra) * 10) / 10;

  return {
    semanas,
    pesoFinal,
    gorduraFinalPct: Math.round((novaGordura / pesoFinal) * 1000) / 10,
    perdaGorduraKg,
    ganhoMagraKg,
  };
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
