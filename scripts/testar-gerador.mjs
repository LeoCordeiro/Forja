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
import { indiretoPorPadrao } from '../src/features/treino/papel.ts';
import { FORCA_RELATIVA, padraoDe, ehComposto, ehPesado } from '../src/features/treino/classificacao.ts';
import { foraDoLocal, LOCAIS } from '../src/features/treino/local.ts';
// `localConhecido` nasce nesta rodada — namespace, para o gate rodar contra o
// código anterior e FALHAR por asserção em vez de morrer no link.
import * as LOCAL_NS from '../src/features/treino/local.ts';
import { REGIOES_DOR } from '../src/features/perfil/diagnostico.ts';
import { CARDIO, RIR_POR_FASE } from '../src/features/treino/periodizacao.ts';
import { aquecimento } from '../src/features/treino/anilhas.ts';
import { hidratarSeries, inserirAproximacoes, numeroValendo } from '../src/features/treino/series.ts';
import { PAPEIS, rirNaFase } from '../src/features/treino/papel.ts';
import { modularSeries, resolverFase } from '../src/features/treino/fase.ts';
import { faseAtual, faseDaSemanaDoBloco, SEMANAS_DO_BLOCO, semanaDoBloco } from '../src/features/treino/programa.ts';
// `blocoVencido` nasce nesta rodada: namespace para o gate poder RODAR contra o
// código anterior e falhar por asserção, em vez de morrer no link.
import * as PROGRAMA_NS from '../src/features/treino/programa.ts';
const blocoVencido = PROGRAMA_NS.blocoVencido ?? ((semana) => semana > SEMANAS_DO_BLOCO);

// ── Namespace, e não `import { X }`, de propósito ───────────────────────────
//
// Estes símbolos NASCEM nesta fase. Com import nomeado, rodar o arquivo contra
// o código anterior não daria falha: daria SyntaxError de link e o processo
// morreria antes da primeira asserção — ou seja, o gate não poderia ser
// cumprido. Com namespace, ausente vale `undefined` e a asserção FALHA, que é
// o que o gate pede.
import * as PERIODIZACAO from '../src/features/treino/periodizacao.ts';
import * as GERADOR from '../src/features/treino/gerador.ts';
import * as PAPEL_NS from '../src/features/treino/papel.ts';

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

