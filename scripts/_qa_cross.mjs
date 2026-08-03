/** Harness adversarial do cross-review de G1. NAO faz parte do projeto. */
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano, REGIOES } from '../src/features/treino/gerador.ts';
import { padraoDe, ehComposto, ehPesado } from '../src/features/treino/classificacao.ts';

const TODOS = EXERCICIOS.map(([nome, grupo, sec, equip, carga], i) => ({
  id: i + 1, nome, grupo_primario: grupo, grupos_secundarios: sec,
  equipamento: equip, tipo_carga: carga,
}));
const fonte = {
  catalogo: TODOS.filter((e) => e.grupo_primario !== 'cardio'),
  cardio: TODOS.filter((e) => e.grupo_primario === 'cardio'),
};
const base = {
  dias: 4, diasDisponiveis: [1, 2, 4, 5], experiencia: 'intermediario',
  objetivo: 'hipertrofia', local: 'academia',
  minutosPorDia: [60, 60, 60, 60, 60, 60, 60],
  preferenciaEquipamento: 'indiferente', focos: [], dores: [], barraFixaReps: -1,
};

const GRANDES = ['peito', 'costas', 'ombro', 'quadriceps', 'posterior', 'gluteo'];
const PEQUENOS = ['biceps', 'triceps', 'panturrilha', 'abdomen', 'trapezio', 'antebraco'];
const tetoSessao = (g) => (PEQUENOS.includes(g) ? 10 : 12);
const tetoPadrao = (g) => (PEQUENOS.includes(g) ? 6 : 8);

const perfis = [];
for (const dias of [3, 4, 5, 6]) {
  for (const focos of [[], ['peito'], ['costas'], ['ombro'], ['gluteo'], ['quadriceps'],
                       ['posterior'], ['superior'], ['inferior'], ['peito', 'costas'], ['biceps'], ['panturrilha']]) {
    for (const exp of ['iniciante', 'intermediario', 'avancado']) {
      for (const min of [30, 45, 60, 90, 120]) {
        for (const local of ['academia', 'casa_simples']) {
          for (const pref of ['indiferente', 'maquina', 'livre']) {
            for (const dores of [[], ['ombro'], ['joelho'], ['lombar'], ['ombro', 'joelho', 'lombar']]) {
              perfis.push({
                ...base, dias,
                diasDisponiveis: [1, 2, 3, 4, 5, 6, 0].slice(0, dias),
                experiencia: exp, local, preferenciaEquipamento: pref, focos, dores,
                minutosPorDia: [min, min, min, min, min, min, min],
                barraFixaReps: exp === 'iniciante' ? 3 : -1,
                objetivo: min === 30 ? 'emagrecimento' : 'hipertrofia',
              });
            }
          }
        }
      }
    }
  }
}
const passo = Math.max(1, Math.floor(perfis.length / 1200));
const amostra = perfis.filter((_, i) => i % passo === 0);

const achados = {};
const reg = (chave, detalhe) => { (achados[chave] ??= []).push(detalhe); };
const rotulo = (p) =>
  `${p.dias}d/${p.experiencia}/${p.minutosPorDia[0]}min/${p.local}/${p.preferenciaEquipamento}/foco=${p.focos.join('+') || '-'}/dor=${p.dores.join('+') || '-'}`;

