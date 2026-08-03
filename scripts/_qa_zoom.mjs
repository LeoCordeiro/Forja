/** Zoom nos casos concretos. NAO faz parte do projeto. */
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano } from '../src/features/treino/gerador.ts';
import { padraoDe } from '../src/features/treino/classificacao.ts';

const TODOS = EXERCICIOS.map(([nome, grupo, sec, equip, carga], i) => ({
  id: i + 1, nome, grupo_primario: grupo, grupos_secundarios: sec, equipamento: equip, tipo_carga: carga,
}));
const fonte = {
  catalogo: TODOS.filter((e) => e.grupo_primario !== 'cardio'),
  cardio: TODOS.filter((e) => e.grupo_primario === 'cardio'),
};
const base = {
  dias: 4, diasDisponiveis: [1, 2, 4, 5], experiencia: 'intermediario', objetivo: 'hipertrofia',
  local: 'academia', minutosPorDia: [60, 60, 60, 60, 60, 60, 60],
  preferenciaEquipamento: 'indiferente', focos: [], dores: [], barraFixaReps: -1,
};
const PEQ = ['biceps', 'triceps', 'panturrilha', 'abdomen', 'trapezio', 'antebraco'];
const frac = (d) => {
  const c = {};
  for (const e of d.exercicios) {
    if (e.grupo === 'cardio') continue;
    c[e.grupo] = (c[e.grupo] ?? 0) + e.series;
    for (const s of e.secundarios) if (s && s !== 'cardio') c[s] = (c[s] ?? 0) + e.series * 0.5;
  }
  return c;
};
const mostra = (titulo, d) => {
  console.log(`\n--- ${titulo} :: ${d.nome} (${d.minutos} min)`);
  for (const e of d.exercicios)
    console.log(`      ${e.series}x${e.repsMin}-${e.repsMax}  ${e.nome}  [${e.grupo}:${padraoDe(e.nome, e.grupo)}] sec=${e.secundarios.join('/')||'-'}`);
  console.log('      fracionado: ' + Object.entries(frac(d)).map(([g, v]) => `${g}=${v}${v > (PEQ.includes(g) ? 10 : 12) ? ' <<< ACIMA DO TETO' : ''}`).join(', '));
};

console.log('==================== 1. TETO POR SESSÃO ESTOURADO (4 casos) ====================');
const casos = [
  { n: 'foco ombro, 3d, 120min', p: { ...base, dias: 3, diasDisponiveis: [1, 2, 3], minutosPorDia: [120,120,120,120,120,120,120], focos: ['ombro'] } },
  { n: 'foco inferior, 4d, 120min, livre, dor joelho', p: { ...base, dias: 4, experiencia: 'avancado', minutosPorDia: [120,120,120,120,120,120,120], preferenciaEquipamento: 'livre', focos: ['inferior'], dores: ['joelho'] } },
  { n: 'foco superior, 6d, 120min, casa', p: { ...base, dias: 6, diasDisponiveis: [1,2,3,4,5,6], local: 'casa_simples', minutosPorDia: [120,120,120,120,120,120,120], focos: ['superior'], dores: ['lombar'] } },
];
for (const c of casos) {
  const pl = await montarPlano(c.p, fonte);
  for (const d of pl.dias) {
    const f = frac(d);
    const est = Object.entries(f).filter(([g, v]) => v > (PEQ.includes(g) ? 10 : 12));
    if (est.length) mostra(c.n, d);
  }
}

console.log('\n\n==================== 2. SÉRIES 5+ NO MESMO EXERCÍCIO ====================');
const grid = [];
for (const dias of [3, 4, 5, 6])
  for (const exp of ['iniciante', 'intermediario', 'avancado'])
    for (const min of [45, 60, 90, 120])
      for (const local of ['academia', 'casa_simples'])
        for (const focos of [[], ['peito'], ['inferior'], ['superior'], ['gluteo']])
          grid.push({ ...base, dias, diasDisponiveis: [1,2,3,4,5,6].slice(0, dias), experiencia: exp,
            minutosPorDia: [min,min,min,min,min,min,min], local, focos });

let piorSerie = 0, piorInfo = '', total5 = 0, planosCom5 = 0;
const porExercicio = {};
for (const p of grid) {
  const pl = await montarPlano(p, fonte);
  let tem = false;
  for (const d of pl.dias) for (const e of d.exercicios) {
    if (e.grupo === 'cardio') continue;
    if (e.series >= 5) {
      total5++; tem = true;
      porExercicio[e.nome] = (porExercicio[e.nome] ?? 0) + 1;
      if (e.series > piorSerie) { piorSerie = e.series; piorInfo = `${e.series}x ${e.nome} — ${p.dias}d/${p.experiencia}/${p.minutosPorDia[0]}min/${p.local}/foco=${p.focos.join('+')||'-'} — ${d.nome}`; }
    }
  }
  if (tem) planosCom5++;
}
console.log(`planos com exercício de 5+ séries: ${planosCom5} de ${grid.length}`);
console.log(`ocorrências: ${total5} | pior: ${piorInfo}`);
console.log('top exercícios: ' + Object.entries(porExercicio).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,c])=>`${n}(${c})`).join(', '));

console.log('\n\n==================== 3. EXEMPLO CONCRETO DE 5+ ====================');
const ex = await montarPlano({ ...base, dias: 4, experiencia: 'iniciante', local: 'casa_simples',
  minutosPorDia: [90,90,90,90,90,90,90], focos: [] }, fonte);
for (const d of ex.dias) if (d.exercicios.some((e) => e.grupo !== 'cardio' && e.series >= 5)) mostra('iniciante 4d casa 90min', d);