// ── 2b. Nenhum teste inventa um local ─────────────────────────────────────
//
// UNIDADE: a CHAVE de local. Não mede plano nenhum — mede se o INSTRUMENTO
// está apontado para onde ele diz que aponta. Três chaves inventadas
// (`academia_rede`, `academia_simples`, `casa_halteres`) caíram caladas em
// academia completa por três fases, e todo número medido "por local" desde G1
// era academia repetida. O fallback de `equipamentosDe` fica na produção; aqui
// ele é proibido, e é aqui que ele deveria ter sido proibido desde sempre.
console.log('\n2b. Todo local usado nos testes existe de verdade');
{
  const usados = new Set([...LOCAIS.map((l) => l.chave)]);
  ok('a lista de locais da grade sai de LOCAIS, não de literais', usados.size === LOCAIS.length,
     [...usados].join(', '));
  ok('existe uma checagem ESTRITA de chave de local', typeof LOCAL_NS.localConhecido === 'function',
     typeof LOCAL_NS.localConhecido);
  const desconhecidos = [...usados].filter((c) => !(LOCAL_NS.localConhecido ?? (() => true))(c));
  ok('nenhuma chave inventada', desconhecidos.length === 0, desconhecidos.join(', ') || 'todas válidas');
  ok('e são as cinco reais', LOCAIS.length === 5, LOCAIS.map((l) => l.chave).join(', '));
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
/** Excêntrico puro: RIR não é aferível ali. Espelha `papel.ts`. */
const EXCENTRICOS_T = new Set(['Flexão nórdica', 'Barra fixa negativa']);
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

/** Sem acento e em minúscula — o nome do dia é texto de produto, não chave. */
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O dia leva o nome do grupo? ("A — Peito e tríceps" leva o do tríceps.) */
const diaLevaONome = (nomeDoDia, grupo) => semAcento(nomeDoDia).includes(semAcento(grupo));

/**
 * O cardio bate com `CARDIO.porObjetivo`? Devolve o erro, ou '' quando bate.
 *
 * Três eixos, porque a saída auditada errou os três: modalidade (esteira, a que
 * o próprio app diz para evitar), duração (20 min contra 30) e frequência (todo
 * dia contra 3 sessões).
 */
/**
 * Equipamentos do local — **estrito**, sem o fallback de `equipamentosDe`.
 *
 * O fallback fica na produção (o app precisa abrir mesmo com perfil corrompido)
 * e sai daqui, porque foi exatamente ele que escondeu o defeito: a grade usava
 * `academia_rede`, `academia_simples` e `casa_halteres`, três chaves que NÃO
 * existem, e as três caíam caladas em academia completa. Três fases de números
 * medidos sobre a mesma academia repetida quatro vezes.
 */
const perfilLocal = (p) => {
  const l = LOCAIS.find((x) => x.chave === p.local);
  if (!l) throw new Error(`local inexistente no teste: "${p.local}" — válidos: ${LOCAIS.map((x) => x.chave).join(', ')}`);
  return new Set(l.equipamentos);
};

/** Padrões que o catálogo oferece para um grupo NAQUELE perfil. */
function padroesDoLocal(grupo, p) {
  const equip = perfilLocal(p);
  // Mesma exclusão por dor que o gerador aplica (`evitarPorDor`). Sem ela, a
  // asserção de variedade semanal cobrava o impossível e o número saía errado:
  // com dor no ombro saem `Elevação lateral` (o ÚNICO exercício do padrão
  // `lateral` no catálogo) e `Remada alta` (o único do `alta`), e num dia de
  // superior os padrões `desenvolvimento` e `frontal` já estão saturados pelo
  // indireto dos supinos. Sobra UM padrão de ombro possível — e cobrar dois ali
  // é cobrar do gerador algo que o catálogo não tem. É o mesmo motivo do filtro
  // de força relativa logo abaixo, que já era precedente aceito.
  const proibidos = new Set(
    (p.dores ?? []).flatMap((d) => REGIOES_DOR.find((x) => x.chave === d)?.evitar ?? [])
  );
  // E o que o LOCAL não tem apesar de a etiqueta de equipamento liberar
  // (`semEstes`): a Smart Fit tem cabo e máquina, mas não tem glute ham raise
  // nem flexão nórdica. Sem isto a asserção contaria padrão que o gerador está
  // proibido de escolher — o mesmo erro de unidade, um andar abaixo.
  const semLocal = foraDoLocal(p.local);
  const out = new Set();
  for (const e of fonte.catalogo) {
    if (e.grupo_primario !== grupo) continue;
    if (e.equipamento && !equip.has(e.equipamento)) continue;
    if (proibidos.has(e.nome) || semLocal.has(e.nome)) continue;
    // Mesmo filtro de força relativa que o gerador aplica: mergulho no
    // paralelo é o segundo padrão de peito em casa, e ele não existe para quem
    // ainda não sustenta o próprio peso. Contar padrão que o gerador nunca
    // poderia escolher faria a asserção cobrar o impossível.
    const r = FORCA_RELATIVA[e.nome];
    if (r && p.barraFixaReps >= 0 && p.barraFixaReps < r.minReps) continue;
    out.add(padraoDe(e.nome, grupo));
  }
  return out;
}

/**
 * Existia, em ALGUM dos dias em que o grupo aparece, um segundo padrão que o
 * gerador poderia ter escolhido sem quebrar A9?
 *
 * A régua da variedade semanal precisa desta pergunta porque "o catálogo tem
 * cinco padrões de ombro" não significa que cinco estavam disponíveis: num dia
 * de superior, `desenvolvimento` e `frontal` já vêm saturados de graça pelo
 * indireto dos supinos, e A9 manda o trabalho direto ir para o que ainda não
 * foi tocado. Medir sem isso conta como defeito o cumprimento da regra.
 *
 * `padroesSaturados` é a função do PRÓPRIO gerador — usada, não reescrita:
 * régua duplicada é como as duas contas de volume passaram meses discordando.
 * O `??` abaixo é só a compatibilidade que o GATE exige: para rodar este mesmo
 * arquivo contra o código anterior (onde a função ainda não era exportada) e
 * comparar os dois lados com a MESMA régua. No caminho vivo ele nunca é usado.
 */
const saturadosDe =
  GERADOR.padroesSaturados ??
  ((grupo, exs) => {
    const limiar = (PEQUENOS_T.includes(grupo) ? 6 : 8) / 2;
    return new Set(
      [...indiretoPorPadrao(grupo, exs)].filter(([, v]) => v >= limiar).map(([k]) => k)
    );
  });

function alcancaSegundoPadrao(grupo, p, plano) {
  const noPerfil = padroesDoLocal(grupo, p);
  if (noPerfil.size < 2) return false;
  for (const d of plano.dias) {
    if (!d.exercicios.some((e) => e.grupo === grupo)) continue;
    const saturados = saturadosDe(grupo, d.exercicios);
    const livres = [...noPerfil].filter((x) => !saturados.has(x));
    if (livres.length >= 2) return true;
  }
  return false;
}

const ORDEM_CARDIO = ['Bicicleta ergométrica', 'Elíptico', 'Remo ergômetro', 'Esteira'];

function conferirCardio(plano, p, fonteCat) {
  const comCardio = plano.dias.filter((d) => d.exercicios.some((e) => e.grupo === 'cardio'));

  // ── M2: o objetivo tem dose na constante? Então ele RECEBE cardio ────────
  //
  // A régua anterior era `emagrecimento || recomposicao`, que é a metade do
  // A10 que G2 corrigiu. `hipertrofia` (2 × 20 min) e `manutencao` (3 × 25 min)
  // têm dose escrita em `CARDIO.porObjetivo` e não recebiam nada: ou o app
  // prescreve o que a própria constante diz, ou a constante não devia dizer.
  const conf = CARDIO.porObjetivo[p.objetivo];
  if (!conf) return comCardio.length ? `cardio em ${comCardio.length} dias sem dose na constante` : '';

  // Mesmo fallback de `equipamentosDe`: local desconhecido cai em academia.
  const equip = new Set((LOCAIS.find((l) => l.chave === p.local) ?? LOCAIS[0]).equipamentos);
  const disponiveis = fonteCat.cardio.filter((e) => !e.equipamento || equip.has(e.equipamento));
  if (!disponiveis.length) return comCardio.length ? 'cardio prescrito sem modalidade disponível no local' : '';

  const esperadoDias = Math.min(conf.sessoes, plano.dias.length);
  if (comCardio.length > esperadoDias)
    return `cardio em ${comCardio.length} dias, esperado ${esperadoDias}`;

  // ── A régua que MEDE, em vez de conferir se o aviso existe ───────────────
  //
  // A versão anterior aceitava dose incompleta sempre que o aviso semanal
  // estivesse presente — e o gerador empurra esse aviso incondicionalmente,
  // toda vez que `comCardio.length < conf.sessoes`. Ou seja: a asserção não
  // podia falhar, e o "994 → 0" era garantido por construção. É o mesmo defeito
  // das chaves de local: o instrumento concordando consigo mesmo.
  //
  // Três reguas que PODEM falhar, nenhuma consultando a existência do aviso:
  //
  // 1. Quando há dias suficientes E nenhuma sessão perdeu o cardio para o
  //    relógio, a dose tem que estar COMPLETA. Aqui não há desculpa possível.
  const cortouPorTempo = plano.avisos.some((a) => a.includes('o cardio saiu da sessão'));
  if (!cortouPorTempo && plano.dias.length >= conf.sessoes && comCardio.length !== conf.sessoes)
    return `dose incompleta sem corte por tempo: ${comCardio.length} de ${conf.sessoes}`;
  // 2. Quando há menos DIAS que sessões e nada foi cortado, o plano tem que
  //    entregar o máximo que a agenda permite — não menos.
  if (!cortouPorTempo && comCardio.length !== esperadoDias)
    return `cardio em ${comCardio.length} dias, cabia ${esperadoDias}`;
  // 3. E quando a dose fica curta, os NÚMEROS do aviso têm que bater com o
  //    plano entregue. Antes bastava a frase existir; agora ela é lida. Um aviso
  //    que dissesse "3 de 3" sobre um plano com 0 sessões passava — e é
  //    exatamente o tipo de texto que envelhece errado quando a constante muda.
  if (comCardio.length < conf.sessoes) {
    const m = plano.avisos
      .map((a) => a.match(/das (\d+) sessões previstas para o seu objetivo, (\d+) couberam/))
      .find(Boolean);
    if (!m) return `${comCardio.length} de ${conf.sessoes} sessões e nenhum aviso semanal de dose`;
    if (Number(m[1]) !== conf.sessoes || Number(m[2]) !== comCardio.length)
      return `aviso diz ${m[2]} de ${m[1]}, plano tem ${comCardio.length} de ${conf.sessoes}`;
  }

  const preferida = ORDEM_CARDIO.find((n) => disponiveis.some((e) => e.nome === n)) ?? disponiveis[0].nome;
  for (const d of comCardio) {
    for (const e of d.exercicios) {
      if (e.grupo !== 'cardio') continue;
      if (e.nome !== preferida) return `${d.nome}: ${e.nome} em vez de ${preferida}`;
      if (e.repsMin !== conf.minutos * 60)
        return `${d.nome}: ${Math.round(e.repsMin / 60)} min em vez de ${conf.minutos}`;
    }
  }
  return '';
}

/** Como o aviso escreve o nome do grupo — para conferir o texto entregue. */
const COMO_SE_FALA_T = {
  peito: 'peito', costas: 'costas', ombro: 'ombro', biceps: 'bíceps',
  triceps: 'tríceps', quadriceps: 'quadríceps', posterior: 'posterior de coxa',
  gluteo: 'glúteo', panturrilha: 'panturrilha', abdomen: 'abdômen',
  trapezio: 'trapézio', antebraco: 'antebraço',
};

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
  // Os quatro perfis do cross-review. Estão nomeados porque cada um pegou um
  // defeito que os cenários acima não alcançavam — mantê-los aqui é o que
  // impede o defeito de voltar em silêncio.
  { nome: 'qa: foco ombro 3d/120min', p: { ...base, dias: 3, diasDisponiveis: [1, 3, 5], focos: ['ombro'], minutosPorDia: Array(7).fill(120) } },
  { nome: 'qa: foco inferior 4d/120min livre/dor joelho', p: { ...base, experiencia: 'avancado', focos: ['inferior'], minutosPorDia: Array(7).fill(120), preferenciaEquipamento: 'livre', dores: ['joelho'] } },
  { nome: 'qa: superior 6d/120min casa/dor lombar', p: { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], focos: ['superior'], local: 'casa_simples', minutosPorDia: Array(7).fill(120), dores: ['lombar'] } },
  { nome: 'qa: inferior 3d/45min casa', p: { ...base, dias: 3, diasDisponiveis: [1, 3, 5], focos: ['inferior'], local: 'casa_simples', minutosPorDia: Array(7).fill(45) } },
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
    const exsDoGrupo = (g) => d.exercicios.filter((e) => e.grupo === g).length;
    for (const [g, v] of Object.entries(frac)) {
      if (v <= tetoSessao(g)) continue;
      // A ÚNICA exceção — e é a que a função de fato entrega, não a que seria
      // conveniente supor. O grupo já está no mínimo: um exercício só, no piso
      // de 2 séries. Aí o excesso é indireto de verdade (duas séries diretas
      // não explicam um total de 10,5) e tirar o último exercício apagaria o
      // grupo da sessão sem consertar nada.
      //
      // A versão anterior isentava todo grupo com `!diretas[g]`, ou seja,
      // assumia exatamente a condição que o código NÃO cumpria: `ombro=15,5
      // com 6 diretas em 3 exercícios` passava batido porque nenhum dos 9
      // cenários caía nesse perfil. Era o teste prometendo garantia que a
      // função não dava — a lição que originou esta fase.
      if (exsDoGrupo(g) <= 1 && (diretas[g] ?? 0) <= 2) continue;
      estouros.push(`${d.nome}/${g}=${v} (diretas ${diretas[g] ?? 0}, exs ${exsDoGrupo(g)})`);
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
for (const { nome, plano, p: perfil } of planos) {
  const foraDeOrdem = [];
  const espalhados = [];
  // Os grupos em foco abrem a sessão por decisão do usuário (asserção 3), e
  // isso ganha do tier. A régua de tier vale para o RESTO.
  const emFoco = new Set((perfil?.focos ?? []).flatMap((f) => REGIOES[f] ?? [f]));
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
    }

    // UNIDADE: o DIA inteiro, não o bloco.
    //
    // A versão anterior comparava pares dentro do mesmo grupo e por isso
    // deixava passar 349 de 1.890 dias com composto pesado a 5-8/180 s DEPOIS
    // de isolador de OUTRO grupo — e 11,3% dos dias abrindo com monoarticular.
    // Era a mesma armadilha de unidade de medida que deixou passar as 22
    // séries: a regra estava certa e medida na escala errada.
    //
    // A exceção é a ÊNFASE: quem marcou glúteo faz glúteo primeiro, mesmo que
    // o glúteo do dia seja uma abdução. Então a régua começa depois do bloco
    // do primeiro grupo, que é o tema do dia.
    // A régua é o PRIMEIRO exercício de cada bloco, e não item a item: os
    // blocos são contíguos por decisão de A4, então o último de um bloco
    // sempre pode ser mais leve que o primeiro do seguinte sem que isso seja
    // defeito. O que é defeito — e era o que ninguém media — é um bloco que
    // ABRE com isolador vindo antes de um bloco que abre com composto pesado.
    const daForca = d.exercicios.filter((e) => e.grupo !== 'cardio');
    const aberturas = [];
    for (const e of daForca) if (!aberturas.some((x) => x.grupo === e.grupo)) aberturas.push(e);
    // Menos o primeiro: o bloco que abre o dia é o tema dele, escolhido pelo
    // modelo e pela ênfase — quem marcou glúteo faz glúteo primeiro.
    const semFoco = aberturas.filter((e) => !emFoco.has(e.grupo));
    for (let k = 2; k < semFoco.length; k++) {
      if (papelDe(semFoco[k].nome) < papelDe(semFoco[k - 1].nome))
        foraDeOrdem.push(
          `${d.nome}: bloco de ${semFoco[k].grupo} (${semFoco[k].nome}) depois de ${semFoco[k - 1].grupo}`
        );
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

// B10 quer 7 padrões. G1 entregou 5, e o que faltava não estava em G1:
//   · tríceps: 15,5 fracionadas na semana contra teto 14 → sem folga para o 2º
//     exercício (extensão de cotovelo isolada). Era A7, fase G2.
//   · ombro: 21 fracionadas contra teto 20 → sem folga para abdução lateral ou
//     face pull, e o desenvolvimento pesado comendo as 4 diretas. Era A9, G2.
// G2 destrava os dois: o piso de grupo pequeno (A7) não consulta o teto SEMANAL
// fracionado — ele é um piso de PRESCRIÇÃO, e o teto que ele respeita é o da
// sessão; e a restrição por cobertura indireta (A9) tira o desenvolvimento
// pesado do dia de empurrar, abrindo a vaga para abdução lateral e face pull.
ok('a sessão cobre ao menos 6 padrões distintos', padroesNoDia.size >= 6,
   `${padroesNoDia.size}: ${[...padroesNoDia].join(', ')}`);

// A7 pede mais que "dois exercícios": pede um monoarticular na posição
// ALONGADA. Para o tríceps, é a extensão de cotovelo acima da cabeça (testa,
// francês) — o padrão 'acima'. Sem ele, "peito e tríceps" continua sendo um dia
// de peito com o tríceps recebendo só o que sobra dos supinos.
const triNoDia = diaPeito.exercicios.filter((e) => e.grupo === 'triceps');
ok('o tríceps tem 2 exercícios no dia que leva o nome dele', triNoDia.length >= 2,
   `${triNoDia.length}: ${triNoDia.map((e) => e.nome).join(', ') || 'nenhum'}`);
ok('e um deles é extensão de cotovelo na posição alongada',
   triNoDia.some((e) => padraoDe(e.nome, 'triceps') === 'acima'),
   triNoDia.map((e) => padraoDe(e.nome, 'triceps')).join(', ') || 'nenhum');

// A9: o ombro do dia de empurrar entra por abdução, não por desenvolvimento.
const ombroNoDia = diaPeito.exercicios.filter((e) => e.grupo === 'ombro');
ok('nenhum desenvolvimento pesado no dia de empurrar',
   !ombroNoDia.some((e) => ehPesado(e.nome) && padraoDe(e.nome, 'ombro') === 'desenvolvimento'),
   ombroNoDia.map((e) => e.nome).join(', ') || 'nenhum');
ok('o ombro entra com padrões não-anteriores',
   ombroNoDia.every((e) => ['lateral', 'posterior'].includes(padraoDe(e.nome, 'ombro'))),
   ombroNoDia.map((e) => `${e.nome} [${padraoDe(e.nome, 'ombro')}]`).join(', ') || 'nenhum');

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
  `   ${diaPeito.nome} (${diaPeito.minutos} min` +
    `${diaPeito.minutosCardio ? ` + ${diaPeito.minutosCardio} min de cardio` : ''}):\n` +
    diaPeito.exercicios
      .map(
        (e) =>
          `     ${e.nome} — ${e.papel ?? '?'} — ${e.series}×${e.repsMin}-${e.repsMax}, ` +
          `RIR ${e.rirMin ?? '?'}-${e.rirMax ?? '?'}, ${e.descanso}s` +
          `${e.aquecimento ? ` (+${e.aquecimento} aprox.)` : ''} [${chave(e)}]`
      )
      .join('\n')
);

// ── 14. Séries por exercício (B2) ─────────────────────────────────────────
//
// O teto por padrão, sozinho, trocou um defeito por outro: recusando exercício
// redundante ele encolheu `quantos`, e `base = floor(naSessao / quantos)`
// continuou dividindo o MESMO volume entre menos exercícios. Resultado medido
// numa grade de 1.350 perfis: exercício com 5+ séries saltou de 497 para 1.272.
// B2 é explícito — "3-4 séries por exercício; nunca de 1-2, nunca de 5+".
console.log('\n14. Séries por exercício (teto de 4, B2)');
for (const { nome, plano } of planos) {
  const empilhados = [];
  for (const d of plano.dias) {
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio') continue;
      if (e.series > 4) empilhados.push(`${d.nome}: ${e.series}x ${e.nome}`);
    }
  }
  ok(`${nome}: nenhum exercício acima de 4 séries`, !empilhados.length, empilhados.join(' | '));
}

