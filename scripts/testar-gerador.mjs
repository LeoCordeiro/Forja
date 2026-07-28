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
const semFoco = contarSeries(await montarPlano({ ...base, focos: [] }, fonte));
const comGluteo = contarSeries(await montarPlano({ ...base, focos: ['gluteo'] }, fonte));
ok('glúteo sobe quando é o foco', comGluteo.gluteo > semFoco.gluteo,
   `${semFoco.gluteo} → ${comGluteo.gluteo}`);
ok('peito cede quando não é o foco', comGluteo.peito <= semFoco.peito,
   `${semFoco.peito} → ${comGluteo.peito}`);

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
    plano.avisos.some((a) => a.includes('séries por semana'))
  );
  ok(`${cenario.nome}: excesso indireto vem explicado`, explicados,
     estourados.length ? `total alto em: ${estourados.join(', ')}` : 'nenhum grupo estourou');
}

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

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
