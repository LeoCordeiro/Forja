/**
 * Confere as regras do gerador que não dá para ver no olho.
 *
 * O treino "genérico" que o usuário reclamou não era falta de exercício na
 * tela: era o catálogo desequilibrado (44 exercícios de superior contra 17 de
 * inferior, glúteo com três) e a ênfase mexendo só em volume, nunca em ordem.
 * Nenhuma das duas coisas aparece olhando uma tela — só contando.
 *
 *   npm run testar:gerador
 */
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano, REGIOES } from '../src/features/treino/gerador.ts';
import { padraoDe, ehComposto, ehPesado } from '../src/features/treino/classificacao.ts';
import { LOCAIS } from '../src/features/treino/local.ts';

// O seed vira o mesmo formato que o gerador recebe do banco.
const TODOS = EXERCICIOS.map(([nome, grupo, sec, equip, carga], i) => ({
  id: i + 1,
  nome,
  grupo_primario: grupo,
  grupos_secundarios: sec,
  equipamento: equip,
  tipo_carga: carga,
}));
const fonte = {
  catalogo: TODOS.filter((e) => e.grupo_primario !== 'cardio'),
  cardio: TODOS.filter((e) => e.grupo_primario === 'cardio'),
};

const base = {
  dias: 4,
  diasDisponiveis: [1, 2, 4, 5],
  experiencia: 'intermediario',
  objetivo: 'hipertrofia',
  local: 'academia',
  minutosPorDia: [60, 60, 60, 60, 60, 60, 60],
  preferenciaEquipamento: 'indiferente',
  focos: [],
  dores: [],
  // -1 = não perguntado, que é o estado de quem nunca respondeu.
  barraFixaReps: -1,
};