// ── 15. Grupo grande apagado da semana pelo relógio ───────────────────────
//
// O dia D do split com foco superior passou a abrir com peito/costas e o corte
// por tempo apara do fim: uma agenda de 30 min terminava sem NENHUMA série
// direta de ombro na semana. Pior, o aviso de excesso indireto — que rodava
// antes do corte — dizia "ombro (27, sendo 12 diretas)" num plano com zero.
//
// A garantia possível não é "nunca some": com 30 min por sessão não cabe tudo,
// e prometer o contrário seria mentir de novo. A garantia é que, quando some, o
// plano DIZ. É a mesma régua do excesso indireto.
console.log('\n15. Grupo grande que some da semana vem declarado');
for (const cen of [
  { nome: '4d/30min/foco peito/dor ombro', p: { ...base, dias: 4, diasDisponiveis: [1, 2, 4, 5], focos: ['peito'], experiencia: 'avancado', minutosPorDia: Array(7).fill(30), preferenciaEquipamento: 'maquina', dores: ['ombro'], objetivo: 'emagrecimento' } },
  { nome: '4d/30min/sem foco', p: { ...base, minutosPorDia: Array(7).fill(30) } },
  { nome: '5d/35min/foco superior', p: { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['superior'], minutosPorDia: Array(7).fill(35) } },
  { nome: '6d/30min/avancado', p: { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], experiencia: 'avancado', minutosPorDia: Array(7).fill(30) } },
]) {
  const plano = await montarPlano(cen.p, fonte);
  const direto = {};
  for (const d of plano.dias)
    for (const e of d.exercicios) if (e.grupo !== 'cardio') direto[e.grupo] = (direto[e.grupo] ?? 0) + e.series;

  const sumiram = GRANDES_T.filter((g) => !(direto[g] > 0));
  const declarado = plano.avisos.some((a) => a.includes('NENHUMA série direta na semana'));
  ok(
    `${cen.nome}: grupo grande que some vem declarado`,
    !sumiram.length || declarado,
    sumiram.length ? `sumiu: ${sumiram.join(', ')} — declarado: ${declarado}` : 'nenhum sumiu'
  );

  // E o aviso de excesso indireto não pode afirmar que sobra volume num grupo
  // que ficou em zero: ele roda depois do corte justamente para não mentir.
  const mente = plano.avisos.some(
    (a) => a.includes('passa do alvo por causa dos compostos') &&
      sumiram.some((g) => a.includes(COMO_SE_FALA_T[g] ?? g))
  );
  ok(`${cen.nome}: nenhum aviso diz que sobra o que está em zero`, !mente);
}

