/**
 * Roda o gerador com perfis reais e imprime o treino inteiro.
 *
 * Existe porque "o treino está bom?" não se responde olhando uma tela: precisa
 * ver os cinco dias, o tempo de cada um contra o tempo disponível, e o volume
 * semanal por grupo. Os perfis são o do Leonardo e o da Deise, que é onde os
 * problemas apareceram de verdade.
 *
 *   npm run cenarios
 */
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano } from '../src/features/treino/gerador.ts';
import { estimarDuracao, emMinutos } from '../src/features/treino/duracao.ts';

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

const NOVENTA = [90, 90, 90, 90, 90, 90, 90];

const PERFIS = [
  {
    quem: 'LEONARDO — 28 anos, 5 meses de treino, parado há 2. Recomposição, foco superiores.',
    p: {
      dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], experiencia: 'intermediario',
      objetivo: 'recomposicao', local: 'academia', minutosPorDia: NOVENTA,
      preferenciaEquipamento: 'indiferente', focos: ['superior'], dores: [],
    },
  },
  {
    quem: 'DEISE — 28 anos, 5 meses de treino, parada há 3. Recomposição, foco glúteo/pernas/costas.',
    p: {
      dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], experiencia: 'intermediario',
      objetivo: 'recomposicao', local: 'academia', minutosPorDia: NOVENTA,
      preferenciaEquipamento: 'indiferente', focos: ['gluteo', 'quadriceps', 'posterior', 'costas'], dores: [],
    },
  },
];

const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const paraEstimativa = (d) =>
  d.exercicios.map((e, i) => ({
    id: i, nome: e.nome, grupo_primario: e.grupo, series_alvo: e.series,
    reps_min: e.repsMin, reps_max: e.repsMax, descanso_seg: e.descanso,
    tipo_carga: e.grupo === 'cardio' ? 'tempo' : 'peso_reps',
  }));

for (const { quem, p } of PERFIS) {
  console.log('\n' + '='.repeat(78));
  console.log(quem);
  console.log(`Disponível: ${p.minutosPorDia[1]} min por dia`);
  console.log('='.repeat(78));

  const plano = await montarPlano(p, fonte);
  const volume = {};
  let somaOciosa = 0;

  for (const d of plano.dias) {
    const est = estimarDuracao(paraEstimativa(d));
    const disp = p.minutosPorDia[d.diaSemana ?? 1];
    const min = emMinutos(est.totalSeg);
    const sobra = disp - min;
    somaOciosa += Math.max(0, sobra);
    const temCardio = d.exercicios.some((e) => e.grupo === 'cardio');

    console.log(
      `\n${DIA[d.diaSemana ?? 0].toUpperCase()}  ${d.nome}` +
        `   ${min} min de ${disp}` +
        (sobra > 10 ? `   ⚠ SOBRAM ${sobra} min` : sobra < 0 ? `   ⚠ ESTOURA ${-sobra} min` : '   ok') +
        (temCardio ? '  (+ cardio à parte)' : '')
    );
    for (const e of d.exercicios) {
      volume[e.grupo] = (volume[e.grupo] ?? 0) + e.series;
      for (const s of e.secundarios) volume[s] = (volume[s] ?? 0) + e.series * 0.5;
      const faixa = e.repsMin ? `${e.repsMin}-${e.repsMax}` : `${e.repsMax || ''}`;
      console.log(
        `     ${String(e.series).padStart(2)}x${faixa.padEnd(6)} ${e.nome.padEnd(34)}` +
          `desc ${e.descanso}s   [${e.grupo}]`
      );
    }
  }

  console.log(`\n  TEMPO OCIOSO NA SEMANA: ${somaOciosa} min`);
  console.log('  VOLUME SEMANAL (direto + 0,5 × indireto):');
  for (const [g, v] of Object.entries(volume).sort((a, b) => b[1] - a[1]))
    if (g !== 'cardio') console.log(`     ${g.padEnd(13)} ${v}`);

  if (plano.avisos.length) {
    console.log('\n  AVISOS:');
    for (const a of plano.avisos) console.log(`     • ${a}`);
  }
}
console.log();