let falhas = 0;
const ok = (nome, cond, detalhe = '') => {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

const contarSeries = (plano) => {
  const c = {};
  for (const d of plano.dias)
    for (const e of d.exercicios) {
      c[e.grupo] = (c[e.grupo] ?? 0) + e.series;
      for (const s of e.secundarios) c[s] = (c[s] ?? 0) + e.series * 0.5;
    }
  return c;
};

// ── 1. Catálogo equilibrado ────────────────────────────────────────────────
console.log('\n1. Catálogo');
const porGrupo = {};
for (const e of TODOS) porGrupo[e.grupo_primario] = (porGrupo[e.grupo_primario] ?? 0) + 1;
const inferior = ['gluteo', 'quadriceps', 'posterior', 'panturrilha'].reduce(
  (s, g) => s + (porGrupo[g] ?? 0), 0
);
const superior = ['peito', 'costas', 'ombro', 'biceps', 'triceps'].reduce(
  (s, g) => s + (porGrupo[g] ?? 0), 0
);
ok('inferior não é menos que metade do superior', inferior >= superior / 2, `${inferior} x ${superior}`);
for (const g of ['gluteo', 'posterior', 'quadriceps', 'panturrilha'])
  ok(`${g} tem ao menos 6 opções`, (porGrupo[g] ?? 0) >= 6, String(porGrupo[g] ?? 0));

// ── 2. Todo local consegue treinar perna ───────────────────────────────────
console.log('\n2. Cobertura por local de treino');
for (const l of LOCAIS) {
  const eq = new Set(l.equipamentos);
  const temPerna = ['gluteo', 'quadriceps', 'posterior'].every((g) =>
    TODOS.some((e) => e.grupo_primario === g && eq.has(e.equipamento))
  );
  ok(`${l.label}: tem glúteo, quadríceps e posterior`, temPerna);
}

// ── 3. O foco lidera a sessão ──────────────────────────────────────────────
console.log('\n3. Ênfase muda a ORDEM, não só o volume');
for (const foco of [['gluteo'], ['costas'], ['inferior']]) {
  const plano = await montarPlano({ ...base, focos: foco }, fonte);
  const alvos = new Set(
    foco.flatMap((f) => REGIOES[f] ?? [f])
  );
  const diasComAlvo = plano.dias.filter((d) => d.exercicios.some((e) => alvos.has(e.grupo)));
  const lideram = diasComAlvo.filter((d) => alvos.has(d.exercicios[0]?.grupo));
  ok(
    `foco ${foco.join('+')}: abre a sessão em todo dia que o contém`,
    lideram.length === diasComAlvo.length,
    `${lideram.length}/${diasComAlvo.length} dias`
  );
}

// ── 4. Foco realmente aumenta o volume do alvo ─────────────────────────────
console.log('\n4. Ênfase entrega mais série no alvo');
// A régua é o volume DIRETO, não o total. O total esbarra no teto de
// recuperação e fica parado nos dois casos — o que muda com o foco é quanto
// daquele total é trabalho dirigido em vez de sobra de composto. Medir o total
// dizia "o foco não fez nada" enquanto o glúteo direto subia 50%.
const soDireto = (plano) => {
  const c = {};
  for (const d of plano.dias) for (const e of d.exercicios) c[e.grupo] = (c[e.grupo] ?? 0) + e.series;
  return c;
};
const planoNeutro = await montarPlano({ ...base, focos: [] }, fonte);
const planoGluteo = await montarPlano({ ...base, focos: ['gluteo'] }, fonte);
const semFoco = soDireto(planoNeutro);
const comGluteo = soDireto(planoGluteo);
ok('glúteo direto sobe quando é o foco', comGluteo.gluteo > semFoco.gluteo,
   `${semFoco.gluteo} → ${comGluteo.gluteo} séries diretas`);
ok('peito cede quando não é o foco', comGluteo.peito <= semFoco.peito,
   `${semFoco.peito} → ${comGluteo.peito}`);

// O DIRETO do grupo em foco não passa do alvo — é ele que o gerador controla.
// O total pode subir mais, porque a divisão com foco também empilha composto
// que trabalha o grupo junto (dia de perna dá glúteo indireto de graça). Esse
// excesso é declarado no aviso, e é o aviso que o teste cobra logo abaixo.
const totalGluteo = contarSeries(planoGluteo);
ok('o direto do foco respeita o alvo', comGluteo.gluteo <= 20,
   `${comGluteo.gluteo} séries diretas`);
ok('e o total alto vem explicado',
   totalGluteo.gluteo <= 26 ||
     planoGluteo.avisos.some((a) => a.includes('passa do alvo por causa dos compostos')),
   `${totalGluteo.gluteo} no total`);

// ── 5. Nenhum grupo grande fica abaixo do piso ─────────────────────────────
console.log('\n5. Volume semanal dentro da faixa da literatura');
for (const cenario of [
  { nome: 'iniciante 3 dias', p: { ...base, dias: 3, diasDisponiveis: [1, 3, 5], experiencia: 'iniciante' } },
  { nome: 'intermediário 4 dias', p: base },
  { nome: 'avançado 6 dias', p: { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], experiencia: 'avancado' } },
  { nome: 'casa sem equipamento', p: { ...base, local: 'casa_simples' } },
]) {
  const plano = await montarPlano(cenario.p, fonte);
  const c = contarSeries(plano);
  const grandes = ['peito', 'costas', 'quadriceps', 'ombro'];
  const baixos = grandes.filter((g) => (c[g] ?? 0) < 8);
  ok(`${cenario.nome}: nenhum grupo grande abaixo de 8 séries/semana`, !baixos.length,
     baixos.length ? baixos.map((g) => `${g}=${c[g] ?? 0}`).join(', ') : '');
  // O gerador controla o volume DIRETO. O indireto vem de composto que está na
  // sessão por outro motivo — cortar supino para "consertar" o ombro destruiria
  // o peito. Então a régua é: direto dentro do teto, e excesso indireto dito em
  // voz alta em vez de escondido.
  const direto = {};
  for (const d of plano.dias)
    for (const e of d.exercicios) direto[e.grupo] = (direto[e.grupo] ?? 0) + e.series;
  const altos = Object.entries(direto).filter(([g, v]) => v > 22 && g !== 'abdomen');
  ok(`${cenario.nome}: nenhum grupo acima de 22 séries DIRETAS/semana`, !altos.length,
     altos.map(([g, v]) => `${g}=${v}`).join(', '));

  const estourados = Object.entries(c).filter(([g, v]) => v > 26 && g !== 'abdomen').map(([g]) => g);
  const explicados = estourados.every(() =>
    plano.avisos.some((a) => a.includes('passa do alvo por causa dos compostos'))
  );
  ok(`${cenario.nome}: excesso indireto vem explicado`, explicados,
     estourados.length ? `total alto em: ${estourados.join(', ')}` : 'nenhum grupo estourou');
}