// ── 16. Os mesmos invariantes numa GRADE de perfis ────────────────────────
//
// Por que existe, se as seções 9, 10 e 14 já checam isso: elas checam em
// cenários escolhidos a dedo, e cenário escolhido a dedo é exatamente como um
// defeito real passa. O cross-review provou: as asserções novas de séries por
// exercício e de teto por sessão PASSARAM contra o código defeituoso, porque
// nenhum dos 9 cenários caía nos perfis que quebravam.
//
// Aqui a mesma régua roda numa grade de várias centenas de perfis, cobrindo
// dias × experiência × minutos × local × preferência × foco. Reporta contagem e
// o primeiro infrator de cada tipo — sem isso o próximo teto novo volta a ser
// verificado só onde já se sabe que funciona.
console.log('\n16. Invariantes de sessão numa grade de perfis');
{
  const DIAS = [1, 2, 3, 4, 5, 6];
  const EXP = ['iniciante', 'intermediario', 'avancado'];
  const MIN = [30, 45, 60, 90, 120];
  // ── As chaves REAIS. Três das cinco anteriores não existiam ─────────────
  //
  // `academia_rede`, `academia_simples` e `casa_halteres` nunca estiveram em
  // `LOCAIS` — os nomes são `smart_fit`, `academia_basica` e `casa_equipada`.
  // Como `equipamentosDe` caía calado em `LOCAIS[0]`, a grade que sustenta os
  // números de G1, G2 e G2.1 testava academia completa QUATRO vezes e
  // casa_simples uma: nunca halteres-sem-máquina, nunca academia-sem-cabo.
  const LOC = LOCAIS.map((l) => l.chave);
  const PREF = ['maquina', 'livre', 'indiferente'];
  const FOC = [[], ['peito'], ['costas'], ['ombro'], ['gluteo'], ['superior'], ['inferior']];
  const OBJ = ['hipertrofia', 'recomposicao', 'emagrecimento'];
  const DOR = [[], ['ombro'], ['joelho'], ['lombar']];

  const grade = [];
  let i = 0;
  for (const dias of DIAS)
    for (const experiencia of EXP)
      for (const minutos of MIN)
        for (const local of LOC)
          for (const preferenciaEquipamento of PREF) {
            grade.push({
              dias,
              diasDisponiveis: [1, 2, 3, 4, 5, 6].slice(0, dias),
              minutosPorDia: Array(7).fill(minutos),
              experiencia, local, preferenciaEquipamento,
              focos: FOC[i % FOC.length],
              objetivo: OBJ[i % OBJ.length],
              dores: DOR[i % DOR.length],
              barraFixaReps: [-1, 0, 3, 5, 8, 12][i % 6],
            });
            i++;
          }

  let empilhados = 0, acimaDoTeto = 0, padraoDemais = 0, sumiuSemAviso = 0;
  // G2 — os invariantes de PRESCRIÇÃO na mesma grade. Escritos aqui antes de
  // qualquer correção, porque foi rodando só nos cenários nomeados que as
  // asserções de G1 passaram contra o código defeituoso.
  let semPrincipal = 0, semRir = 0, pisoPequeno = 0, pressNoEmpurrar = 0;
  let faixaUnica = 0, cardioErrado = 0, descansoErrado = 0, aproxSemCarga = 0;
  let pesadoDemais = 0, padraoUnicoSemana = 0;
  // G2.1 — os dois invariantes novos de SEMANA.
  let tetoNaoDeclarado = 0, padraoUnicoGenerico = 0;
  const amostra = {
    empilhado: '', teto: '', padrao: '', sumiu: '',
    principal: '', rir: '', piso: '', press: '', faixa: '', cardio: '', descanso: '', aprox: '',
    pesado: '', semana: '', tetoUtil: '', semanaGen: '',
  };

  for (const p of grade) {
    const plano = await montarPlano(p, fonte);
    const rot = `${p.dias}d/${p.experiencia}/${p.minutosPorDia[1]}min/${p.local}/${p.preferenciaEquipamento}/foco=${p.focos.join('+') || 'nenhum'}`;
    const direto = {};

    for (const d of plano.dias) {
      const frac = fracionadoDoDia(d);
      const dir = diretasDoDia(d);
      const conta = {};
      for (const e of d.exercicios) {
        if (e.grupo === 'cardio') continue;
        direto[e.grupo] = (direto[e.grupo] ?? 0) + e.series;
        conta[chave(e)] = (conta[chave(e)] ?? 0) + 1;
        if (e.series > 4) {
          empilhados++;
          amostra.empilhado ||= `${rot} | ${d.nome} | ${e.series}x ${e.nome}`;
        }
        // (g) RIR em todo exercício de força — hoje ele não existe em lugar
        // nenhum do plano, e sem ele "8-12 repetições" não diz o esforço.
        // Série por TEMPO (prancha) fica de fora e isso é exceção declarada:
        // repetição em reserva é conta de repetições, e ali não há nenhuma.
        // Excêntrico puro fica de fora e isso é exceção DECLARADA: na nórdica
        // e na barra fixa negativa a fase concêntrica é assistida, então
        // "quantas repetições sobraram" não é pergunta respondível. Imprimir
        // RIR ali seria inventar prescrição para caber num campo.
        if (
          e.repsMax > 0 &&
          !EXCENTRICOS_T.has(e.nome) &&
          (!Number.isFinite(e.rirMin) || !Number.isFinite(e.rirMax))
        ) {
          semRir++;
          amostra.rir ||= `${rot} | ${d.nome} | ${e.nome}`;
        }
        // (d) o tier dos 180 s existe e é alcançável: reps ≤ 8 só sai do
        // principal de estabilização alta, e ele descansa 3 min.
        if (e.repsMax > 0 && e.repsMax <= 8 && e.descanso < 180) {
          descansoErrado++;
          amostra.descanso ||= `${rot} | ${d.nome} | ${e.nome} ${e.repsMin}-${e.repsMax} @ ${e.descanso}s`;
        }
        // (h) aproximação exige CARGA EXTERNA. Barra fixa, mergulho e flexão
        // não têm 40% — o peso é o corpo, e a tela prometia dois degraus que
        // ou não faziam nada ou inventavam quilos que não existem no aparelho.
        if ((e.aquecimento ?? 0) > 0 && e.tipoCarga !== 'peso_reps') {
          aproxSemCarga++;
          amostra.aprox ||= `${rot} | ${d.nome} | ${e.nome} (${e.tipoCarga})`;
        }
      }
      for (const [k, n] of Object.entries(conta))
        if (n > 2) { padraoDemais++; amostra.padrao ||= `${rot} | ${d.nome} | ${k}=${n}`; }

      for (const [g, v] of Object.entries(frac)) {
        if (v <= tetoSessao(g)) continue;
        const exs = d.exercicios.filter((e) => e.grupo === g).length;
        if (exs <= 1 && (dir[g] ?? 0) <= 2) continue; // exceção declarada
        acimaDoTeto++;
        amostra.teto ||= `${rot} | ${d.nome} | ${g}=${v}/${tetoSessao(g)} (diretas ${dir[g] ?? 0}, exs ${exs})`;
      }

      const forca = d.exercicios.filter((e) => e.grupo !== 'cardio');

      // (a) exatamente 1 ÂNCORA por grupo por sessão.
      //
      // UNIDADE: grupo × sessão. A asserção era sobre "principal" e estava
      // medindo a coisa errada: abrir o bloco é POSIÇÃO (alimenta o gráfico),
      // ser principal é PRESCRIÇÃO. Enquanto as duas moravam na mesma palavra,
      // 3.450 monoarticulares saíam rotulados "Principal" — e o texto do
      // executor mandava "fazer descansado, é a carga que comparamos" sobre um
      // tríceps testa de 2 × 10-15.
      for (const g of new Set(forca.map((e) => e.grupo))) {
        const n = forca.filter((e) => e.grupo === g && e.ancora).length;
        if (n !== 1) {
          semPrincipal++;
          amostra.principal ||= `${rot} | ${d.nome} | ${g}: ${n} âncoras`;
        }
      }
      // E o principal, quando existe, é multiarticular de carga ajustável.
      for (const e of forca) {
        if (e.papel !== 'principal') continue;
        if (!ehComposto(e.nome) || e.tipoCarga !== 'peso_reps') {
          semPrincipal++;
          amostra.principal ||= `${rot} | ${d.nome} | ${e.nome} papel=principal (${e.tipoCarga})`;
        }
      }

      // (c) grupo pequeno em dia que leva o nome dele: ≥2 exercícios, ao menos
      // 1 monoarticular. É o "peito e tríceps sem uma extensão de cotovelo".
      //
      // A garantia possível não é "sempre 2": em casa sem equipamento não
      // existe isolador de tríceps, num dia de 30 min não cabe, e com 6,5
      // fracionadas de indireto o segundo exercício estoura o teto da própria
      // sessão. É a mesma régua do grupo que some — quando não dá, o plano DIZ.
      const declaradoSemPiso = plano.avisos.some((a) => a.includes('ficou com UM exercício'));
      for (const g of PEQUENOS_T) {
        if (!diaLevaONome(d.nome, g)) continue;
        const doGrupo = forca.filter((e) => e.grupo === g);
        if (!doGrupo.length) continue;
        const cumpre = doGrupo.length >= 2 && doGrupo.some((e) => !ehComposto(e.nome));
        if (!cumpre && !declaradoSemPiso) {
          pisoPequeno++;
          amostra.piso ||= `${rot} | ${d.nome} | ${g}: ${doGrupo.map((e) => e.nome).join(', ')}`;
        }
      }

      // (b) dia de empurrar não leva desenvolvimento pesado.
      //
      // "Dia de empurrar" medido pelo que a sessão faz, não pelo nome dela: o
      // ombro já recebeu 5+ séries FRACIONADAS de graça dos empurrões do dia —
      // metade do piso semanal inteiro, num dia só, tudo em deltoide anterior.
      // Aí um desenvolvimento pesado é o mesmo músculo pelo mesmo padrão, feito
      // por último e cansado (A9). O limiar do código é mais apertado (60% do
      // alvo da sessão) e avaliado na seleção; aqui a régua é o resultado final.
      const indiretoOmbro = (fracionadoDoDia(d).ombro ?? 0) - (dir.ombro ?? 0);
      if (indiretoOmbro >= 5) {
        const press = forca.find(
          (e) => e.grupo === 'ombro' && ehPesado(e.nome) && padraoDe(e.nome, 'ombro') === 'desenvolvimento'
        );
        if (press) {
          pressNoEmpurrar++;
          amostra.press ||= `${rot} | ${d.nome} | ${press.nome} (indireto ${indiretoOmbro})`;
        }
      }

      // (e) mais de uma faixa de reps por sessão, e — a régua que morde — o
      // grupo com 2+ exercícios nunca com todos na MESMA faixa.
      //
      // Uma faixa só era o sintoma de A6: a prescrição saía da experiência e o
      // programa inteiro virava 8-12, do supino com barra ao mergulho. Um dia
      // de corpo todo com um exercício por grupo pode ter duas faixas e estar
      // certo (são todos principais) — por isso a segunda régua é por grupo.
      const faixas = new Set(forca.filter((e) => e.repsMax > 0).map((e) => `${e.repsMin}-${e.repsMax}`));
      let colapsado = null;
      for (const g of new Set(forca.map((e) => e.grupo))) {
        // Panturrilha e abdômen têm faixa de GRUPO (12-20), exceção declarada
        // em `papel.ts`: 5-8 de panturrilha não é treino pesado, é tendão.
        if (g === 'panturrilha' || g === 'abdomen') continue;
        const doGrupo = forca.filter((e) => e.grupo === g && e.repsMax > 0);
        if (doGrupo.length < 2) continue;
        // Grupo sem principal de verdade na sessão: o primeiro do bloco é
        // monoarticular e recebe prescrição de isolador (10-15), como o ombro
        // do dia de empurrar, que entra por duas abduções, ou o glúteo cujo
        // primeiro exercício é um hip thrust. Dois isoladores na mesma faixa
        // ali é a prescrição certa, não o colapso de A6 — que é o composto
        // pesado recebendo 8-12 igual ao acessório.
        if (doGrupo[0].repsMin >= 10) continue;
        // Grupo inteiro de carga FIXA não tem zona escolhível: dois exercícios
        // de peso corporal na mesma faixa é a prescrição certa, não o colapso
        // de A6 (que é o composto pesado recebendo 8-12 igual ao acessório).
        if (doGrupo.every((e) => e.tipoCarga !== 'peso_reps')) continue;
        if (new Set(doGrupo.map((e) => `${e.repsMin}-${e.repsMax}`)).size < 2)
          colapsado ||= `${g}: ${doGrupo.length}× ${doGrupo[0].repsMin}-${doGrupo[0].repsMax}`;
      }
      // A régua de sessão só vale onde variedade é estruturalmente possível:
      // num corpo todo com UM exercício por grupo, todos são principais e uma
      // faixa só é a prescrição certa, não o defeito A6.
      const algumGrupoRepete = forca.length > new Set(forca.map((e) => e.grupo)).size;
      // Sessão inteira de carga fixa (casa sem equipamento) tem uma faixa só
      // porque a zona não é escolhível em exercício nenhum dela — é a
      // prescrição certa, e cobrar variedade ali seria cobrar o que C1 proibiu.
      const algumaAjustavel = forca.some((e) => e.tipoCarga === 'peso_reps');
      if ((algumGrupoRepete && algumaAjustavel && faixas.size < 2) || colapsado) {
        faixaUnica++;
        amostra.faixa ||= `${rot} | ${d.nome} | ${colapsado ?? [...faixas].join(' / ')}`;
      }
    }

    // ── UNIDADE: SEMANA ────────────────────────────────────────────────
    //
    // Nenhum invariante media semana, e por isso passaram: 142 casos do mesmo
    // exercício pesado em 3+ dias e 38 semanas em que as costas recebem
    // trabalho direto SÓ no padrão `lombar` — zero puxada, zero remada, a
    // semana inteira, num grupo de alvo 14.
    const aparicoes = {};
    const padroesSemana = {};
    for (const d of plano.dias)
      for (const e of d.exercicios) {
        if (e.grupo === 'cardio') continue;
        if (ehPesado(e.nome)) aparicoes[e.nome] = (aparicoes[e.nome] ?? 0) + 1;
        (padroesSemana[e.grupo] ??= new Set()).add(padraoDe(e.nome, e.grupo));
      }
    for (const [nome, n] of Object.entries(aparicoes)) {
      if (n <= 2) continue;
      pesadoDemais++;
      amostra.pesado ||= `${rot} | ${nome} em ${n} dias`;
    }
    for (const g of GRANDES_T) {
      const ps = padroesSemana[g];
      // Só cobra de quem aparece 2+ vezes na semana: com uma aparição, um
      // padrão é o teto do que a divisão permite.
      const linhas = plano.dias.filter((d) => d.exercicios.some((e) => e.grupo === g)).length;
      if (!ps || linhas < 2) continue;
      // A régua COBRADA é a das costas: uma semana inteira sem nenhuma puxada
      // de verdade (só `lombar`, vindo de terra e hiperextensão) é uma semana
      // sem dorsal, e eram 38 semanas assim. Para os outros grupos grandes a
      // variedade semanal ainda não é garantia — está medida e registrada como
      // candidato no roadmap (168 perfis com um padrão só), porque fechar isso
      // exige a seleção conversar com a cobertura indireta em duas escalas ao
      // mesmo tempo, e não cabia nesta rodada.
      // (l) UNIDADE: grupo grande × SEMANA — a régua GENÉRICA, que G2 deixou
      // aberta em 168 de 1.350 perfis. Um grupo que aparece dois dias na semana
      // e faz o mesmo padrão nos dois é uma semana com um estímulo só, e o
      // segundo dia paga preço de sessão sem comprar amplitude nova.
      //
      // Só cobra onde um segundo padrão era ALCANÇÁVEL — e "alcançável" tem
      // três filtros, não um: o local precisa ter o exercício, a dor não pode
      // tê-lo proibido (`padroesDoLocal` cobre os dois) e a cobertura indireta
      // do próprio dia não pode tê-lo saturado. O terceiro é A9, que é regra
      // do projeto e não acidente: num dia de superior com dor no ombro, saem
      // `Elevação lateral` e `Remada alta` por dor e `desenvolvimento`/`frontal`
      // por saturação dos supinos — sobra `posterior`, e UM padrão ali é o teto
      // do que a regra permite. Cobrar dois seria cobrar que A9 fosse violada.
      if (ps.size < 2 && alcancaSegundoPadrao(g, p, plano)) {
        padraoUnicoGenerico++;
        amostra.semanaGen ||= `${rot} | ${g}: só ${[...ps].join(', ')}`;
      }
      if (g !== 'costas') continue;
      const faltaPuxar = !['vertical', 'horizontal', 'extensao_ombro'].some((x) => ps.has(x));
      if (!faltaPuxar) continue;
      // Só cobra onde o local oferece a alternativa.
      if (padroesDoLocal(g, p).size < 2) continue;
      padraoUnicoSemana++;
      amostra.semana ||= `${rot} | ${g}: ${[...ps].join(', ')}`;
    }

    // ── (k) UNIDADE: grupo × SEMANA — um teto só, e o que passa dele é dito ──
    //
    // O gerador deixa grupo em foco chegar a 28 fracionadas; `volume.ts` chama
    // de "alto" acima de 20 e a tela de programa carimba isso sobre o plano que
    // o próprio gerador acabou de montar. Dois tetos para a mesma pergunta, e
    // nenhum dos dois avisa o outro. A régua: passar do teto útil é legítimo
    // quando é ênfase — desde que o plano DECLARE, no mesmo tom do aviso de
    // frequência que já existe e funciona.
    // Enquanto a constante única não existe, a régua é o número que `volume.ts`
    // já usava — senão a asserção passaria VAZIA contra o código anterior
    // (`v > undefined` é sempre falso), que é exatamente o modo de falhar que o
    // cross-review de G1 pegou.
    const tetoUtil = Number.isFinite(PERIODIZACAO.TETO_UTIL) ? PERIODIZACAO.TETO_UTIL : 20;
    const semanal = {};
    for (const d of plano.dias)
      for (const e of d.exercicios) {
        if (e.grupo === 'cardio') continue;
        semanal[e.grupo] = (semanal[e.grupo] ?? 0) + e.series;
        for (const s of e.secundarios) semanal[s] = (semanal[s] ?? 0) + e.series * 0.5;
      }
    for (const [g, v] of Object.entries(semanal)) {
      if (!(v > tetoUtil)) continue;
      const nome = COMO_SE_FALA_T[g] ?? g;
      const declarado = plano.avisos.some((a) => a.includes('teto útil') && a.includes(nome));
      if (declarado) continue;
      tetoNaoDeclarado++;
      amostra.tetoUtil ||= `${rot} | ${g}=${Math.round(v * 10) / 10} > ${tetoUtil}`;
    }

    // (f) cardio na dose e na modalidade da constante do próprio app.
    const erroCardio = conferirCardio(plano, p, fonte);
    if (erroCardio) {
      cardioErrado++;
      amostra.cardio ||= `${rot} | ${erroCardio}`;
    }

    // Grupo ausente só conta se a DIVISÃO o previa e o relógio o apagou.
    //
    // A divisão de 1 dia não prevê posterior nem glúteo — isso é o teto do que
    // 1 dia permite, `divisaoDe` já explica, e exigir aviso ali seria cobrar
    // ruído. A pergunta certa é: com tempo folgado o grupo aparecia? Se sim e
    // agora não, foi o corte por tempo, e é isso que precisa estar escrito.
    const sumiram = GRANDES_T.filter((g) => !(direto[g] > 0));
    if (sumiram.length) {
      const folgado = await montarPlano({ ...p, minutosPorDia: Array(7).fill(150) }, fonte);
      const previstos = new Set(folgado.dias.flatMap((d) => d.exercicios.map((e) => e.grupo)));
      const apagados = sumiram.filter((g) => previstos.has(g));
      if (apagados.length && !plano.avisos.some((a) => a.includes('NENHUMA série direta na semana'))) {
        sumiuSemAviso++;
        amostra.sumiu ||= `${rot} | sem ${apagados.join(',')}`;
      }
    }
  }

  console.log(`   grade: ${grade.length} perfis`);
  ok('nenhum exercício acima de 4 séries', empilhados === 0, `${empilhados} — ${amostra.empilhado}`);
  ok('nenhuma sessão acima do teto fora da exceção', acimaDoTeto === 0, `${acimaDoTeto} — ${amostra.teto}`);
  ok('nenhuma sessão com 3+ exercícios do mesmo padrão', padraoDemais === 0, `${padraoDemais} — ${amostra.padrao}`);
  ok('grupo grande que some sempre vem declarado', sumiuSemAviso === 0, `${sumiuSemAviso} — ${amostra.sumiu}`);
  ok('(a) exatamente 1 principal por grupo por sessão', semPrincipal === 0, `${semPrincipal} — ${amostra.principal}`);
  ok('(b) nenhum desenvolvimento pesado em dia de empurrar', pressNoEmpurrar === 0, `${pressNoEmpurrar} — ${amostra.press}`);
  ok('(c) grupo pequeno em dia homônimo tem 2 exercícios e 1 mono', pisoPequeno === 0, `${pisoPequeno} — ${amostra.piso}`);
  ok('(d) reps ≤ 8 sempre com 180 s de descanso', descansoErrado === 0, `${descansoErrado} — ${amostra.descanso}`);
  ok('(e) sessão de 5+ exercícios com 3+ faixas de reps', faixaUnica === 0, `${faixaUnica} — ${amostra.faixa}`);
  ok('(f) cardio na dose e modalidade da constante', cardioErrado === 0, `${cardioErrado} — ${amostra.cardio}`);
  ok('(g) RIR em todo exercício de força', semRir === 0, `${semRir} — ${amostra.rir}`);
  ok('(h) aproximação só onde existe carga externa', aproxSemCarga === 0, `${aproxSemCarga} — ${amostra.aprox}`);
  ok('(i) mesmo pesado no máximo 2× na semana', pesadoDemais === 0, `${pesadoDemais} — ${amostra.pesado}`);
  ok('(j) semana de costas sempre com uma puxada', padraoUnicoSemana === 0, `${padraoUnicoSemana} — ${amostra.semana}`);
  // UNIDADE: grupo × semana — os dois de G2.1.
  ok('(k) volume acima do teto útil sempre declarado', tetoNaoDeclarado === 0, `${tetoNaoDeclarado} — ${amostra.tetoUtil}`);
  ok('(l) todo grupo grande com 2+ padrões na semana', padraoUnicoGenerico === 0, `${padraoUnicoGenerico} — ${amostra.semanaGen}`);
}