let maxMs = 0, pior = '';
for (const p of amostra) {
  const t0 = Date.now();
  let plano;
  try { plano = await montarPlano(p, fonte); }
  catch (e) { reg('EXCECAO', `${rotulo(p)} :: ${e.message}`); continue; }
  const ms = Date.now() - t0;
  if (ms > maxMs) { maxMs = ms; pior = rotulo(p); }

  const semanaGrupos = new Set();
  for (const d of plano.dias) {
    const forca = d.exercicios.filter((e) => e.grupo !== 'cardio');
    for (const e of forca) semanaGrupos.add(e.grupo);
    if (!forca.length) reg('DIA_SEM_FORCA', `${rotulo(p)} :: ${d.nome}`);

    for (const e of forca) {
      if (!Number.isInteger(e.series) || e.series < 1)
        reg('SERIES_INVALIDA', `${rotulo(p)} :: ${d.nome} :: ${e.nome} = ${e.series}`);
      else if (e.series < 3)
        reg('SERIES_MENOR_QUE_3', `${rotulo(p)} :: ${d.nome} :: ${e.nome} = ${e.series}`);
      if (e.series > 4) reg('SERIES_MAIOR_QUE_4', `${rotulo(p)} :: ${d.nome} :: ${e.nome} = ${e.series}`);
    }

    const nomes = forca.map((e) => e.nome);
    if (new Set(nomes).size !== nomes.length) reg('NOME_DUPLICADO_NO_DIA', `${rotulo(p)} :: ${d.nome}`);

    const idxCardio = d.exercicios.findIndex((e) => e.grupo === 'cardio');
    if (idxCardio >= 0 && idxCardio !== d.exercicios.length - 1)
      reg('CARDIO_FORA_DO_FIM', `${rotulo(p)} :: ${d.nome}`);

    // teto por sessao SEM a isencao de "grupo sem trabalho direto"
    const frac = {}, diretas = {};
    for (const e of forca) {
      frac[e.grupo] = (frac[e.grupo] ?? 0) + e.series;
      diretas[e.grupo] = (diretas[e.grupo] ?? 0) + e.series;
      for (const s of e.secundarios) if (s && s !== 'cardio') frac[s] = (frac[s] ?? 0) + e.series * 0.5;
    }
    for (const [g, v] of Object.entries(frac)) {
      if (v > tetoSessao(g)) reg(diretas[g] ? 'TETO_SESSAO_COM_DIRETAS' : 'TETO_SESSAO_SO_INDIRETO',
        `${rotulo(p)} :: ${d.nome} :: ${g}=${v} (teto ${tetoSessao(g)})`);
    }
    // teto por padrao
    const cP = {}, sP = {};
    for (const e of forca) {
      const k = `${e.grupo}:${padraoDe(e.nome, e.grupo)}`;
      cP[k] = (cP[k] ?? 0) + 1; sP[k] = (sP[k] ?? 0) + e.series;
    }
    for (const [k, n] of Object.entries(cP)) if (n > 2) reg('PADRAO_MAIS_DE_2_EX', `${rotulo(p)} :: ${d.nome} :: ${k}=${n}`);
    for (const [k, s] of Object.entries(sP))
      if (s > tetoPadrao(k.split(':')[0])) reg('PADRAO_SERIES_DEMAIS', `${rotulo(p)} :: ${d.nome} :: ${k}=${s}`);
  }

  for (const g of GRANDES) if (!semanaGrupos.has(g) && p.local === 'academia')
    reg('GRUPO_GRANDE_AUSENTE_DA_SEMANA', `${rotulo(p)} :: ${g}`);

  // ancora estavel na semana
  const primeiro = {};
  for (const d of plano.dias) {
    const vistos = new Set();
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio' || vistos.has(e.grupo)) continue;
      vistos.add(e.grupo);
      if (primeiro[e.grupo] && primeiro[e.grupo] !== e.nome)
        reg('ANCORA_TROCOU_NA_SEMANA', `${rotulo(p)} :: ${e.grupo}: ${primeiro[e.grupo]} vs ${e.nome} (${d.nome})`);
      primeiro[e.grupo] ??= e.nome;
    }
  }

  const txt = (plano.avisos ?? []).join(' || ');
  if (/1× por semana nesta divisão/.test(txt)) reg('AVISO_FREQUENCIA_DISPARADO', `${rotulo(p)} :: ${txt.match(/[^.]*1× por semana nesta divisão/)?.[0] ?? ''}`);
  // foco pedido mas divisao caiu pro split equilibrado -> aviso de perna mente
  if (p.focos.length && /perna|inferior/i.test(txt) && /1× por semana/.test(txt) === false) {
    // nada
  }
}

console.log(`amostrados: ${amostra.length} | pior tempo: ${maxMs} ms (${pior})`);
for (const [k, v] of Object.entries(achados).sort()) {
  console.log(`\n### ${k} — ${v.length}`);
  for (const l of v.slice(0, 200)) console.log('   ' + l);
  if (v.length > 5) console.log(`   ... +${v.length - 5}`);
}
if (!Object.keys(achados).length) console.log('\nnenhum achado');