// ── 5b. O foco muda a DIVISÃO, não só o volume ─────────────────────────────
//
// Era o buraco de verdade: `SPLITS` é indexado só por dias, então quem marcava
// "superiores" e treinava 5 dias recebia o mesmo esqueleto de sempre, com DOIS
// dias de perna. O app perguntava o foco e montava a semana como se não tivesse
// perguntado.
console.log('\n5b. Foco muda a estrutura da semana');
const INFERIOR = ['quadriceps', 'posterior', 'gluteo', 'panturrilha'];
const diasDe = (plano, grupos) =>
  plano.dias.filter((d) => {
    const cont = {};
    for (const e of d.exercicios) cont[e.grupo] = (cont[e.grupo] ?? 0) + e.series;
    const alvo = grupos.reduce((s, g) => s + (cont[g] ?? 0), 0);
    const total = Object.values(cont).reduce((s, v) => s + v, 0);
    return total > 0 && alvo / total > 0.5; // o dia é majoritariamente daquilo
  }).length;

for (const cen of [
  { foco: ['superior'], dias: 5, esperaPerna: 1 },
  { foco: ['superior'], dias: 4, esperaPerna: 1 },
  { foco: ['superior'], dias: 6, esperaPerna: 1 },
]) {
  const plano = await montarPlano(
    { ...base, dias: cen.dias, diasDisponiveis: [1, 2, 3, 4, 5, 6].slice(0, cen.dias), focos: cen.foco },
    fonte
  );
  const perna = diasDe(plano, INFERIOR);
  ok(`foco superior, ${cen.dias} dias: ${cen.esperaPerna} dia de perna`, perna === cen.esperaPerna,
     `${perna} dia(s) — ${plano.dias.map((d) => d.nome.replace(/^[A-F] — /, '')).join(' / ')}`);
  ok(`foco superior, ${cen.dias} dias: avisa o custo da frequência`,
     plano.avisos.some((a) => a.includes('1× por semana')));
}

// Foco em inferiores não é simétrico ao de superiores, e isso é de propósito.
// "Superior" são cinco grupos (peito, costas, ombro, bíceps, tríceps): empurrar
// todos para um único dia da semana é pior do que o ganho de abrir mais um dia
// de perna. Então em 4 dias a resposta certa é 2 e 2 — o que muda é que os dias
// de perna passam a ser especializados (um de quadríceps, um de posterior e
// glúteo) em vez de dois dias iguais. De 5 dias em diante sobra folga e o foco
// vira dia a mais de verdade.
for (const { dias, minimo } of [{ dias: 4, minimo: 2 }, { dias: 5, minimo: 3 }, { dias: 6, minimo: 3 }]) {
  const disp = [1, 2, 3, 4, 5, 6].slice(0, dias);
  const plano = await montarPlano({ ...base, dias, diasDisponiveis: disp, focos: ['inferior'] }, fonte);
  const semFocoAqui = await montarPlano({ ...base, dias, diasDisponiveis: disp, focos: [] }, fonte);
  const perna = diasDe(plano, INFERIOR);
  const nomes = plano.dias.map((d) => d.nome.replace(/^[A-F] — /, '')).join(' / ');

  ok(`foco inferior, ${dias} dias: pelo menos ${minimo} dias de perna`, perna >= minimo,
     `${perna} de ${dias} — ${nomes}`);
  ok(`foco inferior, ${dias} dias: nunca menos perna que sem foco`,
     perna >= diasDe(semFocoAqui, INFERIOR),
     `${perna} com foco x ${diasDe(semFocoAqui, INFERIOR)} sem`);
  // Dias de perna especializados: nenhum par de dias de perna igual.
  const nomesPerna = plano.dias
    .filter((d) => d.exercicios.some((e) => INFERIOR.includes(e.grupo)))
    .map((d) => d.nome);
  ok(`foco inferior, ${dias} dias: dias de perna não se repetem`,
     new Set(nomesPerna).size === nomesPerna.length);
}