// ── 20. Um teto só para a mesma pergunta (M1) ──────────────────────────────
//
// UNIDADE: a CONSTANTE. Não é uma medida de plano — é a pergunta "quantos
// números diferentes o app usa para responder 'este grupo passou do volume
// útil?'". A resposta certa é um. `volume.ts` dizia 20 e o gerador dizia 20
// para grande e 14 para pequeno; a tela de programa carimbava "acima de 20"
// sobre o plano que o gerador tinha acabado de montar dentro das próprias
// regras dele.
console.log('\n20. O teto útil é UM número, consumido pelas duas pontas');
{
  const tetoUtil = PERIODIZACAO.TETO_UTIL;
  const tetoGerador = GERADOR.TETO_SEMANAL;
  const tetoPequenoSemanal = GERADOR.TETO_SEMANAL_PEQUENO;
  ok('o teto útil é exportado de uma fonte só', Number.isFinite(tetoUtil), String(tetoUtil));
  ok('gerador e auditoria de volume usam o MESMO número',
     Number.isFinite(tetoUtil) && tetoGerador === tetoUtil, `gerador ${tetoGerador} x volume ${tetoUtil}`);
  ok('o piso semanal também é um número só',
     Number.isFinite(PERIODIZACAO.ALVO_SERIES) && GERADOR.PISO_SEMANAL === PERIODIZACAO.ALVO_SERIES,
     `gerador ${GERADOR.PISO_SEMANAL} x volume ${PERIODIZACAO.ALVO_SERIES}`);
  // 14 era o teto do grupo pequeno, e ele fechava a porta para o segundo
  // exercício de tríceps que A7 exige: o total fracionado do tríceps chega a 14
  // quase todo por indireto dos supinos, e aí não cabia mais nada DIRETO.
  ok('teto do grupo pequeno subiu para 18-20 fracionadas',
     tetoPequenoSemanal >= 18 && tetoPequenoSemanal <= 20, String(tetoPequenoSemanal));
}

// ── 21. Cardio: dose completa em TODO objetivo que tem dose (M2) ───────────
//
// UNIDADE: a SEMANA. O aviso de cardio existia por DIA ("o cardio saiu da
// sessão") e nunca somava: com 45 min ele sumia da semana inteira e o plano
// nunca dizia quantas sessões da dose sobraram. E dois dos quatro objetivos
// tinham dose escrita na constante e recebiam ZERO.
console.log('\n21. Cardio na dose da constante, ou dose declarada na semana');
for (const objetivo of ['recomposicao', 'emagrecimento', 'hipertrofia', 'manutencao']) {
  const conf = CARDIO.porObjetivo[objetivo];
  for (const [rotulo, extra] of [
    ['4 dias 90 min', { dias: 4, diasDisponiveis: [1, 2, 4, 5], minutosPorDia: Array(7).fill(90) }],
    ['3 dias 60 min', { dias: 3, diasDisponiveis: [1, 3, 5], minutosPorDia: Array(7).fill(60) }],
    ['4 dias 45 min', { dias: 4, diasDisponiveis: [1, 2, 4, 5], minutosPorDia: Array(7).fill(45) }],
  ]) {
    const p = { ...base, ...extra, objetivo };
    const plano = await montarPlano(p, fonte);
    const erro = conferirCardio(plano, p, fonte);
    const sessoes = plano.dias.filter((d) => d.exercicios.some((e) => e.grupo === 'cardio')).length;
    ok(`${objetivo} ${rotulo}: ${conf.sessoes}× ${conf.minutos} min entregues ou declarados`,
       !erro, erro || `${sessoes} sessões`);
  }
}

// ── 22. O card da fase imprime DIREÇÃO, não número (M3-texto) ──────────────
//
// UNIDADE: a SEMANA, no texto. `RIR_POR_FASE.deload` diz 4-5 e `rirNaFase`
// devolve 2 no isolador: na semana de deload o cabeçalho da sessão dizia
// "RIR 4-5" e as linhas logo abaixo diziam "RIR 2". Duas fontes de RIR na mesma
// tela é como o app começa a discordar de si mesmo.
//
// A régua não é "o número está errado" — é que NÃO EXISTE número certo ali: o
// afrouxamento da fase é relativo ao alvo de cada exercício, e o alvo muda com
// o papel. Então o card diz a direção e o número fica na linha.
console.log('\n22. A fase afrouxa em direção; o número vem de rirNaFase');
{
  const AMOSTRA_EXS = [
    ['Supino reto com barra', 'peito', 'barra', 'peso_reps'],
    ['Elevação lateral com halteres', 'ombro', 'halter', 'peso_reps'],
    ['Tríceps na polia com corda', 'triceps', 'polia', 'peso_reps'],
  ];
  for (const fase of ['readaptacao', 'deload']) {
    const valores = new Set();
    for (const papel of PAPEIS)
      for (const [nome, grupo, equip, carga] of AMOSTRA_EXS)
        valores.add(JSON.stringify(rirNaFase(papel, nome, grupo, equip, fase, carga)));
    ok(`${fase}: rirNaFase devolve valores diferentes por papel`, valores.size > 1,
       `${valores.size} valores distintos`);

    // Com mais de um valor possível, qualquer número ABSOLUTO no texto da fase
    // está errado para alguém. Número RELATIVO ("afrouxe 1 a 2 sobre o alvo de
    // cada exercício") é o contrário disso: ele é certo para todo mundo, porque
    // fala do alvo da linha em vez de substituí-lo. A régua distingue os dois —
    // um regex que proibisse todo dígito proibiria também a correção pedida.
    const texto = RIR_POR_FASE[fase].texto;
    const RELATIVIZA = /(em relação ao alvo|sobre o alvo|a mais|a menos|do alvo de cada)/i;
    const numeroAbsoluto =
      /RIR\s*\d/i.test(texto) ||
      /\b(deixe|chegue a|pare a|fique a)\s+\d/i.test(texto) ||
      (/\d+\s*(a|à|-)?\s*\d*\s*repeti/i.test(texto) && !RELATIVIZA.test(texto));
    ok(`${fase}: o texto da fase não imprime RIR absoluto`, !numeroAbsoluto, texto);

    // E existe a direção, escrita, para o card imprimir no lugar.
    const ajuste = RIR_POR_FASE[fase].ajuste;
    ok(`${fase}: a fase declara o AJUSTE (quanto afrouxar)`,
       Array.isArray(ajuste) && ajuste.length === 2 && ajuste[1] >= ajuste[0] && ajuste[1] > 0,
       JSON.stringify(ajuste));
  }
  // Acúmulo e intensificação não afrouxam nada: `rirNaFase` devolve o RIR do
  // plano. Ajuste zero é resposta, não buraco.
  for (const fase of ['acumulo', 'intensificacao']) {
    const ajuste = RIR_POR_FASE[fase].ajuste;
    ok(`${fase}: ajuste declarado e neutro`, Array.isArray(ajuste) && ajuste[0] === 0 && ajuste[1] === 0,
       JSON.stringify(ajuste));
  }

  // E o CHIP do cabeçalho do executor, que é onde o "RIR 4-5" aparecia de
  // verdade — `RIR_POR_FASE.deload.min/max` viajando por `resolverFase`.
  // 2 meses parado → 3 semanas de readaptação, 4 de acúmulo, a 8ª é o deload.
  for (const [rotulo, semana] of [['readaptação', 1], ['deload', 8]]) {
    const f = resolverFase({
      retomouEm: '2026-06-01', mesesParado: 2, rotinaCriadaEmIso: null,
      hojeIso: '2026-08-03', semanaPlanoGravada: semana,
    });
    ok(`${rotulo}: a fase resolve`, !!f, f?.fase ?? 'null');
    ok(`${rotulo}: o chip do executor não imprime RIR absoluto`,
       !!f && !/RIR\s*\d/i.test(f.rirTexto), f?.rirTexto ?? '');
    ok(`${rotulo}: e o chip diz a direção`, !!f && f.rirTexto.length > 0, f?.rirTexto ?? '(vazio)');
  }
}

// ── 28. Papel gravado é CACHE, não verdade eterna ─────────────────────────
//
// UNIDADE: a LINHA dentro da COMPOSIÇÃO do dia. Não é uma medida de plano
// gerado — é a pergunta "o que acontece com o papel JÁ GRAVADO quando o dia
// muda depois". Desde que `preencherPapeis` passou a persistir papel em rotina
// antiga, o valor gravado virou o retrato da ordem no instante do backfill, e
// `papeisDaRotina` prefere sempre o gravado. Antes disso a rotina pré-v16 era
// imune: derivava a cada render e se autocorrigia.
//
// As três manifestações que o cross-review mediu, aqui como transformação pura.
console.log('\n28. Papel recalculado quando a composição do dia muda');
{
  const prescreverDia = PAPEL_NS.prescricaoDaRotina;
  ok('existe uma função que recalcula o dia inteiro', typeof prescreverDia === 'function',
     typeof prescreverDia);

  const linha = (id, nome, grupo, equipamento, tipoCarga = 'peso_reps') => ({
    id, nome, grupo, equipamento, tipoCarga,
  });
  // Um "peito e tríceps" de ordem manual, que é a população do backfill.
  const DIA = [
    linha(1, 'Supino reto com barra', 'peito', 'barra'),
    linha(2, 'Supino inclinado com halteres', 'peito', 'halter'),
    linha(3, 'Crucifixo com halteres', 'peito', 'halter'),
    linha(4, 'Tríceps na polia com corda', 'triceps', 'cabo'),
  ];
  const papelDe = (m, id) => m?.get(id)?.papel;

  const original = prescreverDia?.(DIA);
  ok('o 1º do grupo é principal e o 2º complementar',
     papelDe(original, 1) === 'principal' && papelDe(original, 2) === 'complementar',
     `${papelDe(original, 1)} / ${papelDe(original, 2)}`);

  // (1) REMOVER a âncora: quem sobra no topo do grupo vira o principal. Com o
  // papel congelado, o supino inclinado seguia "complementar" para sempre e o
  // grupo ficava sem principal nenhum.
  const semAncora = DIA.slice(1);
  const depoisDeRemover = prescreverDia?.(semAncora);
  ok('remover a âncora promove o próximo a principal',
     papelDe(depoisDeRemover, 2) === 'principal', String(papelDe(depoisDeRemover, 2)));

  // (2) REORDENAR: o card "Reordenar pela ciência" põe o supino com barra de
  // volta na posição 1. Papel, RIR e descanso têm que acompanhar — congelados,
  // ele voltava como complementar, RIR 1-2 e 150 s.
  const manual = [DIA[1], DIA[2], DIA[0], DIA[3]]; // ordem manual: barra em 3º
  const antesDeReordenar = prescreverDia?.(manual);
  const reordenado = prescreverDia?.(DIA);
  ok('na ordem manual o supino com barra NÃO é o principal',
     papelDe(antesDeReordenar, 1) !== 'principal', String(papelDe(antesDeReordenar, 1)));
  ok('reordenar devolve principal, RIR e descanso ao supino com barra',
     papelDe(reordenado, 1) === 'principal' &&
       reordenado?.get(1)?.descansoSeg === 180 &&
       JSON.stringify(reordenado?.get(1)?.rir) === '[2,3]',
     `${papelDe(reordenado, 1)} / ${reordenado?.get(1)?.descansoSeg}s / ${JSON.stringify(reordenado?.get(1)?.rir)}`);

  // (3) ACRESCENTAR: o finalizador é POSIÇÃO (último, mono, estabilização
  // baixa). Congelado, o antigo último continuava finalizador e o novo virava
  // outro — dois finalizadores GRAVADOS, contra a regra dura de `papeisDaSessao`.
  const comNovo = [...DIA, linha(5, 'Tríceps na polia com barra', 'triceps', 'cabo')];
  const depoisDeAcrescentar = prescreverDia?.(comNovo);
  const finalizadores = [...(depoisDeAcrescentar?.values() ?? [])].filter((x) => x.papel === 'finalizador');
  ok('nunca mais de um finalizador no dia', finalizadores.length <= 1, `${finalizadores.length}`);
  ok('e o finalizador é o ÚLTIMO da lista',
     papelDe(depoisDeAcrescentar, 5) === 'finalizador' && papelDe(depoisDeAcrescentar, 4) === 'isolador',
     `4=${papelDe(depoisDeAcrescentar, 4)} 5=${papelDe(depoisDeAcrescentar, 5)}`);

  // E cardio continua sem papel: a pergunta não existe ali.
  const comCardio = [...DIA, { id: 9, nome: 'Esteira', grupo: 'cardio', equipamento: 'maquina', tipoCarga: 'tempo' }];
  ok('cardio fica de fora do recálculo', prescreverDia?.(comCardio)?.get(9) === undefined,
     JSON.stringify(prescreverDia?.(comCardio)?.get(9) ?? null));
}

