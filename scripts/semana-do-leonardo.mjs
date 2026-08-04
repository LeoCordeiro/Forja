/**
 * A semana do Leonardo, impressa inteira.
 *
 * ── Por que este script existe ───────────────────────────────────────────
 *
 * `npm run testar:gerador` PASSOU com o terra ancorando as costas, um
 * agachamento sem peso a RIR 0-2 para 88 kg em academia completa e uma remada
 * alta de barra a 5-8 como principal de ombro. A suíte mede invariante; ela
 * não lê prescrição. Seis fases de auditoria não acharam o que o dono do app
 * achou em dez segundos olhando a tela.
 *
 * Então o gate desta fase é diferente: rodar o gerador com o perfil REAL e
 * imprimir os quatro dias, exercício por exercício, para conferência humana.
 *
 *   npm run semana
 *   npm run semana -- --json     (só os dados, para diff antes/depois)
 */
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano } from '../src/features/treino/gerador.ts';
import { padraoDe } from '../src/features/treino/classificacao.ts';
import { picoDeTensao } from '../src/features/treino/papel.ts';

const TODOS = EXERCICIOS.map(([nome, grupo, sec, equip, carga], i) => ({
  id: i + 1,
  nome,
  grupo_primario: grupo,
  grupos_secundarios: sec,
  equipamento: equip,
  tipo_carga: carga,
}));
export const fonte = {
  catalogo: TODOS.filter((e) => e.grupo_primario !== 'cardio'),
  cardio: TODOS.filter((e) => e.grupo_primario === 'cardio'),
};

/**
 * O perfil real: recomposição, retorno de ~2 meses, 88 kg, ~27% de gordura,
 * academia completa, PREFERÊNCIA MÁQUINA, DOR NO JOELHO, menos de 2 barras
 * fixas, 4 dias, 90 min.
 */
export const LEONARDO = {
  dias: 4,
  diasDisponiveis: [1, 2, 4, 5],
  experiencia: 'intermediario',
  objetivo: 'recomposicao',
  local: 'academia',
  minutosPorDia: Array(7).fill(90),
  preferenciaEquipamento: 'maquina',
  dores: ['joelho'],
  focos: [],
  barraFixaReps: 1,
};

const PAD = (s, n) => String(s).padEnd(n);

export function resumo(plano) {
  const linhas = [];
  for (const d of plano.dias) {
    for (const e of d.exercicios) {
      linhas.push({
        dia: d.nome,
        nome: e.nome,
        grupo: e.grupo,
        padrao: padraoDe(e.nome, e.grupo),
        pico: e.grupo === 'cardio' ? '-' : picoDeTensao(e.nome, e.grupo),
        papel: e.papel,
        ancora: e.ancora,
        series: e.series,
        reps: `${e.repsMin}-${e.repsMax}`,
        rir: e.rirMin === null ? '-' : `${e.rirMin}-${e.rirMax}`,
        descanso: e.descanso,
        equip: e.equipamento,
        sec: e.secundarios.join(','),
        aquecimento: e.aquecimento,
      });
    }
  }
  return linhas;
}

export function imprimir(plano) {
  console.log(`\n${'═'.repeat(100)}`);
  console.log(`DIVISÃO: ${plano.divisao}`);
  console.log(`${'═'.repeat(100)}`);
  for (const d of plano.dias) {
    console.log(
      `\n── ${d.nome}  ·  ${d.minutos} min` +
        (d.minutosCardio ? ` + ${d.minutosCardio} min de cardio` : '') +
        ` ${'─'.repeat(Math.max(0, 60 - d.nome.length))}`
    );
    console.log(
      `   ${PAD('EXERCÍCIO', 34)}${PAD('GRUPO', 12)}${PAD('PADRÃO', 18)}${PAD('PAPEL', 13)}` +
        `${PAD('SÉR', 5)}${PAD('REPS', 8)}${PAD('RIR', 6)}${PAD('DESC', 6)}${PAD('EQUIP', 9)}SECUNDÁRIOS`
    );
    for (const e of d.exercicios) {
      const marca = e.ancora ? '▶' : ' ';
      const aq = e.aquecimento ? ` (+${e.aquecimento} aprox.)` : '';
      console.log(
        ` ${marca} ${PAD(e.nome, 34)}${PAD(e.grupo, 12)}${PAD(padraoDe(e.nome, e.grupo), 18)}` +
          `${PAD(e.papel ?? '-', 13)}${PAD(e.series, 5)}` +
          `${PAD(e.porTempo ? `${e.repsMin}-${e.repsMax}s` : `${e.repsMin}-${e.repsMax}`, 8)}` +
          `${PAD(e.rirMin === null ? '-' : `${e.rirMin}-${e.rirMax}`, 6)}${PAD(e.descanso, 6)}` +
          `${PAD(e.equipamento ?? '-', 9)}${e.secundarios.join(',')}${aq}`
      );
    }
  }

  console.log(`\n${'─'.repeat(100)}\nVOLUME SEMANAL (fracionado)`);
  const v = Object.entries(plano.volumeSemanal).sort((a, b) => b[1] - a[1]);
  console.log('  ' + v.map(([g, n]) => `${g} ${n}`).join('  ·  '));

  const diretas = {};
  for (const d of plano.dias)
    for (const e of d.exercicios)
      if (e.grupo !== 'cardio') diretas[e.grupo] = (diretas[e.grupo] ?? 0) + e.series;
  console.log('DIRETAS');
  console.log(
    '  ' +
      Object.entries(diretas)
        .sort((a, b) => b[1] - a[1])
        .map(([g, n]) => `${g} ${n}`)
        .join('  ·  ')
  );

  if (plano.avisos.length) {
    console.log(`\n${'─'.repeat(100)}\nAVISOS`);
    for (const a of plano.avisos) console.log(`  • ${a}`);
  }
  console.log('');
}

if (process.argv[1] && process.argv[1].includes('semana-do-leonardo')) {
  const plano = await montarPlano(LEONARDO, fonte);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ divisao: plano.divisao, linhas: resumo(plano), volume: plano.volumeSemanal, avisos: plano.avisos }, null, 1));
  } else {
    imprimir(plano);
  }
}