// Sem foco, a divisão equilibrada de sempre.
const neutro = await montarPlano({ ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: [] }, fonte);
ok('sem foco: continua a divisão equilibrada', diasDe(neutro, INFERIOR) === 2,
   `${diasDe(neutro, INFERIOR)} dia(s) de perna`);

// ── 6. Casa sem equipamento não sai sem perna ──────────────────────────────
console.log('\n6. Em casa, sem equipamento');
const casa = await montarPlano({ ...base, local: 'casa_simples' }, fonte);
const gruposCasa = new Set(casa.dias.flatMap((d) => d.exercicios.map((e) => e.grupo)));
ok('o plano tem quadríceps', gruposCasa.has('quadriceps'));
ok('o plano tem glúteo', gruposCasa.has('gluteo'));
ok('o plano tem posterior', gruposCasa.has('posterior'));
console.log('   grupos no plano:', [...gruposCasa].join(', '));

// ── 7. Sem exercício repetido no mesmo dia ─────────────────────────────────
console.log('\n7. Repetição');
const cheio = await montarPlano({ ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], focos: ['inferior'] }, fonte);
let repetiu = 0;
for (const d of cheio.dias) {
  const nomes = d.exercicios.map((e) => e.nome);
  if (new Set(nomes).size !== nomes.length) repetiu++;
}
ok('nenhum dia repete exercício', repetiu === 0, `${repetiu} dia(s)`);

// ── 8. Força relativa: não prescrever o que a pessoa não consegue fazer ─────
//
// Barra fixa 4×5-8 para quem faz 3 no máximo não é treino difícil: é treino que
// não acontece. E como ela é composta, entrava no COMEÇO do dia de costas — a
// sessão inteira passava a começar numa falha.
console.log('\n8. Força relativa (barra fixa)');
const nomesDe = (plano) => new Set(plano.dias.flatMap((d) => d.exercicios.map((e) => e.nome)));
const cincoDias = { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['superior'] };

const comTres = await montarPlano({ ...cincoDias, barraFixaReps: 3 }, fonte);
const nomes3 = nomesDe(comTres);
ok('com 3 barras: barra fixa fica fora', !nomes3.has('Barra fixa'));
ok(
  'com 3 barras: entra a ponte, que ainda exige sustentar o peso',
  nomes3.has('Puxada assistida no graviton') || nomes3.has('Barra fixa negativa'),
  [...nomes3].filter((n) => /graviton|negativa/i.test(n)).join(', ') || 'nenhuma'
);
ok(
  'com 3 barras: costas continua tendo exercício',
  comTres.dias.some((d) => d.exercicios.some((e) => e.grupo === 'costas'))
);
ok('com 3 barras: a troca vem explicada', comTres.avisos.some((a) => a.includes('repetições limpas')));

const comDez = await montarPlano({ ...cincoDias, barraFixaReps: 10 }, fonte);
ok('com 10 barras: barra fixa volta ao plano', nomesDe(comDez).has('Barra fixa'));