// ── 29. O BLOCO de 8 semanas — a unidade que ninguém media ────────────────
//
// UNIDADE: o BLOCO (8 semanas). Era a cobertura mais fina do repositório: todo
// invariante media série, exercício, sessão, dia ou semana, e NENHUM media o
// que acontece ENTRE semanas. Foi ali que M1 se escondeu — `semanaDoBloco`
// grampeava em 8 e `resolverFase` não, então a partir do dia 57 a tela do
// programa dizia "Semana 8 · Aliviar · 55%" para sempre enquanto o executor,
// corretamente, já não modulava nada. Duas telas, duas verdades, o mesmo dia.
console.log('\n29. O bloco de 8 semanas: uma definição de "venceu"');
{
  const INICIO = '2026-01-05'; // uma segunda-feira
  const maisDias = (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  let divergem = 0;
  let primeiro = '';
  for (let semana = 1; semana <= 14; semana++) {
    const hojeIso = maisDias(INICIO, (semana - 1) * 7 + 1);
    const s = semanaDoBloco(INICIO, hojeIso);
    const vencidoPelaTela = blocoVencido(s);
    const semModulacao =
      resolverFase({
        retomouEm: null, mesesParado: 0, rotinaCriadaEmIso: INICIO, hojeIso,
      }) === null;
    if (vencidoPelaTela !== semModulacao) {
      divergem++;
      primeiro ||= `semana ${semana}: tela=${vencidoPelaTela ? 'venceu' : 'ativo'} executor=${semModulacao ? 'venceu' : 'ativo'}`;
    }
  }
  ok('tela e executor concordam sobre o bloco ter vencido', divergem === 0, `${divergem} — ${primeiro}`);

  // E a semana deixa de mentir: no dia 90 ela é a 13ª, não a 8ª para sempre.
  const s13 = semanaDoBloco(INICIO, maisDias(INICIO, 85));
  ok('depois de vencido a semana continua contando', s13 > SEMANAS_DO_BLOCO, `semana ${s13}`);

  // Modulação NUNCA infla: as semanas de 110% do bloco orientam pelo texto, e
  // inflar o alvo de todo exercício em silêncio não é o combinado (B11).
  let inflou = 0;
  for (let semana = 1; semana <= SEMANAS_DO_BLOCO; semana++) {
    const hojeIso = maisDias(INICIO, (semana - 1) * 7 + 1);
    const f = resolverFase({ retomouEm: null, mesesParado: 0, rotinaCriadaEmIso: INICIO, hojeIso });
    if (!f) continue;
    for (const alvo of [2, 3, 4]) if (modularSeries(alvo, f) > alvo) inflou++;
    // Piso de 2: exercício de série única é presença, não estímulo.
    if (modularSeries(2, f) < 2) inflou++;
  }
  ok('nenhuma semana do bloco infla série nem cai abaixo de 2', inflou === 0, String(inflou));

  // Bloco vencido = sem modulação, e isso é o comportamento, não só o texto.
  ok('vencido não modula nada', modularSeries(4, null) === 4, String(modularSeries(4, null)));

  // E toda semana do bloco tem uma fase com direção declarada — é o que as
  // duas telas imprimem no lugar do número absoluto.
  let semDirecao = 0;
  for (let semana = 1; semana <= SEMANAS_DO_BLOCO; semana++) {
    const f = faseDaSemanaDoBloco(faseAtual(semana), semana);
    if (!Array.isArray(RIR_POR_FASE[f]?.ajuste)) semDirecao++;
  }
  ok('toda semana do bloco declara o ajuste de esforço', semDirecao === 0, String(semDirecao));
}

// ── 17. A prescrição não sai da EXPERIÊNCIA (A6) ───────────────────────────
//
// O achado que originou a fase: `repsDe` só produzia [5,8] quando
// `experiencia !== 'iniciante'`. Marcar "iniciante" apagava a zona pesada — e,
// em cascata, os 180 s — do programa INTEIRO. Leonardo é intermediário
// destreinado; uma resposta de questionário reescreveu a prescrição toda.
//
// A régua é comparativa de propósito: não é "iniciante devia receber 5-8", é
// "o mesmo exercício, no mesmo papel, não muda de faixa nem de descanso porque
// a pessoa marcou outra caixa". Volume por semana continua saindo da
// experiência — é lá que ela pertence.
console.log('\n17. Reps e descanso saem do PAPEL, não da experiência');
for (const cen of [
  { nome: '4 dias academia', p: { ...base, dias: 4, diasDisponiveis: [1, 2, 4, 5] } },
  { nome: '4 dias foco peito 90 min', p: { ...base, dias: 4, focos: ['peito'], minutosPorDia: Array(7).fill(90) } },
  { nome: '5 dias livre', p: { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], preferenciaEquipamento: 'livre' } },
]) {
  const prescricao = async (experiencia) => {
    const plano = await montarPlano({ ...cen.p, experiencia }, fonte);
    const m = {};
    for (const d of plano.dias)
      for (const e of d.exercicios)
        if (e.grupo !== 'cardio')
          // A chave inclui o PAPEL de propósito. Experiência muda volume
          // semanal, volume muda quantos exercícios o grupo tem, e com dois
          // exercícios a rosca concentrada deixa de ser o principal do bíceps
          // para virar isolador — outro papel, outra prescrição, e isso está
          // certo. O que A6 proíbe é o MESMO papel prescrever diferente porque
          // a pessoa marcou outra caixa no questionário.
          m[`${e.nome}|${e.papel}`] = `${e.repsMin}-${e.repsMax}/${e.descanso}s/RIR${e.rirMin}-${e.rirMax}`;
    return m;
  };
  const ini = await prescricao('iniciante');
  const inter = await prescricao('intermediario');
  const comuns = Object.keys(ini).filter((n) => inter[n]);
  const divergem = comuns.filter((n) => ini[n] !== inter[n]);
  ok(
    `${cen.nome}: mesma prescrição para iniciante e intermediário`,
    !divergem.length,
    divergem.slice(0, 3).map((n) => `${n}: ${ini[n]} x ${inter[n]}`).join(' | ')
  );

  // E o tier dos 180 s precisa ser ALCANÇÁVEL: com peso livre disponível, todo
  // plano tem ao menos um principal de estabilização alta na zona pesada.
  const plano = await montarPlano({ ...cen.p, experiencia: 'iniciante' }, fonte);
  const pesados = plano.dias.flatMap((d) => d.exercicios.filter((e) => e.descanso >= 180));
  ok(
    `${cen.nome}: iniciante também alcança os 180 s`,
    pesados.length > 0,
    pesados.length ? pesados.map((e) => e.nome).slice(0, 2).join(', ') : 'nenhum exercício a 180 s'
  );
}

// ── 18. Aquecimento no principal (F8) ─────────────────────────────────────
console.log('\n18. Séries de aproximação no principal (F8)');
let totalAproximacoes = 0;
for (const { nome, plano } of planos) {
  const erros = [];
  let comAproximacao = 0;
  for (const d of plano.dias) {
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio') continue;
      // `repsMin < 10` separa o principal de verdade (5-8 ou 6-10) do principal
      // monoarticular, que recebe prescrição de isolador (10-15) e não precisa
      // de aproximação — aquecer 8 kg de elevação lateral custa mais tempo do
      // que rende. `tipoCarga` separa o que TEM carga: não existe "40% da
      // carga" numa barra fixa, e prometer aproximação ali era 40% das
      // prescrições (162 de 402) apontando para um botão que não faz nada.
      const esperado =
        e.papel === 'principal' && e.repsMax > 0 && e.repsMin < 10 && e.tipoCarga === 'peso_reps'
          ? 2
          : 0;
      if ((e.aquecimento ?? 0) !== esperado)
        erros.push(`${d.nome}: ${e.nome} (${e.papel}) = ${e.aquecimento ?? 0}, esperado ${esperado}`);
      if ((e.aquecimento ?? 0) > 0) comAproximacao++;
    }
  }
  ok(
    `${nome}: 2 aproximações no principal e zero no resto`,
    !erros.length,
    erros.length ? erros.slice(0, 2).join(' | ') : `${comAproximacao} exercícios com aproximação`
  );
  totalAproximacoes += comAproximacao;
}

// A contagem global existe para a asserção acima não passar vazia: sem ela, um
// plano com ZERO aproximação (que era o de antes de F8) satisfaz "nenhum erro"
// sem fazer nada. Ela é GLOBAL e não por cenário porque zero é a resposta certa
// em casa sem equipamento — lá não existe exercício com carga externa, e exigir
// aproximação seria cobrar o que a nova regra acabou de proibir.
ok('a prescrição de aproximação existe de verdade', totalAproximacoes > 0,
   `${totalAproximacoes} exercícios com aproximação nos ${planos.length} cenários`);

