/** Zoom 2. NAO faz parte do projeto. */
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano } from '../src/features/treino/gerador.ts';
import { padraoDe, perfilDeResistencia } from '../src/features/treino/classificacao.ts';

const TODOS = EXERCICIOS.map(([nome, grupo, sec, equip, carga], i) => ({
  id: i + 1, nome, grupo_primario: grupo, grupos_secundarios: sec, equipamento: equip, tipo_carga: carga,
}));
const fonte = {
  catalogo: TODOS.filter((e) => e.grupo_primario !== 'cardio'),
  cardio: TODOS.filter((e) => e.grupo_primario === 'cardio'),
};
const base = {
  dias: 4, diasDisponiveis: [1, 2, 4, 5], experiencia: 'intermediario', objetivo: 'hipertrofia',
  local: 'academia', minutosPorDia: [60,60,60,60,60,60,60],
  preferenciaEquipamento: 'indiferente', focos: [], dores: [], barraFixaReps: -1,
};

console.log('==== A. padraoDe x perfilDeResistencia sobre o catalogo ====');
const porGrupo = {};
for (const e of fonte.catalogo) {
  const k = padraoDe(e.nome, e.grupo_primario);
  ((porGrupo[e.grupo_primario] ??= {})[k] ??= []).push(`${e.nome}[${perfilDeResistencia(e.nome, e.equipamento)}]`);
}
for (const [g, pads] of Object.entries(porGrupo)) {
  const n = Object.values(pads).reduce((s, a) => s + a.length, 0);
  // capacidade maxima de exercicios distintos que cabeNoPadrao deixa entrar
  let cap = 0;
  for (const lista of Object.values(pads)) {
    const perfis = new Set(lista.map((x) => x.match(/\[(.*)\]$/)[1]));
    cap += Math.min(2, perfis.size);
  }
  console.log(`${g}: ${n} exercícios, ${Object.keys(pads).length} padrões, teto efetivo de exercícios/sessão = ${cap}`);
  for (const [k, l] of Object.entries(pads)) if (l.length > 3) console.log(`      ${k} (${l.length}): ${l.slice(0,6).join(', ')}${l.length>6?' ...':''}`);
}

console.log('\n==== B. equipamento vazio/nulo no catalogo ====');
const semEq = fonte.catalogo.filter((e) => !e.equipamento);
console.log(`${semEq.length}: ` + semEq.slice(0, 12).map((e) => `${e.nome}→${perfilDeResistencia(e.nome, e.equipamento)}`).join(', '));

console.log('\n==== C. escolherSplit rejeita a tabela de foco alguma vez? ====');
// Compara a divisao devolvida com foco contra a sem foco: se forem iguais em
// 4/5/6 dias, o foco foi descartado (fallback para SPLITS) sem avisar.
for (const dias of [4, 5, 6]) {
  for (const focos of [['superior'], ['inferior'], ['peito'], ['gluteo']]) {
    const disp = [1,2,3,4,5,6].slice(0, dias);
    const a = await montarPlano({ ...base, dias, diasDisponiveis: disp, focos }, fonte);
    const b = await montarPlano({ ...base, dias, diasDisponiveis: disp, focos: [] }, fonte);
    const nomes = (pl) => pl.dias.map((d) => d.nome).sort().join(' | ');
    const igual = nomes(a) === nomes(b);
    console.log(`${dias}d foco=${focos}: ${igual ? '*** FALLBACK (foco descartado em silêncio)' : 'usou tabela de foco'}`);
  }
}

console.log('\n==== D. determinismo (mesma entrada 3x) ====');
const p = { ...base, dias: 4, focos: ['peito'], experiencia: 'iniciante', preferenciaEquipamento: 'maquina',
  minutosPorDia: [90,90,90,90,90,90,90], objetivo: 'recomposicao', barraFixaReps: 5, diasDisponiveis: [1,2,4,5] };
const assinatura = (pl) => pl.dias.map((d) => d.nome + ':' + d.exercicios.map((e) => `${e.nome}x${e.series}`).join(',')).join(' || ');
const a1 = assinatura(await montarPlano(p, fonte));
const a2 = assinatura(await montarPlano(p, fonte));
const a3 = assinatura(await montarPlano(p, fonte));
console.log(a1 === a2 && a2 === a3 ? 'determinístico' : '*** NÃO DETERMINÍSTICO');

console.log('\n==== E. aviso de sobra x duração real ====');
for (const min of [45, 60, 90, 120]) {
  const pl = await montarPlano({ ...base, minutosPorDia: [min,min,min,min,min,min,min] }, fonte);
  const dur = pl.dias.map((d) => d.minutos);
  const temSobra = pl.avisos.some((a) => /Sobram cerca de|cabe em/.test(a));
  const sobraMsg = pl.avisos.find((a) => /Sobram cerca de|cabe em/.test(a)) ?? '';
  console.log(`${min} min/dia → durações ${dur.join('/')} | aviso: ${temSobra ? sobraMsg.slice(0, 110) + '…' : 'nenhum'}`);
}

console.log('\n==== F. dor: exercício contraindicado sobrevive? ====');
for (const dor of ['ombro', 'joelho', 'lombar']) {
  const pl = await montarPlano({ ...base, dores: [dor], dias: 4 }, fonte);
  const todos = pl.dias.flatMap((d) => d.exercicios.map((e) => e.nome));
  console.log(`dor=${dor}: ${todos.length} exercícios | avisos=${pl.avisos.length}`);
}