const semResposta = await montarPlano({ ...cincoDias, barraFixaReps: -1 }, fonte);
ok('sem resposta: nada é escondido', nomesDe(semResposta).has('Barra fixa'));

// Onde a substituta não existe, o exercício difícil FICA — exercício nenhum
// para um grupo é pior que exercício difícil.
const casaFraca = await montarPlano({ ...base, local: 'casa_simples', barraFixaReps: 0 }, fonte);
const gruposCasa2 = new Set(casaFraca.dias.flatMap((d) => d.exercicios.map((e) => e.grupo)));
for (const g of ['posterior', 'ombro', 'peito'])
  ok(`casa sem equipamento: ${g} não desaparece por causa da troca`, gruposCasa2.has(g));

// ══════════════════════════════════════════════════════════════════════════
// G1 — a granularidade que faltava
//
// Os testes 1-8 mediam volume por SEMANA e repetição de exercício ENTRE DIAS.
// O treino defeituoso que chegou ao celular do Leonardo passou por todos eles:
// as 22 séries de peito couberam no teto SEMANAL (28 com ênfase) e os quatro
// supinos do mesmo padrão são quatro NOMES distintos no mesmo dia.
//
// O que se mede daqui para baixo é a sessão: séries por grupo POR SESSÃO,
// exercícios por PADRÃO DE MOVIMENTO dentro do dia, frequência semanal como
// restrição dura e ordem por papel na lista FINAL (não na montagem).
// ══════════════════════════════════════════════════════════════════════════

const PEQUENOS_T = ['biceps', 'triceps', 'panturrilha', 'abdomen', 'trapezio', 'antebraco'];
const GRANDES_T = ['peito', 'costas', 'ombro', 'quadriceps', 'posterior', 'gluteo'];
/** Teto por sessão sobre o total FRACIONADO (B2 do prescricao-alvo). */
const tetoSessao = (g) => (PEQUENOS_T.includes(g) ? 10 : 12);
/** Teto de séries do mesmo padrão de movimento numa sessão (B4). */
const tetoPadrao = (g) => (PEQUENOS_T.includes(g) ? 6 : 8);

/** Diretas + 0,5 × as séries de todo exercício que lista o grupo como secundário. */
const fracionadoDoDia = (d) => {
  const c = {};
  for (const e of d.exercicios) {
    if (e.grupo === 'cardio') continue;
    c[e.grupo] = (c[e.grupo] ?? 0) + e.series;
    for (const s of e.secundarios) {
      if (!s || s === 'cardio') continue;
      c[s] = (c[s] ?? 0) + e.series * 0.5;
    }
  }
  return c;
};

const diretasDoDia = (d) => {
  const c = {};
  for (const e of d.exercicios) {
    if (e.grupo === 'cardio') continue;
    c[e.grupo] = (c[e.grupo] ?? 0) + e.series;
  }
  return c;
};

const chave = (e) => `${e.grupo}:${padraoDe(e.nome, e.grupo)}`;

/** Cenários que cobrem experiência, dias, local, foco e preferência. */
const CENARIOS = [
  { nome: 'iniciante 3 dias', p: { ...base, dias: 3, diasDisponiveis: [1, 3, 5], experiencia: 'iniciante' } },
  { nome: 'intermediário 4 dias', p: base },
  { nome: 'avançado 6 dias', p: { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], experiencia: 'avancado' } },
  { nome: 'casa sem equipamento', p: { ...base, local: 'casa_simples' } },
  {
    nome: 'foco peito, 4 dias, 90 min, máquina',
    p: {
      ...base, dias: 4, diasDisponiveis: [1, 2, 4, 5], experiencia: 'iniciante',
      objetivo: 'recomposicao', preferenciaEquipamento: 'maquina', focos: ['peito'],
      minutosPorDia: [90, 90, 90, 90, 90, 90, 90], barraFixaReps: 5,
    },
  },
  { nome: 'foco superior 5 dias', p: { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['superior'] } },
  { nome: 'foco inferior 4 dias', p: { ...base, dias: 4, focos: ['inferior'] } },
  { nome: 'foco glúteo 6 dias 90 min', p: { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], focos: ['gluteo'], minutosPorDia: [90, 90, 90, 90, 90, 90, 90] } },
  { nome: 'avançado 4 dias 120 min', p: { ...base, experiencia: 'avancado', minutosPorDia: [120, 120, 120, 120, 120, 120, 120] } },
];