// -- 19. O fluxo real da aproximacao (F8) ---------------------------------
//
// UNIDADE: a SERIE, dentro de uma sessao que e reaberta.
//
// Os dois defeitos que este teste existe para pegar nao aparecem em contagem
// de plano nenhuma: `serie_index` e a POSICAO da linha no array da tela, e a
// criacao de aproximacoes fazia prepend sem olhar o que ja estava gravado. Com
// a serie 1 no banco, o aquecimento nascia com `serie_index = 0` colidindo — e
// na reabertura so a primeira das duas voltava. O aquecimento sumia da tela e
// ficava em `set_logs` sem `salvaId`, sem como desmarcar nem corrigir: a regra
// 5 do AGENTS.md quebrada, num PWA que recarrega no meio do treino.
console.log('\n19. Fluxo da aproximacao: criar, gravar, reabrir');
{
  const alvo = planos
    .flatMap((x) => x.plano.dias.flatMap((d) => d.exercicios))
    .find((e) => e.aquecimento > 0);
  ok('existe exercicio com aproximacao prescrita', !!alvo, alvo?.nome ?? 'nenhum');

  const passos = aquecimento(60, alvo?.equipamento ?? 'barra', alvo?.tipoCarga ?? 'peso_reps', alvo?.repsMax ?? 10);
  ok('a carga vira degraus de verdade', passos.length >= 1,
     passos.map((x) => `${x.peso}kg x ${x.reps}`).join(' e '));
  ok('nenhum degrau alcanca a carga de trabalho', passos.every((x) => x.peso < 60),
     passos.map((x) => x.peso).join(', '));

  const zeradas = Array.from({ length: 4 }, () => ({ peso: '', reps: '', concluida: false }));
  const criado = inserirAproximacoes(zeradas, passos);
  ok('criar antes da 1a serie e permitido', !!criado.linhas, criado.recusa ?? '');

  const linhas = criado.linhas ?? [];
  const gravadas = linhas.map((l, i2) => ({
    id: 100 + i2,
    serie_index: i2,
    peso_kg: 40,
    reps: 8,
    tipo: l.aquecimento ? 'aquecimento' : 'normal',
  }));
  const indices = gravadas.map((g) => g.serie_index);
  ok('nenhum serie_index colide', new Set(indices).size === indices.length, indices.join(','));

  const reaberta = hidratarSeries(gravadas, 4);
  ok('a reabertura devolve TODAS as series', reaberta.length === linhas.length,
     `${reaberta.length} de ${linhas.length}`);
  ok('e cada uma com o id para desmarcar ou corrigir',
     reaberta.every((l) => l.salvaId), `${reaberta.filter((l) => !l.salvaId).length} sem id`);
  ok('o aquecimento volta marcado como aquecimento',
     reaberta.filter((l) => l.aquecimento).length === passos.length,
     `${reaberta.filter((l) => l.aquecimento).length} de ${passos.length}`);
  ok('e a numeracao valendo recomeca em 1',
     numeroValendo(reaberta, passos.length) === 1, String(numeroValendo(reaberta, passos.length)));

  const comUmaGravada = [
    { peso: '60', reps: '8', concluida: true, salvaId: 7 },
    ...zeradas.slice(1),
  ];
  const recusado = inserirAproximacoes(comUmaGravada, passos);
  ok('criar DEPOIS de gravar e recusado', !!recusado.recusa, recusado.recusa ?? 'permitiu');
  ok('e a recusa e uma frase, nao um silencio',
     (recusado.recusa ?? '').length > 20, recusado.recusa ?? '');
  ok('as linhas nao foram tocadas', !recusado.linhas);
}

// ═══════════════════════════════════════════════════════════════════════════
// Fase 4 — Serie em 1 toque (U1, U2, U5, U6, U7)
//
// As tres unidades novas desta fase sao TOQUE, ALVO e PAR COR/FUNDO. Nenhuma
// delas aparece contando exercicio ou serie, que e o que todo o resto do
// arquivo faz — por isso as secoes abaixo medem outra coisa.
//
// ── Por que import DINAMICO, e nao estatico ───────────────────────────────
//
// A secao 16 ja explica por que os simbolos novos entram por namespace: com
// import nomeado, rodar o arquivo contra o codigo anterior morre no link e o
// gate nao pode ser cumprido. Um MODULO novo tem o mesmo problema um nivel
// acima — `import * as X from './registro.ts'` tambem explode se o arquivo
// ainda nao existe. Com import dinamico dentro de try, ausente vale objeto
// vazio e a assercao FALHA, que e o que o gate pede.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';

const carregar = async (caminho) => {
  try {
    return await import(caminho);
  } catch {
    return {};
  }
};
const REGISTRO = await carregar('../src/features/treino/registro.ts');
const TOKENS = await carregar('../src/theme/tokens.ts');

const FONTE_SESSAO = readFileSync(new URL('../app/sessao/[id].tsx', import.meta.url), 'utf8');
const FONTE_PAD = readFileSync(new URL('../src/shared/ui/NumberPad.tsx', import.meta.url), 'utf8');

// ── 23. O gesto central: quantos TOQUES custa registrar uma serie ─────────
//
// UNIDADE: o TOQUE. Nao "ficou mais rapido": quantos vezes o dedo encosta na
// tela, do primeiro toque ate a serie estar no banco. Leonardo faz isso ~20
// vezes por treino, de pe, com a mao suada — e a auditoria mediu 4 toques e 2
// teclados para o caminho mais comum de todos ("fiz a mesma carga de sempre").
//
// O simulador abaixo NAO reimplementa a tela: ele chama as mesmas funcoes que
// `app/sessao/[id].tsx` chama. Se o componente parar de chamar, a secao 24
// pega (assercao de "fio ligado") e o navegador confirma a contagem.
console.log('\n23. Toques para registrar uma serie (U1)');
{
  const ANTERIOR = [
    { serie_index: 0, peso_kg: 80, reps: 8, registrado_em: 1000 },
    { serie_index: 1, peso_kg: 80, reps: 8, registrado_em: 1001 },
    { serie_index: 2, peso_kg: 80, reps: 8, registrado_em: 1002 },
  ];
  const CTX = { porTempo: false, readaptacao: null, pesoSugerido: null };

  // Fallbacks em vez de try/catch em volta do bloco: com try/catch, o modulo
  // ausente vira UMA falha e as outras dez assercoes nunca rodam — o gate
  // perderia justamente a granularidade que ele existe para ter.
  //
  // O fallback e a tela ANTIGA: nao pre-preenche nada (identidade) e nao sabe
  // dizer qual campo falta. Por isso toda contagem de toque abaixo so vale se
  // a heranca de fato aconteceu (`herdou`) — senao "1 toque" passaria com o
  // check marcando uma linha vazia, que e o defeito, nao a correcao.
  const temMotor = typeof REGISTRO.prePreencher === 'function';
  const prePreencher = REGISTRO.prePreencher ?? ((linhas) => linhas);
  const precisaTeclado = REGISTRO.precisaTeclado ?? (() => null);
  const campoDepoisDeConfirmar = REGISTRO.campoDepoisDeConfirmar ?? (() => null);

  const bancada = (linhas, ctx) => {
    const st = { linhas: linhas.map((l) => ({ ...l })), foco: null, buffer: '', toques: 0, teclados: 0 };
    return {
      st,
      check(i) {
        st.toques++;
        const falta = precisaTeclado(st.linhas[i], ctx.porTempo);
        if (falta) {
          st.foco = { i, campo: falta };
          st.buffer = st.linhas[i]?.[falta] ?? '';
          st.teclados++;
          return;
        }
        st.linhas[i] = { ...st.linhas[i], concluida: true, herdado: false };
      },
      campo(i, c) {
        st.toques++;
        st.foco = { i, campo: c };
        st.buffer = st.linhas[i]?.[c] ?? '';
        st.teclados++;
      },
      tecla(d) {
        st.toques++;
        st.buffer = st.buffer + d;
      },
      incremento(delta) {
        st.toques++;
        st.buffer = String((parseFloat(st.buffer.replace(',', '.')) || 0) + delta).replace('.', ',');
      },
      confirmar() {
        st.toques++;
        const { i, campo } = st.foco;
        st.linhas[i] = { ...st.linhas[i], [campo]: st.buffer, herdado: false };
        const prox = campoDepoisDeConfirmar(campo, st.linhas[i]);
        if (prox) {
          st.foco = { i, campo: prox };
          st.buffer = st.linhas[i]?.[prox] ?? '';
        } else st.foco = null;
      },
    };
  };

  {
    const vazias = Array.from({ length: 3 }, () => ({ peso: '', reps: '', concluida: false }));
    const prontas = prePreencher(vazias, ANTERIOR, CTX);

    ok(
      'a sessao nasce com a carga da ultima vez NO ESTADO, nao no placeholder',
      prontas.length === 3 && prontas.every((l) => l.peso === '80' && l.reps === '8'),
      prontas.map((l) => `${l.peso || '-'}x${l.reps || '-'}`).join(' ')
    );
    ok(
      'e herdado se distingue de digitado (senao a tela mente sobre o que vai gravar)',
      prontas.length === 3 && prontas.every((l) => l.herdado === true),
      `${prontas.filter((l) => l.herdado).length} de ${prontas.length}`
    );

    // Toda contagem daqui para baixo so conta se a linha carrega a carga:
    // marcar linha vazia tambem custaria 1 toque, e seria o bug.
    const herdou = prontas.length === 3 && prontas.every((l) => l.peso && l.reps && l.herdado);

    const a = bancada(prontas, CTX);
    a.check(0);
    ok('repetir a carga de sempre custa 1 TOQUE', herdou && a.st.toques === 1, `${a.st.toques} toque(s)`);
    ok('e zero teclado', herdou && a.st.teclados === 0, `${a.st.teclados} teclado(s)`);
    ok('e a serie fica pronta para gravar com a carga certa',
       herdou && a.st.linhas[0]?.concluida === true && a.st.linhas[0]?.peso === '80',
       `${a.st.linhas[0]?.peso}x${a.st.linhas[0]?.reps}`);

    const b = bancada(prontas, CTX);
    b.campo(0, 'peso');
    b.incremento(2.5);
    b.confirmar();
    b.check(0);
    ok('subir 2,5 kg e registrar custa 4 toques', herdou && b.st.toques === 4, `${b.st.toques} toque(s)`);
    ok('e o peso novo entrou', herdou && b.st.linhas[0]?.peso === '82,5', b.st.linhas[0]?.peso);
    ok(
      'confirmar o peso NAO pula para reps quando reps ja tem valor',
      herdou && b.st.linhas[0]?.reps === '8' && b.st.teclados === 1,
      `reps=${b.st.linhas[0]?.reps} teclados=${b.st.teclados}`
    );

    const semHistorico = prePreencher(vazias, [], CTX);
    ok(
      'sem historico nada e herdado — o toque no check abre o teclado, como sempre',
      temMotor &&
        semHistorico.length === 3 &&
        semHistorico.every((l) => !l.peso && !l.reps && !l.herdado) &&
        precisaTeclado(semHistorico[0], false) === 'peso',
      precisaTeclado(semHistorico[0], false) ?? 'nao pediu teclado'
    );

    const porTempo = prePreencher(vazias, ANTERIOR, { ...CTX, porTempo: true });
    ok(
      'exercicio por tempo nao herda carga (o campo peso ali guarda segundos)',
      temMotor && porTempo.length === 3 && porTempo.every((l) => !l.peso),
      porTempo.map((l) => l.peso || '-').join(' ')
    );

    const comSugestao = prePreencher(vazias, ANTERIOR, { ...CTX, pesoSugerido: 82.5 });
    ok(
      'a heranca respeita a progressao dupla: herda o peso do selo, nao o antigo',
      comSugestao.length === 3 && comSugestao.every((l) => l.peso === '82,5'),
      comSugestao[0]?.peso
    );

    const naVolta = prePreencher(vazias, ANTERIOR, {
      ...CTX,
      readaptacao: { cargaPct: 70, retomadaEmMs: 5000 },
    });
    ok(
      'e a readaptacao: herda a carga reduzida sobre a serie PRE-pausa',
      naVolta.length === 3 && naVolta.every((l) => l.peso === '56'),
      naVolta[0]?.peso
    );

    const jaGravada = [
      { peso: '75', reps: '9', concluida: true, salvaId: 4 },
      { peso: '', reps: '', concluida: false },
    ];
    const preservado = prePreencher(jaGravada, ANTERIOR, CTX);
    ok(
      'serie ja gravada nunca e sobrescrita pela heranca',
      temMotor && preservado[0]?.peso === '75' && preservado[0]?.reps === '9' && preservado[0]?.salvaId === 4,
      `${preservado[0]?.peso}x${preservado[0]?.reps}`
    );
  }
}