const planos = [];
for (const c of CENARIOS) planos.push({ ...c, plano: await montarPlano(c.p, fonte) });

// ── 9. Teto de séries POR SESSÃO, sobre o total fracionado (A1) ────────────
//
// `TETO_SERIES_SESSAO = 10` só valia na montagem. `preencherTempo` acrescentava
// depois validando contra o teto SEMANAL — e com o grupo aparecendo 1× na
// semana, semanal e por sessão viraram a mesma coisa: 22 séries num teto de 10.
console.log('\n9. Teto de séries por SESSÃO (fracionado: 12 grande / 10 pequeno)');
for (const { nome, plano } of planos) {
  const estouros = [];
  for (const d of plano.dias) {
    const frac = fracionadoDoDia(d);
    const diretas = diretasDoDia(d);
    for (const [g, v] of Object.entries(frac)) {
      // Grupo sem NENHUM trabalho direto na sessão só recebe respingo de
      // composto alheio: não há série própria para cortar sem destruir o dono
      // do composto, e isso o aviso de excesso indireto já cobre.
      if (!diretas[g]) continue;
      if (v > tetoSessao(g)) estouros.push(`${d.nome}/${g}=${v}`);
    }
  }
  ok(`${nome}: nenhuma sessão acima do teto`, !estouros.length, estouros.join(', '));
}

// ── 10. Teto por PADRÃO DE MOVIMENTO dentro da sessão (A3) ─────────────────
//
// O teste antigo comparava NOMES entre dias. Supino máquina, supino no smith,
// supino com barra e flexão são quatro nomes distintos e um só padrão — quatro
// vezes o mesmo movimento na mesma sessão, e o teste dizia "ok".
console.log('\n10. Teto por padrão de movimento na sessão (2 exercícios / 8 séries)');
for (const { nome, plano } of planos) {
  const demais = [];
  const seriesDemais = [];
  for (const d of plano.dias) {
    const conta = {};
    const series = {};
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio') continue;
      const k = chave(e);
      conta[k] = (conta[k] ?? 0) + 1;
      series[k] = (series[k] ?? 0) + e.series;
    }
    for (const [k, n] of Object.entries(conta)) if (n > 2) demais.push(`${d.nome}/${k}=${n}`);
    for (const [k, s] of Object.entries(series))
      if (s > tetoPadrao(k.split(':')[0])) seriesDemais.push(`${d.nome}/${k}=${s}`);
  }
  ok(`${nome}: no máximo 2 exercícios por padrão`, !demais.length, demais.join(', '));
  ok(`${nome}: no máximo 8/6 séries por padrão`, !seriesDemais.length, seriesDemais.join(', '));
}

// ── 11. Frequência mínima como RESTRIÇÃO DURA (A2) ─────────────────────────
//
// A causa-raiz. `SPLITS_FOCO.superior[4]` dava peito 1× e costas 1× na semana —
// para quem pediu ênfase em PEITO. E o aviso de frequência só olhava a região
// preterida, então nunca percebia que o grupo enfatizado tinha caído.
console.log('\n11. Todo grupo grande 2× por semana (restrição dura)');
const aparicoesReais = (plano) => {
  const c = {};
  for (const d of plano.dias) {
    for (const g of new Set(d.exercicios.map((e) => e.grupo))) c[g] = (c[g] ?? 0) + 1;
  }
  return c;
};

for (const dias of [3, 4, 5, 6]) {
  const disp = [1, 2, 3, 4, 5, 6].slice(0, dias);
  for (const focos of [[], ['superior'], ['inferior'], ['peito'], ['costas'], ['gluteo'], ['ombro']]) {
    const plano = await montarPlano({ ...base, dias, diasDisponiveis: disp, focos }, fonte);
    const ap = aparicoesReais(plano);
    // A região PRETERIDA em 1× é o custo declarado da ênfase — o aviso cobre.
    const regiao = focos.includes('superior') || focos.includes('peito') || focos.includes('costas') || focos.includes('ombro')
      ? 'inferior'
      : focos.includes('inferior') || focos.includes('gluteo')
        ? 'superior'
        : null;
    const tolerado = new Set(regiao ? REGIOES[regiao] : []);
    const caidos = GRANDES_T.filter((g) => (ap[g] ?? 0) === 1 && !tolerado.has(g));
    ok(
      `${dias} dias, foco ${focos.join('+') || 'nenhum'}: nenhum grupo grande em 1×`,
      !caidos.length,
      caidos.map((g) => `${g}=${ap[g]}`).join(', ')
    );
    // Ênfase é mais série e/ou mais aparição — NUNCA menos aparição.
    if (focos.length) {
      const neutroPlano = await montarPlano({ ...base, dias, diasDisponiveis: disp, focos: [] }, fonte);
      const apNeutro = aparicoesReais(neutroPlano);
      // Só grupo GRANDE: A2 fala de `aparicoes(grupo_grande)`. Bíceps e
      // panturrilha somem de um dia por corte de tempo sem que isso seja
      // problema de frequência — toda remada e todo agachamento os treinam
      // junto. (Panturrilha sumindo do plano INTEIRO é outro assunto, anotado
      // como candidato no roadmap.)
      const alvos = focos.flatMap((f) => REGIOES[f] ?? [f]).filter((g) => GRANDES_T.includes(g));
      const perderam = alvos.filter((g) => (ap[g] ?? 0) < (apNeutro[g] ?? 0));
      ok(
        `${dias} dias, foco ${focos.join('+')}: o alvo não perde aparição`,
        !perderam.length,
        perderam.map((g) => `${g}: ${apNeutro[g]} → ${ap[g]}`).join(', ')
      );
    }
  }
}

// ── 12. Ordem por papel na lista FINAL (A4) ────────────────────────────────
//
// `porPapel` rodava só na montagem; `posicaoPara` insere sem reordenar. Por
// isso o supino no smith e o supino com barra (compostos pesados) caíram nas
// posições 4 e 5, depois de um crossover na 3.
console.log('\n12. Ordem por papel na lista final');
const papelDe = (n) => (ehPesado(n) ? 0 : ehComposto(n) ? 1 : 2);
for (const { nome, plano } of planos) {
  const foraDeOrdem = [];
  const espalhados = [];
  for (const d of plano.dias) {
    const blocos = {};
    d.exercicios.forEach((e, i) => {
      if (e.grupo === 'cardio') return;
      (blocos[e.grupo] ??= []).push({ i, e });
    });
    for (const [g, itens] of Object.entries(blocos)) {
      // O grupo é um bloco só: não pode aparecer, sumir e voltar na sessão.
      const contiguo = itens.every((x, k) => k === 0 || x.i === itens[k - 1].i + 1);
      if (!contiguo) espalhados.push(`${d.nome}/${g}`);
      for (let k = 1; k < itens.length; k++) {
        if (papelDe(itens[k].e.nome) < papelDe(itens[k - 1].e.nome))
          foraDeOrdem.push(`${d.nome}: ${itens[k].e.nome} depois de ${itens[k - 1].e.nome}`);
      }
    }
  }
  ok(`${nome}: nenhum composto pesado depois de isolador`, !foraDeOrdem.length, foraDeOrdem.join(' | '));
  ok(`${nome}: cada grupo é um bloco contíguo`, !espalhados.length, espalhados.join(', '));
}