// ── 24. O alvo do gesto central (U2) ──────────────────────────────────────
//
// UNIDADE: o ALVO — largura x altura da area que o dedo acerta, em pt.
//
// Duas armadilhas aqui, e as duas ja foram pagas neste projeto:
//
// 1. Constante definida e ignorada. `HIT = 52` existe em `src/theme` desde
//    sempre e a tela mais tocada do app usa 34. Um teste que so conferisse a
//    constante passaria com o defeito inteiro na tela — por isso as assercoes
//    tambem leem `app/sessao/[id].tsx` e cobram que o fio esteja LIGADO.
// 2. hitSlop no web e enfeite. `react-native-web` so implementa `hitSlop` no
//    `Touchable` legado; o `Pressable` (que o `Press` do projeto embrulha)
//    joga a prop no lixo. Medido em node_modules: `hitSlop` aparece em
//    dist/exports/Touchable e em nenhum outro lugar. Como o app REAL do
//    Leonardo e o PWA, um alvo que so cresce por hitSlop nao cresceu.
console.log('\n24. Alvo de toque na linha de serie (U2)');
{
  const MINIMO = 44; // Apple HIG
  ok('o theme publica o minimo absoluto de alvo', TOKENS.HIT_MIN === MINIMO, String(TOKENS.HIT_MIN));
  ok('e o alvo confortavel do projeto continua 52', TOKENS.HIT === 52, String(TOKENS.HIT));

  const alvos = TOKENS.ALVO_TOQUE ?? {};
  const nomes = Object.keys(alvos);
  ok('a linha de serie declara seus alvos em um lugar so', nomes.length >= 4, nomes.join(', '));
  const pequenos = nomes.filter((n) => {
    const a = alvos[n];
    const l = typeof a === 'number' ? a : a?.largura;
    const h = typeof a === 'number' ? a : a?.altura;
    return !(l >= MINIMO && h >= MINIMO);
  });
  ok(
    'nenhum alvo declarado abaixo de 44x44',
    nomes.length >= 4 && pequenos.length === 0,
    nomes.length ? pequenos.join(', ') : 'nenhum alvo declarado'
  );
  ok(
    'o gesto de 20x por treino (concluir) fica no alvo confortavel',
    !!TOKENS.HIT &&
      (typeof alvos.check === 'number' ? alvos.check : alvos.check?.altura) === TOKENS.HIT,
    JSON.stringify(alvos.check ?? null)
  );

  ok(
    'a tela de sessao consome as constantes (fio ligado, nao so declarado)',
    /ALVO_TOQUE/.test(FONTE_SESSAO),
    `ALVO_TOQUE citado ${(FONTE_SESSAO.match(/ALVO_TOQUE/g) ?? []).length}x`
  );
  ok(
    'o check nao e mais um quadrado de 34',
    !/checkBox:\s*\{[\s\S]{0,60}width:\s*34/.test(FONTE_SESSAO),
    /checkBox:\s*\{[\s\S]{0,60}width:\s*34/.test(FONTE_SESSAO) ? 'continua 34 pt' : 'sai de ALVO_TOQUE.check'
  );
  // A PROP em JSX, nao a palavra: o comentario que explica por que hitSlop
  // nao serve e exatamente o que precisa sobreviver no arquivo — cobrar a
  // palavra apagaria a explicacao junto com o defeito.
  ok(
    'nenhum alvo depende de hitSlop (no PWA ele nao faz nada)',
    !/hitSlop\s*=\s*\{/.test(FONTE_SESSAO),
    /hitSlop\s*=\s*\{/.test(FONTE_SESSAO) ? 'ainda existe hitSlop ativo' : 'nenhum'
  );
}

// ── 25. A cor que decide a carga (U5) ─────────────────────────────────────
//
// UNIDADE: o PAR cor/fundo, medido sobre a cor COMPOSTA.
//
// A coluna "Anterior" e a informacao que a pessoa le agachada na frente do
// aparelho para decidir quanto poe na barra. Ela e pintada com `textFaint` em
// 12 px, e a linha muda de fundo tres vezes (normal, concluida, aquecimento) —
// as duas ultimas com alpha por cima. Medir o token contra o fundo do app e
// concluir que passa e o erro que este projeto ja cometeu: aprovado no olho
// duas vezes, 3,75:1 no pixel.
console.log('\n25. Contraste da coluna que decide a carga (U5)');
{
  const AA = 4.5; // texto pequeno
  const arquivoCores = existsSync(new URL('../src/theme/tokens.ts', import.meta.url))
    ? '../src/theme/tokens.ts'
    : '../src/theme/index.ts';
  const fonteCores = readFileSync(new URL(arquivoCores, import.meta.url), 'utf8');
  const cor = (nome) => {
    const m = fonteCores.match(new RegExp(`\\b${nome}:\\s*'([^']+)'`));
    return m?.[1] ?? null;
  };
  const canal = (c) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const ler = (v) => {
    if (v.startsWith('#'))
      return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    const p = v.match(/\(([^)]+)\)/)[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const compor = (frenteV, fundoV) => {
    const f = ler(frenteV);
    const b = ler(fundoV);
    const a = f[3];
    return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a)];
  };

  const surface = ler(cor('surface')).slice(0, 3);
  const fundos = {
    'linha normal': surface,
    'linha concluida': compor(cor('successSoft'), cor('surface')),
    'linha de aquecimento': compor(cor('warnSoft'), cor('surface')),
  };
  const alvo = cor('textDim');
  for (const [nome, fundo] of Object.entries(fundos)) {
    const c = contraste(ler(alvo).slice(0, 3), fundo);
    ok(`Anterior passa AA na ${nome}`, c >= AA, `${c.toFixed(2)}:1`);
  }
  // O numero que a auditoria achou, medido de novo aqui para o relatorio nao
  // depender de memoria: e ele que a mudanca precisa substituir.
  const antes = contraste(ler(cor('textFaint')).slice(0, 3), surface);
  ok(
    'a cor antiga da coluna REPROVA (e por isso ela nao pode continuar la)',
    antes < AA,
    `textFaint sobre surface = ${antes.toFixed(2)}:1`
  );
  ok(
    'e a tela parou de usar textFaint na coluna Anterior',
    !/cor=\{colors\.textFaint\}[^>]*>\s*\{anterior\?\.peso_kg/.test(FONTE_SESSAO),
    /cor=\{colors\.textFaint\}[^>]*>\s*\{anterior\?\.peso_kg/.test(FONTE_SESSAO)
      ? 'ainda sai em textFaint'
      : 'a coluna sai em textDim'
  );
}

// ── 26. Serie adicionada por engano sai (U7) ──────────────────────────────
//
// UNIDADE: a LINHA, e o estado dela DEPOIS de reabrir o app.
//
// A auditoria achou dois defeitos no mesmo lugar: a linha extra nao tem gesto
// de remocao (e trava o auto-avanco, porque `completoDe` exige todas
// concluidas), e ela some sozinha ao reabrir — "o mesmo treino tem dois
// estados dependendo de reabrir". Consertar so o primeiro deixaria o segundo
// de pe, entao a remocao e cobrada CONTRA o que `hidratarSeries` devolveria.
console.log('\n26. Remover serie adicionada por engano (U7)');
{
  const pisoDeLinhas = REGISTRO.pisoDeLinhas ?? (() => -1);
  const removerSerie = REGISTRO.removerSerie ?? (() => ({}));
  {
    const alvoDaSemana = 3;
    const base = [
      { peso: '80', reps: '8', concluida: true, salvaId: 1 },
      { peso: '80', reps: '8', concluida: true, salvaId: 2 },
      { peso: '80', reps: '8', concluida: true, salvaId: 3 },
      { peso: '', reps: '', concluida: false },
    ];
    const piso = pisoDeLinhas(base, alvoDaSemana);
    ok('o piso e o que a reabertura devolveria', piso === 3, String(piso));

    const r = removerSerie(base, 3, piso);
    ok('a linha extra vazia sai', !!r.linhas && r.linhas.length === 3, r.recusa ?? '');
    ok(
      'e o exercicio fecha (o auto-avanco destrava)',
      (r.linhas ?? []).length === 3 && r.linhas.every((l) => l.concluida),
      `${(r.linhas ?? []).filter((l) => !l.concluida).length} pendente(s)`
    );

    const reaberta = hidratarSeries(
      base.slice(0, 3).map((l, i) => ({
        id: l.salvaId,
        serie_index: i,
        peso_kg: 80,
        reps: 8,
        tipo: 'normal',
      })),
      alvoDaSemana
    );
    ok(
      'o estado depois de remover e o MESMO que reabrir o app devolve',
      !!r.linhas && reaberta.length === r.linhas.length,
      `tela ${(r.linhas ?? []).length} x reabertura ${reaberta.length}`
    );

    const gravada = removerSerie(base, 0, piso);
    ok('remover serie ja gravada e recusado', !!gravada.recusa, gravada.recusa ?? 'permitiu');
    ok(
      'e a recusa ensina o caminho certo (desmarcar apaga o set_log)',
      /desmarq/i.test(gravada.recusa ?? ''),
      gravada.recusa ?? ''
    );

    const meio = [
      { peso: '', reps: '', concluida: false },
      { peso: '80', reps: '8', concluida: true, salvaId: 9 },
      { peso: '', reps: '', concluida: false },
    ];
    const embaralha = removerSerie(meio, 0, 0);
    ok(
      'remover linha com serie GRAVADA depois e recusado (serie_index e posicao)',
      !!embaralha.recusa,
      embaralha.recusa ?? 'permitiu — o banco e a tela ficariam em indices diferentes'
    );

    // Linhas NAO gravadas de proposito: senao a recusa que responde e a de
    // "ja gravada" e a regra do piso nunca chega a ser exercitada.
    const tresVazias = Array.from({ length: 3 }, () => ({ peso: '', reps: '', concluida: false }));
    const abaixoDoPiso = removerSerie(tresVazias, 2, 3);
    ok(
      'remover abaixo do piso e recusado, com o motivo escrito',
      !!abaixoDoPiso.recusa && /voltaria/i.test(abaixoDoPiso.recusa),
      abaixoDoPiso.recusa ?? 'permitiu — e a linha voltaria na proxima abertura'
    );
  }
}

// ── 27. O que some quando o teclado abre (U6) e para onde foi o aquecimento ──
//
// UNIDADE: a TELA — o que continua visivel durante o gesto.
//
// O cronometro de descanso e a segunda funcao mais usada da sessao e ele
// desaparecia exatamente no momento em que orienta: com o NumberPad aberto,
// preparando o peso da proxima serie. E o toggle de aquecimento de G2 morava
// no numero da serie, disputando largura com o alvo de 52 pt do check — a
// segunda assercao cobra que ele nao tenha simplesmente sumido junto.
console.log('\n27. Descanso visivel no teclado (U6) e o aquecimento de G2');
{
  ok(
    'o NumberPad aceita o descanso',
    /descanso\?:/.test(FONTE_PAD),
    /descanso\?:/.test(FONTE_PAD) ? 'prop declarada' : 'NumberPad nao tem prop de descanso'
  );
  ok(
    'e a sessao passa o descanso para ele',
    /<NumberPad[\s\S]{0,1200}descanso=\{/.test(FONTE_SESSAO),
    /<NumberPad[\s\S]{0,1200}descanso=\{/.test(FONTE_SESSAO) ? 'passa' : 'monta o pad sem descanso'
  );
  ok(
    'o aquecimento continua alcancavel por gesto na linha',
    /onLongPress/.test(FONTE_SESSAO) && /marcarAquecimento/.test(FONTE_SESSAO),
    /onLongPress/.test(FONTE_SESSAO) && /marcarAquecimento/.test(FONTE_SESSAO)
      ? 'toque longo -> menu da linha'
      : 'o gesto de aquecimento sumiu da linha de serie'
  );
}

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