// ── 13. O cenário exato do bug (B10) ───────────────────────────────────────
//
// dias=4, focos=['peito'], iniciante, academia, preferência máquina, 90 min,
// recomposição. Foi este perfil que produziu 7 exercícios de peito, 22 séries
// numa sessão e 4 supinos do mesmo padrão.
console.log('\n13. Cenário do bug — dia de peito');
const bug = planos.find((x) => x.nome.startsWith('foco peito')).plano;
const diaPeito = bug.dias
  .map((d) => ({ d, peito: fracionadoDoDia(d).peito ?? 0 }))
  .sort((a, b) => b.peito - a.peito)[0].d;

const fracPeito = fracionadoDoDia(diaPeito).peito ?? 0;
ok('peito: no máximo 12 séries fracionadas na sessão', fracPeito <= 12, `${fracPeito}`);

const forcaNoDia = diaPeito.exercicios.filter((e) => e.grupo !== 'cardio');
const padroesNoDia = new Set(forcaNoDia.map(chave));

// A régua de G1 é REDUNDÂNCIA ZERO, não a contagem bruta de padrões: nenhum
// exercício da sessão repete o padrão de outro. Contra o código antigo isto
// falhava feio — 10 exercícios para 5 padrões, quatro deles no mesmo supino.
ok('nenhum exercício da sessão repete padrão de outro', padroesNoDia.size === forcaNoDia.length,
   `${padroesNoDia.size} padrões em ${forcaNoDia.length} exercícios`);

// B10 quer 7 padrões. G1 entrega 5, e o que falta NÃO está em G1:
//   · tríceps: 15,5 fracionadas na semana contra teto 14 → sem folga para o 2º
//     exercício (extensão de cotovelo isolada). É A7, fase G2.
//   · ombro: 21 fracionadas contra teto 20 → sem folga para abdução lateral ou
//     face pull, e o desenvolvimento pesado continua comendo as 4 diretas.
//     É A9, fase G2.
// Os dois travam no teto SEMANAL fracionado, não no da sessão — ou seja, o
// gerador está recusando corretamente pela regra de A11 (folga de agenda não
// vira série). Subir esta trava para 6 é o critério de aceite de G2.
ok('a sessão cobre ao menos 5 padrões distintos', padroesNoDia.size >= 5,
   `${padroesNoDia.size}: ${[...padroesNoDia].join(', ')}`);

const contaPadrao = {};
for (const e of diaPeito.exercicios) {
  if (e.grupo === 'cardio') continue;
  contaPadrao[chave(e)] = (contaPadrao[chave(e)] ?? 0) + 1;
}
const pior = Object.entries(contaPadrao).sort((a, b) => b[1] - a[1])[0];
ok('no máximo 2 exercícios no padrão mais concorrido', pior[1] <= 2, `${pior[0]} = ${pior[1]}`);

const exPeito = diaPeito.exercicios.filter((e) => e.grupo === 'peito').length;
ok('no máximo 4 exercícios de peito na sessão', exPeito <= 4, `${exPeito}`);

const apBug = aparicoesReais(bug);
ok('peito aparece 2× na semana', (apBug.peito ?? 0) >= 2, `${apBug.peito ?? 0}×`);
ok('costas aparece 2× na semana', (apBug.costas ?? 0) >= 2, `${apBug.costas ?? 0}×`);

console.log(
  `   ${diaPeito.nome} (${diaPeito.minutos} min):\n` +
    diaPeito.exercicios
      .map((e) => `     ${e.nome} — ${e.series}×${e.repsMin}-${e.repsMax}, ${e.descanso}s [${chave(e)}]`)
      .join('\n')
);

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
