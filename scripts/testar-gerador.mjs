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
import {
  FORCA_RELATIVA,
  padraoDe,
  ehComposto,
  ehPesado,
  substitutosDe,
  SUBSTITUICOES,
} from '../src/features/treino/classificacao.ts';
// Nutrição: os módulos PUROS (sem `@/db/client`) que a grade de dia de dieta
// consome. `perfil/api.ts` não entra aqui de propósito — ele importa o banco.
import { metaCalorica, tdee, tmb } from '../src/features/perfil/calculos.ts';
import { DEFICIT_RECOMPOSICAO, deficitMaximoSeguro, gorduraPorImc } from '../src/features/perfil/recomposicao.ts';
// `macrosRecomposicao` só existe no código ANTERIOR — ela virou a rota única de
// `meta.ts`. Namespace pelo motivo de sempre: com import nomeado, rodar este
// arquivo contra `ee156d5` OU contra a árvore atual quebraria num dos dois
// lados no LINK, e o gate exige que ele rode nos dois e compare asserções.
import * as RECOMP from '../src/features/perfil/recomposicao.ts';
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

// ── Módulos da Fase 5, carregados AQUI EM CIMA de propósito ────────────────
//
// A seção 16 (grade de 1.350 perfis) precisa da regra de dor para saber quais
// padrões o gerador podia escolher — e ela roda antes das seções novas. Um
// `const` declarado lá embaixo estaria em zona morta temporal na hora que a
// seção 16 rodasse. Import DINÂMICO pelo motivo de sempre: contra o código
// anterior, módulo ausente vale objeto vazio e a asserção FALHA, em vez de o
// processo morrer no link antes da primeira asserção.
const carregarModulo = async (caminho) => {
  try {
    return await import(caminho);
  } catch {
    return {};
  }
};
const CONTRA = await carregarModulo('../src/features/treino/contraindicacao.ts');
const TROCA = await carregarModulo('../src/features/treino/substituicao.ts');
const META = await carregarModulo('../src/features/perfil/meta.ts');

/** O catálogo na forma que a regra de dor recebe (a mesma que o gerador passa). */
const CATALOGO_DOR = TODOS.filter((e) => e.grupo_primario !== 'cardio').map((e) => ({
  nome: e.nome,
  grupo_primario: e.grupo_primario,
  equipamento: e.equipamento,
  tipo_carga: e.tipo_carga,
}));
const acharEx = (nome) => CATALOGO_DOR.find((e) => e.nome === nome);

/**
 * "Este exercício está bloqueado para esta dor?" — pela regra VIVA.
 *
 * O fallback é a regra de hoje (lista nominal em `REGIOES_DOR.evitar`), e ele
 * existe por um motivo só: permitir rodar este mesmo arquivo contra `ee156d5` e
 * falhar por ASSERÇÃO. No caminho vivo ele nunca é usado — e é ele, e não uma
 * cópia da regra, que `padroesDoLocal` consulta: régua duplicada é como as duas
 * contas de volume passaram meses discordando.
 */
const bloqueado = (ex, regiao) => {
  if (typeof CONTRA.bloqueadoPorDor === 'function') return !!CONTRA.bloqueadoPorDor(ex, [regiao]);
  return (REGIOES_DOR.find((x) => x.chave === regiao)?.evitar ?? []).includes(ex.nome);
};

// ── Helpers de G3, declarados AQUI EM CIMA de propósito ───────────────────
//
// A seção 39 (B8 nível 2) mede na GRADE de 1.350 perfis, não em cenários
// nomeados — a lição do cross-review de G1, em que as asserções novas passaram
// contra o código defeituoso porque rodavam só nos 9 cenários escolhidos a dedo.
// A grade roda na seção 16, muito acima, então o acumulador e os helpers dele
// precisam existir antes: um `const` declarado lá embaixo estaria em zona morta
// temporal na hora em que a seção 16 rodasse.

/** Catálogo de força na forma que os módulos de G3 recebem. */
const CAT_FORCA = TODOS.filter((e) => e.grupo_primario !== 'cardio');

/** Equipamentos que o local de fato tem — chave estrita, sem o fallback mudo. */
const equipDoLocal = (chave) => new Set(LOCAIS.find((l) => l.chave === chave)?.equipamentos ?? []);

/** Perfil de resistência pelo EQUIPAMENTO do catálogo, que é a fonte do projeto. */
const perfilResDe = (nome) => {
  const cat = CAT_FORCA.find((e) => e.nome === nome);
  return cat?.equipamento === 'livre' ? 'corporal' : (cat?.equipamento ?? 'corporal');
};
const cargaDoCatalogo = (nome) =>
  CAT_FORCA.find((e) => e.nome === nome)?.tipo_carga ?? 'peso_reps';

/**
 * O que o gerador REALMENTE podia escolher naquele perfil.
 *
 * Local + `semEstes` + **dor**. A dor é a parte que faltava na primeira escrita
 * desta régua, e ela sozinha explicava os 8 pares que apareceram "repetindo sem
 * motivo" na grade: todos com dor no ombro, todos com a suposta alternativa
 * (`Afundo com barra`, `Tríceps testa`, `Crucifixo inverso na máquina`) fora do
 * catálogo daquele perfil. É exatamente o defeito que G2.1 achou na régua de
 * variedade semanal — 168 que na verdade eram 114 porque a régua não descontava
 * o que a dor proíbe.
 */
const catalogoDoPerfil = (p, grupo) => {
  const equip = equipDoLocal(p.local);
  const fora = foraDoLocal(p.local);
  return CAT_FORCA.filter(
    (e) =>
      e.grupo_primario === grupo &&
      !fora.has(e.nome) &&
      (!e.equipamento || equip.has(e.equipamento)) &&
      !(p.dores ?? []).some((r) => bloqueado(acharEx(e.nome) ?? e, r))
  );
};

/** Acumulador do invariante de B8 nível 2, preenchido dentro da grade (seção 16). */
const B8 = { pares: 0, comAlternativa: 0, iguais: 0, mesmoPerfil: 0, amostraIguais: '', amostraPerfil: '' };

/**
 * Acumulador do nível 0 na grade — e ele mede a EXCEÇÃO, não o zero.
 *
 * "Dois principais no mesmo bloco" cai de 297 para 272 na grade de blocos, e
 * cobrar zero seria cobrar que o gerador violasse duas regras suas: a variedade
 * de padrão por semana (invariante (l), de G2.1) e o teto de 2 aparições do
 * mesmo composto pesado (invariante (i), de G1). Prometer zero aqui produziria
 * um invariante inatingível — que foi exatamente o defeito M3 de G2.1, o que
 * escondia 112 falhas reais atrás de uma asserção que não podia falhar.
 *
 * Então a régua cobra o que o código de fato entrega: TODA instabilidade de
 * âncora dentro do bloco é explicada por uma das duas exceções declaradas.
 * Instabilidade sem explicação é defeito.
 */
const B8_0 = { grupos: 0, instaveis: 0, naoDeclarados: 0, porMotivo: {}, amostra: '' };

function medirNivel0(plano, rot) {
  const porGrupo = {};
  for (const d of plano.dias)
    for (const e of d.exercicios) if (e.papel === 'principal') (porGrupo[e.grupo] ??= []).push({ d, e });

  const avisoDeAncora = (plano.avisos ?? []).find((a) => /exerc[íi]cio de refer[êe]ncia/.test(a)) ?? '';

  for (const [g, ls] of Object.entries(porGrupo)) {
    if (ls.length < 2) continue;
    B8_0.grupos++;
    if (new Set(ls.map((x) => x.e.nome)).size === 1) continue;
    B8_0.instaveis++;

    // A GARANTIA é a declaração, não o zero. Enumerar no teste cada recusa
    // interna do gerador (teto por padrão, teto fracionado, ordem por fadiga)
    // seria reimplementar `trocaCabeNaSessao` aqui — régua duplicada, que é
    // como as duas contas de volume deste projeto passaram meses discordando.
    // O que o usuário precisa é saber que existem DUAS curvas; é isso que se
    // cobra.
    const nomes = [...new Set(ls.map((x) => x.e.nome))];
    const declarado =
      avisoDeAncora.includes(COMO_SE_FALA_T[g] ?? g) && nomes.every((n) => avisoDeAncora.includes(n));
    if (!declarado) {
      B8_0.naoDeclarados++;
      B8_0.amostra ||= `${rot} | ${g}: ${nomes.join(' / ')} | aviso: ${avisoDeAncora.slice(0, 80) || '(nenhum)'}`;
    }

    // Os motivos continuam medidos — não como asserção, como NÚMERO no relatório.
    const primeiro = ls[0].e.nome;
    const alvo = ls.find((x) => x.e.nome !== primeiro);
    const conta = (k) => (B8_0.porMotivo[k] = (B8_0.porMotivo[k] ?? 0) + 1);
    let n = 0;
    for (const d of plano.dias)
      for (const e of d.exercicios) if ((e === alvo.e ? primeiro : e.nome) === primeiro) n++;
    if (alvo.d.exercicios.some((e) => e.nome === primeiro)) conta('jaEstaNoDia');
    else if (ehPesado(primeiro) && n > 2) conta('pesado3x');
    else {
      const se = new Set();
      const hoje = new Set();
      for (const d of plano.dias)
        for (const e of d.exercicios) {
          if (e.grupo !== g) continue;
          hoje.add(padraoDe(e.nome, g));
          se.add(padraoDe(e === alvo.e ? primeiro : e.nome, g));
        }
      if (!PEQUENOS_T.includes(g) && se.size < Math.min(2, hoje.size)) conta('colapsaPadrao');
      else conta('regraDaSessao');
    }
  }
}

/** Mede o rodízio entre sessões de um plano — chamado de dentro da grade. */
function medirNivel2(plano, p, rot) {
  const linhas = {};
  for (const d of plano.dias)
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio') continue;
      (linhas[e.grupo] ??= []).push({ dia: d.nome, e });
    }
  for (const [g, ls] of Object.entries(linhas)) {
    const nomesDeDia = [...new Set(ls.map((x) => x.dia))];
    if (nomesDeDia.length < 2) continue;
    const doDia = (n) => ls.filter((x) => x.dia === n).map((x) => x.e);
    const noPerfil = catalogoDoPerfil(p, g);
    for (let k = 1; k < nomesDeDia.length; k++) {
      const a = doDia(nomesDeDia[0]).filter((e) => !e.ancora);
      const b = doDia(nomesDeDia[k]).filter((e) => !e.ancora);
      if (!a.length || !b.length) continue;
      B8.pares++;

      // Alternativa REAL: mesmo padrão, perfil de resistência diferente, mesmo
      // tipo de carga (trocar goblet por agachamento sem peso não é variedade),
      // e ainda não em uso na semana.
      const emUso = new Set(ls.map((x) => x.e.nome));
      const temAlternativa = a.some((e) => {
        const pad = padraoDe(e.nome, g);
        return noPerfil.some(
          (c) =>
            c.nome !== e.nome &&
            !emUso.has(c.nome) &&
            padraoDe(c.nome, g) === pad &&
            perfilResDe(c.nome) !== perfilResDe(e.nome) &&
            cargaDoCatalogo(c.nome) === cargaDoCatalogo(e.nome)
        );
      });
      if (!temAlternativa) continue;
      B8.comAlternativa++;

      const nomesA = a.map((e) => e.nome).sort().join('|');
      const nomesB = b.map((e) => e.nome).sort().join('|');
      if (nomesA === nomesB) {
        B8.iguais++;
        B8.amostraIguais ||= `${rot} | ${g} | ${nomesDeDia[0]} e ${nomesDeDia[k]}: ${nomesA}`;
      }
      const pa = new Set(a.map((e) => `${padraoDe(e.nome, g)}:${perfilResDe(e.nome)}`));
      const pb = new Set(b.map((e) => `${padraoDe(e.nome, g)}:${perfilResDe(e.nome)}`));
      if (pa.size === pb.size && [...pa].every((x) => pb.has(x))) {
        B8.mesmoPerfil++;
        B8.amostraPerfil ||= `${rot} | ${g} | ${nomesDeDia[0]}→${nomesDeDia[k]}: ${[...pa].join(', ')}`;
      }
    }
  }
}

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
  //
  // A régua é a FUNÇÃO da produção (`bloqueado`, no topo), não uma cópia da
  // lista: quando a contraindicação passou a sair de padrão + atributo, uma
  // cópia aqui continuaria concordando com a versão antiga e o invariante (l)
  // mediria o gerador contra uma regra que não existe mais.
  const proibidos = (nome) => {
    const e = CATALOGO_DOR.find((x) => x.nome === nome);
    return !!e && (p.dores ?? []).some((d) => bloqueado(e, d));
  };
  // E o que o LOCAL não tem apesar de a etiqueta de equipamento liberar
  // (`semEstes`): a Smart Fit tem cabo e máquina, mas não tem glute ham raise
  // nem flexão nórdica. Sem isto a asserção contaria padrão que o gerador está
  // proibido de escolher — o mesmo erro de unidade, um andar abaixo.
  const semLocal = foraDoLocal(p.local);
  const out = new Set();
  for (const e of fonte.catalogo) {
    if (e.grupo_primario !== grupo) continue;
    if (e.equipamento && !equip.has(e.equipamento)) continue;
    if (proibidos(e.nome) || semLocal.has(e.nome)) continue;
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
    const rot = `${p.dias}d/${p.experiencia}/${p.minutosPorDia[1]}min/${p.local}/${p.preferenciaEquipamento}/foco=${p.focos.join('+') || 'nenhum'}/dor=${(p.dores ?? []).join('+') || 'nenhuma'}`;
    // G3 — o rodízio entre sessões (B8 nível 2) mede AQUI, na grade, e não nos
    // cenários nomeados da seção 39. Foi rodando só em cenário nomeado que as
    // asserções de G1 passaram contra o código defeituoso.
    medirNivel2(plano, p, rot);
    medirNivel0(plano, rot);
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
      // ── E só onde a sessão TEM um principal ─────────────────────────
      //
      // A exceção já existia por grupo ("grupo sem principal de verdade… dois
      // isoladores na mesma faixa é a prescrição certa") e faltava no nível da
      // sessão. O caso que faltava é real e nasceu com a regra de dor: em casa
      // com halteres, dor no ombro e um dia "Ombro e braços", TODO exercício
      // possível é monoarticular — elevação lateral, frontal, crucifixo
      // inverso, rosca, tríceps. Cinco isoladores a 10-15 é a prescrição certa,
      // não o colapso de A6, que é o composto pesado recebendo 8-12 igual ao
      // acessório. Sem principal na sessão não existe o degrau que A6 mede.
      const temPrincipal = forca.some((e) => e.papel === 'principal');
      // Sessão inteira de carga fixa (casa sem equipamento) tem uma faixa só
      // porque a zona não é escolhível em exercício nenhum dela — é a
      // prescrição certa, e cobrar variedade ali seria cobrar o que C1 proibiu.
      const algumaAjustavel = forca.some((e) => e.tipoCarga === 'peso_reps');
      if ((algumGrupoRepete && algumaAjustavel && temPrincipal && faixas.size < 2) || colapsado) {
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

// ═══════════════════════════════════════════════════════════════════════════
// Fase 5 — Segurança e nutrição (F5, N3, N6, N8, U8)
//
// DUAS UNIDADES NOVAS, e nenhuma delas aparece contando série ou exercício:
//
//   · **exercício × dor** — a contraindicação vale ou não vale para aquele
//     perfil. Um plano inteiro pode estar dentro de todos os tetos e ainda
//     oferecer, no meio do treino, exatamente o movimento que dói.
//   · **dia de dieta** — a meta de um dia para um corpo concreto. Nada disso
//     tem a ver com o plano de treino, e por isso nada acima mede.
//
// Os módulos novos entram por import DINÂMICO (mesmo motivo da seção 23):
// ausente vale objeto vazio e a asserção FALHA, em vez de o processo morrer no
// link antes da primeira asserção.
// ═══════════════════════════════════════════════════════════════════════════

const FONTE_SHEET = readFileSync(new URL('../src/shared/ui/Sheet.tsx', import.meta.url), 'utf8');

// ── 30. Contraindicação por dor: padrão e atributo, não lista de nomes (F5a) ──
//
// UNIDADE: **exercício × dor** — 124 exercícios × 5 regiões = 620 decisões.
//
// O critério em produção é o IMPLEMENTO, não o padrão de movimento, e por isso
// as listas têm buracos que não se enxergam lendo: lombar evita `Stiff` e
// mantém `Levantamento terra romeno`; joelho evita `Afundo com barra` e mantém
// `Afundo com halteres`, `Agachamento búlgaro` e `Afundo caminhando`; ombro
// evita a `Elevação lateral` — o exercício mais benigno da abdução — e mantém a
// `Remada alta`, que é abdução com rotação interna e ainda entra como composto
// de barra. Esse último já mordeu em G2: tirar a elevação lateral abriu a vaga
// do padrão para a remada alta em 23 perfis com dor no ombro.
console.log('\n30. Contraindicação por dor derivada de padrão + atributo (F5a)');
{
  ok(
    'a regra de dor é uma FUNÇÃO de atributos, não uma lista de nomes',
    typeof CONTRA.bloqueadoPorDor === 'function',
    typeof CONTRA.bloqueadoPorDor
  );
  ok(
    'e as cargas mecânicas de cada exercício são declaradas',
    typeof CONTRA.cargasDe === 'function',
    typeof CONTRA.cargasDe
  );
  ok(
    'toda região de dor declara QUAIS cargas ela contraindica',
    !!CONTRA.CARGAS_POR_DOR &&
      REGIOES_DOR.every((r) => Array.isArray(CONTRA.CARGAS_POR_DOR[r.chave]) && CONTRA.CARGAS_POR_DOR[r.chave].length),
    CONTRA.CARGAS_POR_DOR ? Object.keys(CONTRA.CARGAS_POR_DOR).join(', ') : 'não existe'
  );

  // ── A tabela do achado, nome a nome ────────────────────────────────────
  //
  // Cada linha aqui é uma frase literal de F5 ou da lista que produção já
  // tinha. `true` = tem que sair do plano; `false` = tem que continuar
  // disponível. As três primeiras seções são os buracos citados; a quarta é a
  // garantia de que nada que hoje protege deixou de proteger.
  const ESPERADO = {
    ombro: {
      // Desenvolvimento acima da linha do olho — os SEIS, não só o de barra.
      'Desenvolvimento militar': true,
      'Desenvolvimento com halteres': true,
      'Desenvolvimento Arnold': true,
      'Desenvolvimento máquina': true,
      'Desenvolvimento na polia': true,
      'Flexão pique': true,
      // Abdução com rotação interna.
      'Remada alta': true,
      // Ombro em extensão profunda com o peso do corpo.
      'Mergulho no paralelo': true,
      'Mergulho entre bancos': true,
      // Mão travada na barra: o ombro não tem para onde escapar embaixo.
      'Supino reto com barra': true,
      'Supino inclinado com barra': true,
      // PRESERVADO — é a inversão que F5 manda desfazer. Abdução neutra, carga
      // leve, 12-20 com RIR 2: o exercício de ombro que MAIS costuma ser
      // tolerado, e o único do padrão `lateral` no catálogo inteiro.
      'Elevação lateral': false,
      // Empurrar com trajetória livre continua disponível.
      'Supino reto com halteres': false,
      'Supino máquina': false,
      'Supino na polia': false,
      'Face pull': false,
      'Crucifixo inverso': false,
      // "Remada alta na máquina" é um HIGH ROW (grupo costas): nome parecido,
      // movimento diferente. Bloquear por semelhança de nome seria a lista
      // nominal de volta, com outro disfarce.
      'Remada alta na máquina': false,
    },
    lombar: {
      Stiff: true,
      'Levantamento terra romeno': true,
      'Bom dia com barra': true,
      'Stiff com halteres': true,
      'Levantamento terra': true,
      'Agachamento livre': true,
      'Agachamento frontal': true,
      'Remada curvada com barra': true,
      'Remada cavalinho': true,
      // Hinge sem carga axial livre: o cabo e a máquina puxam na horizontal.
      'Pull through na polia': false,
      'Hiperextensão lombar': false,
      'Mesa flexora': false,
      'Cadeira flexora': false,
      'Leg press': false,
      'Remada baixa na polia': false,
      'Puxada frontal na polia': false,
    },
    joelho: {
      'Afundo com barra': true,
      'Afundo com halteres': true,
      'Agachamento búlgaro': true,
      'Afundo caminhando': true,
      'Afundo reverso com halteres': true,
      'Subida no banco': true,
      'Subida no banco com halteres': true,
      'Agachamento livre': true,
      'Agachamento goblet': true,
      'Hack machine': true,
      // Agachamento sem carga externa é o que sobra em casa — e a amplitude
      // ali é escolhida pela pessoa, não pela barra nas costas.
      'Agachamento livre sem peso': false,
      'Agachamento na cadeira': false,
      'Leg press': false,
      'Cadeira extensora': false,
      'Mesa flexora': false,
    },
    punho: {
      'Rosca direta com barra': true,
      'Supino fechado': true,
      'Flexão de braço': true,
      'Flexão inclinada': true,
      'Flexão com pés elevados': true,
      'Rosca alternada com halteres': false,
      'Rosca martelo': false,
      'Supino máquina': false,
    },
    cotovelo: {
      'Tríceps testa': true,
      'Tríceps francês': true,
      'Rosca scott': true,
      'Rosca concentrada': true,
      'Mergulho no paralelo': true,
      'Mergulho entre bancos': true,
      'Tríceps na polia com corda': false,
      'Rosca direta com barra': false,
    },
  };

  let erradas = 0;
  const amostraDor = { bloqueouDemais: '', deixouPassar: '' };
  for (const [regiao, tabela] of Object.entries(ESPERADO)) {
    for (const [nome, esperado] of Object.entries(tabela)) {
      const ex = acharEx(nome);
      if (!ex) {
        erradas++;
        amostraDor.deixouPassar ||= `${nome} não existe no catálogo`;
        continue;
      }
      const real = bloqueado(ex, regiao);
      if (real === esperado) continue;
      erradas++;
      if (real) amostraDor.bloqueouDemais ||= `${regiao}: ${nome} bloqueado e não devia`;
      else amostraDor.deixouPassar ||= `${regiao}: ${nome} passa e não devia`;
    }
    const dessaRegiao = Object.entries(tabela).filter(([nome, esp]) => {
      const ex = acharEx(nome);
      return !ex || bloqueado(ex, regiao) !== esp;
    });
    ok(
      `dor no ${regiao}: as ${Object.keys(tabela).length} decisões da tabela batem`,
      dessaRegiao.length === 0,
      dessaRegiao.map(([n]) => n).join(', ')
    );
  }
  console.log(`   ${erradas} decisão(ões) fora da tabela — ${amostraDor.deixouPassar || amostraDor.bloqueouDemais || 'nenhuma'}`);

  // ── Toda decisão de bloqueio é EXPLICÁVEL por uma carga declarada ───────
  //
  // É a régua genérica, e é ela que impede a lista nominal de voltar por
  // baixo. Um bloqueio que não casa com nenhuma carga mecânica do exercício é
  // um nome escrito à mão — e nome escrito à mão é como `Elevação lateral`
  // saiu e `Remada alta` ficou. A ÚNICA saída é o reforço declarado, que
  // precisa dizer o motivo mecânico por escrito.
  const cargasDe = CONTRA.cargasDe ?? (() => []);
  const porDor = CONTRA.CARGAS_POR_DOR ?? {};
  const reforcos = CONTRA.REFORCOS ?? {};
  let semExplicacao = 0;
  let amostraSem = '';
  for (const ex of CATALOGO_DOR) {
    for (const r of REGIOES_DOR) {
      if (!bloqueado(ex, r.chave)) continue;
      const cargas = new Set(cargasDe(ex));
      const casa = (porDor[r.chave] ?? []).some((c) => cargas.has(c));
      const reforcado = !!reforcos[r.chave]?.[ex.nome];
      if (casa || reforcado) continue;
      semExplicacao++;
      amostraSem ||= `${r.chave}: ${ex.nome}`;
    }
  }
  ok(
    'todo bloqueio é explicado por uma carga mecânica (ou por reforço declarado com motivo)',
    semExplicacao === 0,
    `${semExplicacao} sem explicação — ${amostraSem}`
  );
  const reforcoSemMotivo = Object.entries(reforcos).flatMap(([r, m]) =>
    Object.entries(m ?? {}).filter(([, motivo]) => !motivo || String(motivo).length < 20).map(([n]) => `${r}:${n}`)
  );
  ok(
    'e todo reforço nominal traz o motivo mecânico por escrito',
    reforcoSemMotivo.length === 0,
    reforcoSemMotivo.join(', ')
  );

  // ── A regra não pode apagar um grupo que TINHA alternativa ─────────────
  //
  // Contraindicação que zera um grupo com cinco opções não protege ninguém:
  // manda a pessoa treinar sem peito. A régua é por LOCAL, porque é o local
  // que já limitou o catálogo antes de a dor chegar.
  //
  // A garantia possível NÃO é "nunca zera" — é a mesma do grupo que o relógio
  // apaga. Em casa, só com o peso do corpo, o catálogo tem UM exercício direto
  // de ombro (`Flexão pique`, que é empurrar acima da cabeça) e UM de tríceps
  // (`Mergulho entre bancos`, que é ombro em extensão): com dor no ombro não
  // existe alternativa a oferecer, e fingir que existe seria pior. Aí a
  // exigência vira outra — o plano DIZ.
  let grupoZerado = 0;
  const zeradosComUmaOpcao = [];
  let amostraZero = '';
  for (const l of LOCAIS) {
    const equip = new Set(l.equipamentos);
    const semLocal = foraDoLocal(l.chave);
    for (const r of REGIOES_DOR) {
      for (const g of GRANDES_T) {
        const noLocal = CATALOGO_DOR.filter(
          (e) =>
            e.grupo_primario === g &&
            (!e.equipamento || equip.has(e.equipamento)) &&
            !semLocal.has(e.nome)
        );
        if (!noLocal.length) continue;
        const sobrou = noLocal.filter((e) => !bloqueado(e, r.chave));
        if (sobrou.length) continue;
        if (noLocal.length === 1) {
          zeradosComUmaOpcao.push(`${l.chave}/${r.chave}/${g}`);
          continue;
        }
        grupoZerado++;
        amostraZero ||= `${l.chave} + dor ${r.chave}: ${g} zerado tendo ${noLocal.length} opções`;
      }
    }
  }
  ok('nenhuma dor apaga um grupo grande que tinha alternativa no local', grupoZerado === 0,
     `${grupoZerado} — ${amostraZero}`);

  // E onde ele zera com opção única, o plano precisa declarar.
  {
    const plano = await montarPlano(
      { ...base, local: 'casa_simples', dias: 4, diasDisponiveis: [1, 2, 4, 5], minutosPorDia: Array(7).fill(60), dores: ['ombro'] },
      fonte
    );
    const direto = new Set(
      plano.dias.flatMap((d) => d.exercicios.filter((e) => e.grupo !== 'cardio').map((e) => e.grupo))
    );
    ok(
      'casa sem equipamento + dor no ombro: o grupo apagado vem declarado',
      direto.has('ombro') || plano.avisos.some((a) => /não sobrou opção segura|sai do plano/i.test(a)),
      plano.avisos.find((a) => /segura/i.test(a)) ?? `ombro no plano: ${direto.has('ombro')}`
    );
    console.log(`   ${zeradosComUmaOpcao.length} combinação(ões) local×dor com opção única contraindicada: ${zeradosComUmaOpcao.join(', ') || 'nenhuma'}`);
  }

  // ── E o gerador de fato consome a regra nova ───────────────────────────
  for (const dor of ['ombro', 'joelho', 'lombar']) {
    const plano = await montarPlano(
      { ...base, dias: 4, diasDisponiveis: [1, 2, 4, 5], minutosPorDia: Array(7).fill(90), dores: [dor] },
      fonte
    );
    const vazaram = plano.dias.flatMap((d) =>
      d.exercicios.filter((e) => e.grupo !== 'cardio' && acharEx(e.nome) && bloqueado(acharEx(e.nome), dor))
    );
    ok(`plano com dor no ${dor}: nenhum exercício contraindicado no treino`, vazaram.length === 0,
       vazaram.map((e) => e.nome).join(', '));
  }
}

// ── 31. A troca em sessão respeita dor e local (F5b) ───────────────────────
//
// UNIDADE: **exercício × dor**, no ponto de maior risco — no meio do treino,
// com pressa, com o aparelho ocupado. `substitutosDisponiveis` devolve o mapa
// `SUBSTITUICOES` cru: com dor no ombro, o gerador tira o desenvolvimento
// militar do plano e o sheet o oferece de volta como PRIMEIRA opção de troca do
// desenvolvimento com halteres. A proteção inteira do gerador desfeita em um
// toque.
console.log('\n31. Substituto oferecido em sessão respeita dor e local (F5b)');
{
  ok(
    'existe um filtro de troca, e ele é uma função pura (testável sem banco)',
    typeof TROCA.filtrarSubstitutos === 'function',
    typeof TROCA.filtrarSubstitutos
  );

  // O fallback é a regra de hoje: o mapa cru, sem filtro nenhum.
  const filtrar =
    TROCA.filtrarSubstitutos ??
    ((atual, cands) => ({ permitidos: cands.filter((c) => c.nome !== atual), recusados: [] }));

  const candidatosDe = (nome) => {
    const ex = acharEx(nome);
    const mapeados = substitutosDe(nome).map(acharEx).filter(Boolean);
    const mesmoGrupo = CATALOGO_DOR.filter(
      (e) => ex && e.grupo_primario === ex.grupo_primario && e.nome !== nome
    );
    const vistos = new Set();
    return [...mapeados, ...mesmoGrupo].filter((e) => !vistos.has(e.nome) && vistos.add(e.nome));
  };

  let oferecidoComDor = 0;
  let oferecidoForaDoLocal = 0;
  let ofereceuOProprio = 0;
  let semAlternativa = 0;
  const amostraTroca = { dor: '', local: '', proprio: '', vazio: '' };
  // Quantos contraindicados a troca oferecia ANTES — é o número do relatório.
  let oferecidosSemFiltro = 0;

  for (const nome of Object.keys(SUBSTITUICOES)) {
    if (!acharEx(nome)) continue;
    for (const l of LOCAIS) {
      for (const r of [...REGIOES_DOR.map((x) => x.chave), null]) {
        const dores = r ? [r] : [];
        const cands = candidatosDe(nome);
        if (r) {
          oferecidosSemFiltro += substitutosDe(nome)
            .map(acharEx)
            .filter((e) => e && bloqueado(e, r)).length;
        }
        const saida = filtrar(nome, cands, { dores, local: l.chave });
        const permitidos = saida?.permitidos ?? [];

        for (const p of permitidos) {
          if (p.nome === nome) {
            ofereceuOProprio++;
            amostraTroca.proprio ||= `${nome} oferecido como troca de si mesmo`;
          }
          if (r && bloqueado(p, r)) {
            oferecidoComDor++;
            amostraTroca.dor ||= `${nome} (dor ${r}) → ${p.nome}`;
          }
          const equip = new Set(l.equipamentos);
          if ((p.equipamento && !equip.has(p.equipamento)) || foraDoLocal(l.chave).has(p.nome)) {
            oferecidoForaDoLocal++;
            amostraTroca.local ||= `${l.chave}: ${nome} → ${p.nome} (${p.equipamento})`;
          }
        }
        // Nunca deixar a pessoa sem saída quando existe saída: se algum
        // candidato passa nos dois filtros, ele TEM que aparecer.
        const possiveis = cands.filter(
          (e) =>
            e.nome !== nome &&
            (!e.equipamento || new Set(l.equipamentos).has(e.equipamento)) &&
            !foraDoLocal(l.chave).has(e.nome) &&
            !(r && bloqueado(e, r))
        );
        if (possiveis.length && !permitidos.length) {
          semAlternativa++;
          amostraTroca.vazio ||= `${l.chave}/${r ?? 'sem dor'}: ${nome} devolveu lista vazia com ${possiveis.length} possíveis`;
        }
      }
    }
  }

  console.log(`   o mapa cru oferecia ${oferecidosSemFiltro} substituto(s) contraindicado(s) nas combinações medidas`);
  ok('nenhum substituto contraindicado pela dor do perfil', oferecidoComDor === 0,
     `${oferecidoComDor} — ${amostraTroca.dor}`);
  ok('nenhum substituto que o local não tem', oferecidoForaDoLocal === 0,
     `${oferecidoForaDoLocal} — ${amostraTroca.local}`);
  ok('nunca oferece o próprio exercício como troca', ofereceuOProprio === 0,
     `${ofereceuOProprio} — ${amostraTroca.proprio}`);
  ok('e nunca devolve lista vazia havendo alternativa válida', semAlternativa === 0,
     `${semAlternativa} — ${amostraTroca.vazio}`);

  // O caso concreto do achado, escrito por extenso.
  const caso = filtrar('Desenvolvimento com halteres', candidatosDe('Desenvolvimento com halteres'), {
    dores: ['ombro'],
    local: 'academia',
  });
  ok(
    'dor no ombro: trocar o desenvolvimento com halteres NÃO oferece o militar',
    !(caso?.permitidos ?? []).some((e) => e.nome === 'Desenvolvimento militar'),
    (caso?.permitidos ?? []).map((e) => e.nome).slice(0, 4).join(', ') || 'lista vazia'
  );
  ok(
    'e a recusa é dita, não silenciosa (a tela precisa poder explicar)',
    (caso?.recusados ?? []).some((x) => /dor|ombro/i.test(x.motivo ?? '')),
    (caso?.recusados ?? []).map((x) => `${x.nome}: ${x.motivo}`).slice(0, 2).join(' | ') || 'nenhuma recusa registrada'
  );

  // E a tela consome o filtro em vez do mapa cru.
  ok(
    'o sheet de troca deixou de dizer "Buscando alternativas…" para lista vazia de verdade',
    !/Buscando alternativas…\s*<\/Txt>/.test(FONTE_SESSAO) || /recusados/.test(FONTE_SESSAO),
    /recusados/.test(FONTE_SESSAO) ? 'a tela lê as recusas' : 'a tela ainda finge que está carregando'
  );
}

// ── 32. O motivo `dor` deixa de ser escrita que ninguém lê (F5c) ───────────
//
// UNIDADE: **exercício × dor**. `MOTIVOS_TROCA` tem "Senti dor ou desconforto",
// o app grava em `substituicoes.motivo` e nenhuma linha do repositório lê essa
// coluna: não marca o exercício, não sugere atualizar o perfil, não muda nada
// no plano da semana seguinte. Duas vezes o mesmo exercício com o mesmo motivo
// é o app tendo a informação e não usando.
console.log('\n32. Dor registrada 2× vira sugestão de perfil (F5c)');
{
  ok(
    'existe uma regra que lê o motivo `dor` e responde',
    typeof CONTRA.regiaoSugeridaPara === 'function',
    typeof CONTRA.regiaoSugeridaPara
  );
  const sugerir = CONTRA.regiaoSugeridaPara ?? (() => null);

  const militar = acharEx('Desenvolvimento militar');
  const agacho = acharEx('Agachamento livre');
  const testa = acharEx('Tríceps testa');

  ok(
    'uma vez só não sugere nada (troca por dor pontual acontece)',
    sugerir(militar, 1, []) === null,
    String(sugerir(militar, 1, []))
  );
  ok(
    'duas vezes no desenvolvimento militar sugere OMBRO',
    sugerir(militar, 2, []) === 'ombro',
    String(sugerir(militar, 2, []))
  );
  ok(
    'duas vezes no agachamento livre sugere joelho ou lombar',
    ['joelho', 'lombar'].includes(sugerir(agacho, 2, [])),
    String(sugerir(agacho, 2, []))
  );
  ok(
    'duas vezes no tríceps testa sugere COTOVELO',
    sugerir(testa, 2, []) === 'cotovelo',
    String(sugerir(testa, 2, []))
  );
  ok(
    'e não sugere o que o perfil já tem (aviso repetido vira ruído)',
    sugerir(militar, 5, ['ombro']) === null,
    String(sugerir(militar, 5, ['ombro']))
  );
  // Exercício que nenhuma carga mecânica liga a uma região não inventa uma.
  const panturrilha = acharEx('Panturrilha sentado');
  ok(
    'exercício sem região associada não inventa uma sugestão',
    sugerir(panturrilha, 3, []) === null || REGIOES_DOR.some((r) => r.chave === sugerir(panturrilha, 3, [])),
    String(sugerir(panturrilha, 3, []))
  );

  ok(
    'e o executor consome a sugestão depois da troca por dor',
    /dorRepetida|regiaoSugeridaPara|sugestaoDor/.test(FONTE_SESSAO),
    /dorRepetida|regiaoSugeridaPara|sugestaoDor/.test(FONTE_SESSAO) ? 'ligado' : 'o motivo continua só sendo gravado'
  );
}

// ── 33. Nutrição: a unidade é o DIA DE DIETA ───────────────────────────────
//
// UNIDADE: **dia de dieta** — a meta de UM dia para UM corpo. A grade varre
// peso 50-140 kg, gordura 8-45%, os quatro objetivos, homem e mulher, com e sem
// bioimpedância: 2.688 corpos. Nenhum invariante do arquivo inteiro mediu isso
// até agora, e é onde moram N3 (proteína de emagrecimento sobre o peso total,
// 264 g/dia para 120 kg com 40% de gordura) e N8 (sem piso calórico, carbo
// podendo ir a 0 g em silêncio, `deficitMaximoSeguro` definido e nunca chamado).
console.log('\n33. Meta de nutrição por dia de dieta (N3, N8)');
{
  ok(
    'o cálculo de meta mora num módulo puro (sem banco), com aviso junto do número',
    typeof META.calcularMetaDetalhada === 'function',
    typeof META.calcularMetaDetalhada
  );
  ok('e o piso calórico é uma função declarada', typeof META.pisoCalorico === 'function',
     typeof META.pisoCalorico);

  /**
   * A regra ANTERIOR à Fase 5, replicada aqui com nome explícito.
   *
   * Ela morava em `calculos.macros()` e continuou exportada e chamável depois
   * que `meta.ts` virou a rota única — inclusive com o `2.2` sobre o peso
   * total, que é a linha que produz os 264 g. Lista antiga viva ao lado da
   * regra nova é a que a próxima pessoa acha primeiro: a Fase 5 escreveu isso
   * ao renomear `REGIOES_DOR.evitar` e não aplicou ao próprio domínio. Agora
   * o legado mora onde o legado é usado — no harness, com o nome do que ele é.
   */
  const macrosLegadoPorPesoTotal = (kcalAlvo, pesoKg, objetivo) => {
    const gPorKg =
      objetivo === 'emagrecimento' ? 2.2
      : objetivo === 'recomposicao' ? 2.4
      : objetivo === 'hipertrofia' ? 1.9
      : 1.8;
    const proteina_g = Math.round(pesoKg * gPorKg);
    const gordura_g = Math.round((kcalAlvo * 0.25) / 9);
    const carbo_g = Math.max(0, Math.round((kcalAlvo - proteina_g * 4 - gordura_g * 9) / 4));
    return { kcal: kcalAlvo, proteina_g, carbo_g, gordura_g };
  };

  // Fallback = o caminho de hoje, replicado só para o GATE poder rodar contra
  // `ee156d5`: recomposição pela massa magra, todo o resto pelo peso total.
  const legado = (gasto, pesoKg, objetivo, gorduraPct, estimar) =>
    objetivo === 'recomposicao'
      ? RECOMP.macrosRecomposicao(Math.round(gasto * DEFICIT_RECOMPOSICAO), pesoKg, gorduraPct, estimar)
      : macrosLegadoPorPesoTotal(metaCalorica(gasto, objetivo), pesoKg, objetivo);
  const calcular =
    META.calcularMetaDetalhada ??
    ((e) => ({ meta: legado(e.tdee, e.pesoKg, e.objetivo, e.gorduraPct, e.estimar), avisos: [] }));

  const PESOS = [50, 62, 75, 88, 105, 120, 140];
  const GORDURAS = [8, 15, 22, 30, 38, 45];
  const OBJETIVOS = ['emagrecimento', 'recomposicao', 'hipertrofia', 'manutencao'];
  const GENEROS = ['masculino', 'feminino'];
  const ALTURAS = [158, 172, 186];
  const NIVEIS = ['sedentario', 'moderado', 'intenso'];

  const corpos = [];
  let n = 0;
  for (const pesoKg of PESOS)
    for (const gordura of GORDURAS)
      for (const objetivo of OBJETIVOS)
        for (const genero of GENEROS)
          for (const medida of [true, false]) {
            const alturaCm = ALTURAS[n % ALTURAS.length];
            const idadeAnos = [22, 34, 47, 58][n % 4];
            const nivel = NIVEIS[n % NIVEIS.length];
            corpos.push({
              pesoKg, gorduraReal: gordura, objetivo, genero, alturaCm, idadeAnos, nivel,
              // Sem bioimpedância a massa magra é estimada — o mesmo caminho
              // que `macrosRecomposicao` já usa.
              gorduraPct: medida ? gordura : null,
            });
            n++;
          }

  let semPiso = 0, deficitDemais = 0, carboZeroCalado = 0, gorduraBaixa = 0;
  let naoFecha = 0, proteinaForaDaFaixa = 0, incoerenteObjetivo = 0;
  let proteinaAbaixoDoPlato = 0, semDeclararForaDaFaixa = 0, ordemInvertida = 0;
  let foraDeQualquerFonte = 0;
  const am = {
    piso: '', deficit: '', carbo: '', gord: '', fecha: '', prot: '', coerente: '',
    plato: '', foraFonte: '', ordem: '',
  };
  const porObjetivo = {};

  for (const c of corpos) {
    const basal = tmb(c.pesoKg, c.alturaCm, c.idadeAnos, c.genero);
    const gasto = tdee(basal, c.nivel);
    const estimar = { alturaCm: c.alturaCm, idade: c.idadeAnos, genero: c.genero };
    const entrada = {
      tdee: gasto, basal, pesoKg: c.pesoKg, objetivo: c.objetivo,
      gorduraPct: c.gorduraPct, estimar, genero: c.genero,
    };
    const r = calcular(entrada) ?? {};
    const meta = r.meta ?? {};
    const avisos = r.avisos ?? [];
    const rot = `${c.pesoKg}kg/${c.gorduraReal}%/${c.objetivo}/${c.genero}/${c.gorduraPct === null ? 'sem bio' : 'com bio'}`;

    const massaMagra = c.pesoKg * (1 - (c.gorduraPct ?? gorduraPorImc(c.pesoKg, c.alturaCm, c.idadeAnos, c.genero)) / 100);
    (porObjetivo[c.objetivo] ??= []).push({ ...c, meta, massaMagra });

    // (a) PISO: meta automática nunca abaixo do metabolismo basal.
    if (meta.kcal < Math.round(basal)) {
      semPiso++;
      am.piso ||= `${rot}: meta ${meta.kcal} < TMB ${Math.round(basal)}`;
    }
    // (b) déficit dentro do que a gordura corporal entrega (~31 kcal/kg/dia).
    const gPct = c.gorduraPct ?? gorduraPorImc(c.pesoKg, c.alturaCm, c.idadeAnos, c.genero);
    const teto = deficitMaximoSeguro(c.pesoKg, gPct);
    const deficit = Math.round(gasto) - meta.kcal;
    if (deficit > teto + 1) {
      deficitDemais++;
      am.deficit ||= `${rot}: déficit ${deficit} > teto ${teto}`;
    }
    // (c) carboidrato em 0 g nunca em silêncio.
    if (meta.carbo_g <= 0 && !avisos.length) {
      carboZeroCalado++;
      am.carbo ||= `${rot}: carbo 0 g sem aviso`;
    }
    // (d) gordura nunca abaixo de 20% das calorias (questão hormonal, e é o
    //     piso que o próprio comentário do código promete).
    if (meta.gordura_g * 9 < meta.kcal * 0.199) {
      gorduraBaixa++;
      am.gord ||= `${rot}: gordura ${Math.round((meta.gordura_g * 9 * 100) / meta.kcal)}% das kcal`;
    }
    // (e) os macros fecham a caloria — senão a tela mostra três barras que não
    //     somam o anel do meio.
    const soma = meta.proteina_g * 4 + meta.carbo_g * 4 + meta.gordura_g * 9;
    if (Math.abs(soma - meta.kcal) > Math.max(40, meta.kcal * 0.03)) {
      naoFecha++;
      am.fecha ||= `${rot}: macros somam ${soma} para meta ${meta.kcal}`;
    }
    // ── (f) PROTEÍNA — as DUAS unidades, em TODO objetivo (N17) ──────────
    //
    // UNIDADE: **g por kg de massa magra** (teto) *e* **g por kg de peso**
    // (piso). As duas, sempre, nos quatro objetivos.
    //
    // A régua anterior media déficit em massa magra e ganho em peso, e a de
    // ganho era **aritmeticamente incapaz de falhar**: a proteína de
    // hipertrofia ERA `round(peso × 1,9)`, então `proteina/peso` valia 1,9 e a
    // faixa cobrada era 1,4-2,0. O comentário logo acima dela descrevia o
    // defeito com precisão ("quem tem gordura alta em ganhar massa recebe até
    // 4,2 g/kg de massa magra") enquanto a asserção media na unidade em que
    // esse defeito é invisível. Quarta vez neste projeto: M3 do cardio, este
    // (f2), e as duas do G2.
    //
    // Cada unidade só pega o defeito que mora nela, e é por isso que precisam
    // ser as duas:
    //   · **peso** não pega proteína que ignora a composição corporal (N3:
    //     264 g para 120 kg com 40% de gordura é 2,2 g/kg de peso — dentro de
    //     qualquer faixa medida em peso, e alimentando 48 kg de gordura).
    //   · **massa magra** não pega proteína abaixo do platô de dose-resposta
    //     (Morton 2018, 1,62 g/kg de PESO, IC 1,03-2,20 — a meta-análise que
    //     define onde o ganho para de subir, e ela é por peso total).
    //
    // Teto: 3,1 g/kg de massa magra (Helms 2014, topo da faixa de atleta em
    // corte agressivo). Piso: 1,6 g/kg de peso (Morton). Onde os dois se
    // contradizem — gordura acima de ~48%, em que o piso sozinho já estoura o
    // teto — nenhuma fonte cobre o corpo, e a exigência passa a ser que o app
    // DIGA isso em vez de imprimir um número com cara de prescrição.
    const gPorKgMM = meta.proteina_g / massaMagra;
    const gPorKgPeso = meta.proteina_g / c.pesoKg;
    if (gPorKgPeso < 1.6 - 0.02) {
      proteinaAbaixoDoPlato++;
      am.plato ||= `${rot}: ${meta.proteina_g} g = ${gPorKgPeso.toFixed(2)} g/kg de peso (platô de Morton 1,62)`;
    }
    if (gPorKgMM > 3.1) {
      // Passar do teto de Helms só se justifica quando o PISO de Morton
      // obrigou — acima de ~48% de gordura os dois se contradizem, e aí
      // nenhum denominador cobre o corpo. Fora disso é defeito.
      if (gPorKgPeso > 1.6 + 0.02) {
        proteinaForaDaFaixa++;
        am.prot ||= `${rot}: ${meta.proteina_g} g = ${gPorKgMM.toFixed(2)} g/kg de massa magra (teto 3,1), e o piso de Morton não obrigava (${gPorKgPeso.toFixed(2)} g/kg de peso)`;
      } else {
        // O piso obrigou — e aí o app tem que DIZER que o número saiu da
        // faixa de toda fonte aberta. Impresso liso ao lado dos que estão
        // dentro, ele é indistinguível de prescrição.
        foraDeQualquerFonte++;
        if (!avisos.some((a) => /faixa|fonte|estimativa|referência/i.test(a))) {
          semDeclararForaDaFaixa++;
          am.foraFonte ||= `${rot}: ${gPorKgMM.toFixed(2)} g/kg de massa magra sem nenhum aviso`;
        }
      }
    }
  }

  // ── (g) e (h): a unidade é o PAR DE OBJETIVOS PARA O MESMO CORPO ───────
  //
  // Nenhuma régua de um corpo só pega isto. As proteínas de déficit e de
  // superávit podem estar ambas dentro das faixas, cada uma na sua unidade, e
  // **na ordem errada uma em relação à outra** — que é exatamente o estado que
  // a Fase 5 criou ao consertar um ramo e não olhar o outro. A comparação é a
  // medição; separadas, as duas passam.
  const chaveCorpo = (c) => `${c.pesoKg}/${c.gorduraReal}/${c.genero}/${c.alturaCm}/${c.idadeAnos}/${c.nivel}/${c.gorduraPct === null}`;
  const porCorpo = new Map();
  for (const o of OBJETIVOS)
    for (const c of porObjetivo[o] ?? []) {
      const k = chaveCorpo(c);
      if (!porCorpo.has(k)) porCorpo.set(k, {});
      porCorpo.get(k)[o] = c;
    }

  // (g) o mesmo corpo em déficit não recebe duas proteínas diferentes só
  //     porque marcou "perder gordura" em vez de "recomposição" (N3).
  let piorRazao = 1;
  for (const [, par] of porCorpo) {
    if (!par.emagrecimento || !par.recomposicao) continue;
    const a = par.emagrecimento.meta.proteina_g;
    const b = par.recomposicao.meta.proteina_g;
    const razao = Math.max(a, b) / Math.max(1, Math.min(a, b));
    if (razao > 1.15) {
      incoerenteObjetivo++;
      am.coerente ||= `${par.emagrecimento.pesoKg}kg/${par.emagrecimento.gorduraReal}%: emagrecimento ${a} g x recomposição ${b} g`;
    }
    piorRazao = Math.max(piorRazao, razao);
  }

  // (h) ORDENAÇÃO — proteína em restrição calórica nunca abaixo da de
  //     superávit, para o MESMO corpo (N11).
  //
  // A evidência afirma a direção explicitamente: a ISSN dá 2,3-3,1 g/kg em
  // restrição contra 1,4-2,0 geral, e Helms escala com a severidade do
  // déficit — em déficit a proteína tem dupla função, construir e proteger.
  // Antes da Fase 5 a ordem estava certa por acidente (264 g de emagrecimento
  // contra 228 de hipertrofia, os dois sobre o peso total). Depois dela, e só
  // acima de ~21% de gordura, "ganhar massa" passou a receber MAIS: o ponto de
  // cruzamento é algébrico, `2,4 × (1 − GC) = 1,9` → GC = 20,8%, e nenhuma
  // régua olhava os dois ramos ao mesmo tempo.
  let piorInversao = 0;
  for (const [, par] of porCorpo)
    for (const d of ['emagrecimento', 'recomposicao'])
      for (const s of ['hipertrofia', 'manutencao']) {
        if (!par[d] || !par[s]) continue;
        const pd = par[d].meta.proteina_g;
        const ps = par[s].meta.proteina_g;
        if (ps > pd + 1) {
          ordemInvertida++;
          const gc = par[d].gorduraReal;
          am.ordem ||= `${par[d].pesoKg}kg/${gc}%: ${d} ${pd} g < ${s} ${ps} g (${(ps / (par[d].pesoKg * (1 - gc / 100))).toFixed(2)} g/kg de massa magra no superávit)`;
          piorInversao = Math.max(piorInversao, ps - pd);
        }
      }

  console.log(`   grade: ${corpos.length} corpos (peso 50-140, gordura 8-45%, 4 objetivos, 2 gêneros, com/sem bio)`);
  ok('(a) meta automática nunca abaixo do metabolismo basal', semPiso === 0, `${semPiso} — ${am.piso}`);
  ok('(b) déficit nunca acima do que a gordura corporal entrega', deficitDemais === 0, `${deficitDemais} — ${am.deficit}`);
  ok('(c) carboidrato em 0 g nunca em silêncio', carboZeroCalado === 0, `${carboZeroCalado} — ${am.carbo}`);
  ok('(d) gordura nunca abaixo de 20% das calorias', gorduraBaixa === 0, `${gorduraBaixa} — ${am.gord}`);
  ok('(e) os macros sempre fecham a caloria da meta', naoFecha === 0, `${naoFecha} — ${am.fecha}`);
  ok('(f) TODO objetivo: proteína no máx. 3,1 g/kg de MASSA MAGRA (Helms)',
     proteinaForaDaFaixa === 0, `${proteinaForaDaFaixa} — ${am.prot}`);
  ok('(f2) TODO objetivo: proteína no mín. 1,6 g/kg de PESO (platô de Morton)',
     proteinaAbaixoDoPlato === 0, `${proteinaAbaixoDoPlato} — ${am.plato}`);
  ok('(f3) corpo que nenhuma fonte cobre recebe a estimativa DECLARADA, não um número liso',
     semDeclararForaDaFaixa === 0, `${semDeclararForaDaFaixa} de ${foraDeQualquerFonte} — ${am.foraFonte}`);
  // Sem esta linha, (f3) passa por vacuidade: se nenhum corpo da grade
  // estourasse a faixa, ela seria uma asserção que não pode falhar — o defeito
  // que esta fase inteira existe para consertar.
  ok('(f3) e havia corpos fora da faixa para medir (a régua não passou por vacuidade)',
     foraDeQualquerFonte > 0, `${foraDeQualquerFonte} de ${corpos.length} corpos acima de 3,1 g/kg de massa magra`);
  ok('(g) o mesmo corpo em déficit recebe a mesma proteína nos dois objetivos',
     incoerenteObjetivo === 0, `${incoerenteObjetivo} — ${am.coerente} (pior razão ${piorRazao.toFixed(2)}×)`);
  ok('(h) proteína em déficit NUNCA abaixo da de superávit, no mesmo corpo',
     ordemInvertida === 0,
     `${ordemInvertida} par(es) invertidos, pior por ${piorInversao} g — ${am.ordem}`);

  // ── A meta MANUAL, que é onde o carbo ia a zero em silêncio ────────────
  //
  // `definirMetaCalorica` mantém proteína e gordura como pisos e joga o ajuste
  // inteiro no carboidrato com `Math.max(0, ...)`: uma meta de 1.200 kcal para
  // quem tem P+G = 1.180 grava carbo 0 g e nenhuma tela diz nada. Zero grama
  // de carboidrato não é dieta baixa em carbo — é uma conta que estourou.
  ok('existe a regra da meta manual, com a escada de ajuste', typeof META.macrosParaMetaManual === 'function',
     typeof META.macrosParaMetaManual);
  const manual =
    META.macrosParaMetaManual ??
    ((kcal, b) => ({
      meta: { kcal, proteina_g: b.proteina_g, gordura_g: b.gordura_g, carbo_g: Math.max(0, Math.round((kcal - b.proteina_g * 4 - b.gordura_g * 9) / 4)) },
      avisos: [],
    }));
  {
    // Base real de déficit apertado: 190 g de proteína (760 kcal) + 70 g de
    // gordura (630 kcal) = 1.390 kcal só de piso, contra uma meta de 1.300.
    // Pela regra de hoje sobra −90 kcal e o carbo é gravado como 0 g.
    const b = { kcal: 2400, proteina_g: 190, carbo_g: 100, gordura_g: 70 };
    const folgado = manual(1300, b);
    const mf = folgado?.meta ?? {};
    ok('meta manual: a gordura acompanha a caloria nova, não fica na da meta antiga',
       mf.gordura_g < b.gordura_g && mf.gordura_g * 9 >= Math.round(1300 * 0.199),
       `${mf.gordura_g} g = ${Math.round((mf.gordura_g * 9 * 100) / 1300)}% das kcal (a base tinha ${b.gordura_g} g)`);
    ok('e o carboidrato não é zerado para pagar a conta', mf.carbo_g >= 30, `${mf.carbo_g} g de carbo`);

    // 1.150 kcal: nem 25% de gordura deixa carboidrato utilizável. É onde a
    // escada tem que agir — a gordura desce ao piso de 20% ANTES de o carbo
    // secar, que é a ordem que `Math.max(0, ...)` nunca teve.
    const apertado = manual(1150, b);
    const ma = apertado?.meta ?? {};
    ok('meta manual apertada: a gordura desce ao piso de 20% antes de o carbo secar',
       Math.abs(ma.gordura_g * 9 - 1150 * 0.2) <= 9 && ma.carbo_g >= 30,
       `${ma.gordura_g} g de gordura (${Math.round((ma.gordura_g * 9 * 100) / 1150)}%), ${ma.carbo_g} g de carbo`);
    ok('e a escada é dita, não silenciosa',
       (apertado?.avisos ?? []).length > 0, (apertado?.avisos ?? []).join(' | ') || 'nenhum aviso');
    // Abaixo disso não existe divisão possível: proteína + o piso de gordura
    // já passam da meta. Aí o único caminho honesto é falar.
    const impossivel = manual(900, b);
    ok('e meta aritmeticamente impossível avisa em vez de gravar calada',
       (impossivel?.avisos ?? []).length > 0 && (impossivel?.meta?.carbo_g ?? -1) >= 0,
       `carbo ${impossivel?.meta?.carbo_g} g, ${(impossivel?.avisos ?? []).length} aviso(s)`);
  }

  // ── E a meta JÁ SALVA (inclusive manual) é auditada na leitura ──────────
  ok('existe a auditoria da meta salva', typeof META.avisosDaMeta === 'function', typeof META.avisosDaMeta);
  {
    const auditar = META.avisosDaMeta ?? (() => []);
    const basal = tmb(58, 160, 41, 'feminino');
    const avisos = auditar(
      { kcal: 1100, proteina_g: 120, carbo_g: 40, gordura_g: 35 },
      { basal, tdee: tdee(basal, 'sedentario'), pesoKg: 58, gorduraPct: 30, genero: 'feminino', objetivo: 'emagrecimento' }
    );
    ok('meta salva abaixo do metabolismo basal vira aviso na tela',
       avisos.length > 0 && avisos.some((a) => /basal|piso/i.test(a)),
       avisos.join(' | ') || 'nenhum aviso');
  }

  // ── O TETO DE DÉFICIT, conferido contra a FONTE (N12) ─────────────────
  //
  // UNIDADE: **kcal por dia para um corpo** — mas a pergunta é sobre a
  // CONSTANTE, não sobre o encanamento. O invariante (b) acima mede o clamp
  // usando a própria `deficitMaximoSeguro` como referência: ele prova que o
  // freio está ligado e não pode dizer nada sobre o número do freio estar
  // certo. Enquanto a função era código morto isso não custava nada; a Fase 5
  // a ligou como piso calórico e o número entrou na meta de todo mundo.
  //
  // Alpert 2005 (https://pubmed.ncbi.nlm.nih.gov/15615615/, aberto e conferido):
  // *"a value of (290+/-25) kJ/kgd"*. A conversão é feita aqui, na frente, em
  // vez de num número mágico: 290 / 4,184 = **69,3 kcal por kg de gordura por
  // dia**. Os 31 do código são o valor por LIBRA (31,4 kcal/lb ≈ 69,2 kcal/kg)
  // aplicado por quilograma — 2,2× mais apertado que a fonte, o que INFLA a
  // meta de quem é magro em vez de proteger.
  //
  // E o teto de verdade da literatura aplicada não é esse: é taxa de perda,
  // 0,5-1,0% do peso por semana (Ruiz-Castellano 2021, Nutrients 13(9):3255,
  // https://pmc.ncbi.nlm.nih.gov/articles/PMC8471721/, aberto e conferido).
  // Os dois são teto; o que vale é o menor.
  {
    const ALPERT_KJ_POR_KG_DIA = 290; // Alpert 2005
    const KJ_POR_KCAL = 4.184;
    const TAXA_MAX_SEMANAL = 0.01; // Ruiz-Castellano 2021, topo da faixa
    const KCAL_POR_KG_GORDURA = 7700;
    const tetoDaFonte = (pesoKg, gorduraPct) =>
      Math.min(
        ((pesoKg * gorduraPct) / 100) * (ALPERT_KJ_POR_KG_DIA / KJ_POR_KCAL),
        (pesoKg * TAXA_MAX_SEMANAL * KCAL_POR_KG_GORDURA) / 7
      );

    let foraDaFonte = 0, amostraFonte = '';
    for (const [pesoKg, gorduraPct] of [[75, 8], [62, 12], [88, 27.2], [100, 20], [120, 40], [140, 45], [50, 45]]) {
      const codigo = deficitMaximoSeguro(pesoKg, gorduraPct);
      const fonte = tetoDaFonte(pesoKg, gorduraPct);
      if (Math.abs(codigo - fonte) > Math.max(3, fonte * 0.02)) {
        foraDaFonte++;
        amostraFonte ||= `${pesoKg}kg/${gorduraPct}%: código ${codigo} kcal, fonte ${Math.round(fonte)} kcal`;
      }
    }
    ok('o teto de déficit vale o que a fonte diz, nas unidades da fonte',
       foraDaFonte === 0, `${foraDaFonte} de 7 — ${amostraFonte}`);

    // O caso que a revisora abriu: quem é magro é quem paga a conversão errada.
    // 75 kg com 8% de gordura tem 6 kg de gordura; a 69,3 kcal/kg isso são
    // 416 kcal/dia, e a 31 são 186 — o déficit de 15% (386 kcal) é cortado
    // para 186 e a meta SOBE 200 kcal sem que nada esteja errado com ela.
    const magro = deficitMaximoSeguro(75, 8);
    ok('e o corpo magro não é o que mais sofre com o teto',
       magro > 380, `${magro} kcal/dia para 6 kg de gordura (Alpert: 416)`);

    // Nenhum teto pode autorizar perda acima de 1%/semana, por mais gordura
    // que o corpo tenha: 63 kg de gordura × 69,3 dariam 4.366 kcal/dia.
    let acimaDaTaxa = 0, amostraTaxa = '';
    for (const c of corpos) {
      const gPct = c.gorduraPct ?? gorduraPorImc(c.pesoKg, c.alturaCm, c.idadeAnos, c.genero);
      const pctSemana = (deficitMaximoSeguro(c.pesoKg, gPct) * 7) / KCAL_POR_KG_GORDURA / c.pesoKg;
      if (pctSemana > TAXA_MAX_SEMANAL + 0.0005) {
        acimaDaTaxa++;
        amostraTaxa ||= `${c.pesoKg}kg/${gPct}%: ${(pctSemana * 100).toFixed(2)}% do peso por semana`;
      }
    }
    ok('e nenhum teto autoriza perder mais de 1% do peso por semana',
       acimaDaTaxa === 0, `${acimaDaTaxa} — ${amostraTaxa}`);

    // A tela imprime a explicação. Ela citava os 31 kcal/kg como se fossem a
    // fonte — número errado dito com a autoridade de um artigo.
    const FONTE_RECOMP = readFileSync(new URL('../src/features/perfil/recomposicao.ts', import.meta.url), 'utf8');
    ok('e nenhum texto do app ainda cita os 31 kcal por kg como sendo Alpert',
       !/31\s*kcal/i.test(FONTE_RECOMP) && !/gorduraKg \* 31/.test(FONTE_RECOMP),
       /31\s*kcal/i.test(FONTE_RECOMP) ? 'recomposicao.ts ainda diz 31 kcal/kg' : 'corrigido');
  }

  // ── O ramo sem altura nem idade, que a grade nunca tocou (N20) ─────────
  //
  // UNIDADE: **dia de dieta sem composição corporal**. `dadosParaEstimar`
  // devolve `undefined` quando falta altura ou idade, e aí `massaMagraDe` é
  // `null`: o cálculo cai num terceiro ramo que a grade acima nunca exercita,
  // porque ela sempre passa `estimar`. É o ramo em que o app não sabe NADA
  // sobre composição — e é justamente onde a ordenação entre objetivos tem
  // que continuar valendo, porque não há denominador para escondê-la.
  {
    let semDadosOrdem = 0, semDadosFaixa = 0, semDadosMudo = 0;
    const amSem = { ordem: '', faixa: '', mudo: '' };
    for (const pesoKg of PESOS)
      for (const genero of GENEROS) {
        const basal = tmb(pesoKg, 172, 34, genero);
        const gasto = tdee(basal, 'moderado');
        const semDados = {};
        for (const objetivo of OBJETIVOS) {
          const r = calcular({
            tdee: gasto, basal, pesoKg, objetivo,
            gorduraPct: null, estimar: undefined, genero,
          }) ?? {};
          semDados[objetivo] = r;
          const gPorKgPeso = (r.meta?.proteina_g ?? 0) / pesoKg;
          // Sem composição corporal a única régua honesta é a da ISSN, que é
          // por peso total: 1,4-2,0 g/kg/dia (Jäger 2017).
          if (gPorKgPeso > 2.0 + 0.02 || gPorKgPeso < 1.4 - 0.02) {
            semDadosFaixa++;
            amSem.faixa ||= `${pesoKg}kg/${genero}/${objetivo}: ${gPorKgPeso.toFixed(2)} g/kg de peso`;
          }
          // E a tela precisa dizer que não há composição corporal na conta.
          const base = r.baseCalculo ?? '';
          if (!/sem dados|sem bioimped|não foi possível|sem estimar|peso/i.test(base)) {
            semDadosMudo++;
            amSem.mudo ||= `${pesoKg}kg/${objetivo}: "${base}"`;
          }
        }
        for (const d of ['emagrecimento', 'recomposicao'])
          for (const s of ['hipertrofia', 'manutencao']) {
            const pd = semDados[d]?.meta?.proteina_g ?? 0;
            const ps = semDados[s]?.meta?.proteina_g ?? 0;
            if (ps > pd + 1) {
              semDadosOrdem++;
              amSem.ordem ||= `${pesoKg}kg/${genero}: ${d} ${pd} g < ${s} ${ps} g`;
            }
          }
      }
    ok('sem altura nem idade, a ordem entre déficit e superávit continua valendo',
       semDadosOrdem === 0, `${semDadosOrdem} — ${amSem.ordem}`);
    ok('e a proteína fica na faixa da ISSN por peso total (1,4-2,0 g/kg)',
       semDadosFaixa === 0, `${semDadosFaixa} — ${amSem.faixa}`);
    ok('e a tela diz que a conta saiu sem composição corporal',
       semDadosMudo === 0, `${semDadosMudo} — ${amSem.mudo}`);
  }

  // O caso literal do achado N3.
  {
    const basal = tmb(120, 178, 38, 'masculino');
    const r = calcular({
      tdee: tdee(basal, 'moderado'), basal, pesoKg: 120, objetivo: 'emagrecimento',
      gorduraPct: 40, estimar: { alturaCm: 178, idade: 38, genero: 'masculino' }, genero: 'masculino',
    });
    const p = r?.meta?.proteina_g ?? 0;
    ok('120 kg com 40% de gordura em "perder gordura" não recebe 264 g de proteína',
       p > 0 && p < 200, `${p} g (massa magra 72 kg)`);
  }

  // ── Os três corpos da revisora, com a inversão nomeada (N11) ───────────
  //
  // A tabela que a revisão de nutrição levantou contra `c241562`. Fora da
  // grade porque são os números que ela leu na tela, com nome e sobrenome —
  // e porque um deles é o do Leonardo.
  {
    const proteinaDe = (pesoKg, gorduraPct, objetivo, alturaCm, idadeAnos, genero) => {
      const basal = tmb(pesoKg, alturaCm, idadeAnos, genero);
      const r = calcular({
        tdee: tdee(basal, 'moderado'), basal, pesoKg, objetivo, gorduraPct,
        estimar: { alturaCm, idade: idadeAnos, genero }, genero,
      });
      return r?.meta?.proteina_g ?? 0;
    };
    for (const [rot, pesoKg, gorduraPct, alturaCm, idadeAnos, genero] of [
      ['120 kg / 40%', 120, 40, 178, 38, 'masculino'],
      ['88 kg / 27,2% (Leonardo)', 88, 27.2, 178, 38, 'masculino'],
      ['62 kg / 12%', 62, 12, 172, 30, 'masculino'],
    ]) {
      const d = proteinaDe(pesoKg, gorduraPct, 'emagrecimento', alturaCm, idadeAnos, genero);
      const s = proteinaDe(pesoKg, gorduraPct, 'hipertrofia', alturaCm, idadeAnos, genero);
      const mm = pesoKg * (1 - gorduraPct / 100);
      ok(`${rot}: "ganhar massa" não recebe mais proteína que "perder gordura"`,
         s <= d + 1,
         `déficit ${d} g (${(d / mm).toFixed(2)} g/kg MM) × superávit ${s} g (${(s / mm).toFixed(2)} g/kg MM)`);
    }
  }
}

// ── 34. A medição ENVELHECE em vez de expirar — TMB e gordura (N15, N18) ───
//
// UNIDADE: **dia de dieta**, de novo — mas a pergunta é outra: com que número o
// dia é calculado, e o que acontece com esse número conforme o corpo anda.
//
// ── O que a Fase 5 fez, e por que meia solução é pior que nenhuma ─────────
//
// N6 pôs validade no TMB da bioimpedância (desvio de peso > 3%, idade > 8
// semanas) e deixou o **`gordura_pct` da mesma linha** valer para sempre. É a
// mesma medição, do mesmo dia, do mesmo aparelho, com duas políticas
// contraditórias dentro do mesmo `resumo()` — e é o `gordura_pct` que decide a
// proteína, ou seja a política que ficou de fora é a que mais pesa.
//
// Pior: misturar o peso de HOJE com a gordura de três meses atrás assume que
// todo peso ganho ou perdido teve a composição da medição antiga. E
// `massaMagraDe` devolve `estimada: false` nesse caso — palpite impresso com a
// etiqueta de medição.
//
// ── E a expiração é desproporcional (N18) ────────────────────────────────
//
// Os gatilhos são defensáveis como números e a política é grosseira. O
// Leonardo cai pelos dois (4,39% de desvio e 92 dias) e o que a expiração
// troca são **35 kcal**, num caso em que a fórmula acertou com 2 kcal de
// diferença — e ele veria um card laranja de alerta por isso. Além disso o
// dano que N6 descreve (TMB velho superestimando o gasto) só existe quando o
// peso CAI; ele subiu, que é o lado seguro, e a regra trata os dois sentidos
// igual.
//
// ── A política, uma só para os dois ──────────────────────────────────────
//
// Envelhecimento, não expiração: guardar `offset = medido − estimado(peso da
// medição)` e usar `estimativa(peso de hoje) + offset`, com o offset decaindo
// a zero ao longo de ~16 semanas. Acompanha o peso sozinho, não descarta nada,
// não precisa de card de alerta, e preserva a informação individual em vez de
// jogá-la fora. Nada armazenado além do que `body_metrics` já tem.
console.log('\n34. A medição envelhece em vez de expirar (N15, N18)');
{
  ok('existe UMA regra de envelhecimento, e ela é uma função', typeof META.envelhecer === 'function',
     typeof META.envelhecer);
  ok('existe a vigência do TMB', typeof META.tmbVigente === 'function', typeof META.tmbVigente);
  ok('e existe a vigência da GORDURA, que é quem decide a proteína',
     typeof META.gorduraVigente === 'function',
     typeof META.gorduraVigente === 'function' ? 'gorduraVigente' : 'a gordura da bioimpedância vale para sempre');

  const envelhecer = META.envelhecer ?? ((_o, dias) => (dias === null ? 1 : dias === 0 ? 1 : 0));
  ok('o offset nasce inteiro e chega a zero em 16 semanas',
     Math.abs(envelhecer(1, 0) - 1) < 0.001 && Math.abs(envelhecer(1, 112)) < 0.001 &&
       Math.abs(envelhecer(1, 56) - 0.5) < 0.02,
     `dia 0 = ${envelhecer(1, 0).toFixed(3)}, dia 56 = ${envelhecer(1, 56).toFixed(3)}, dia 112 = ${envelhecer(1, 112).toFixed(3)}`);

  // Mifflin-St Jeor com os dados do Leonardo — a mesma função que o app usa.
  const ALT = 178, IDADE = 38, GEN = 'masculino';
  const mifflin = (pesoKg) => tmb(pesoKg, ALT, IDADE, GEN);
  const vigente =
    META.tmbVigente ??
    // Fallback = a regra de HOJE (expiração dura), para o gate poder rodar
    // contra `bfb4e91` e falhar por asserção em vez de morrer no link.
    ((e) => ({ valor: e.medidoKcal ?? e.estimado, medido: e.medidoKcal != null, motivo: null }));

  const cenario = (extra) => {
    const pesoNaMedicao = extra.pesoNaMedicao ?? 88;
    const pesoAtual = extra.pesoAtual ?? 88;
    return vigente({
      medidoKcal: 1980,
      medidoEm: '2026-06-01',
      pesoNaMedicao,
      pesoAtual,
      estimadoNaMedicao: mifflin(pesoNaMedicao),
      estimado: mifflin(pesoAtual),
      hojeIso: '2026-06-01',
      ...extra,
    });
  };

  const hoje = cenario({});
  ok('medição de hoje, peso de hoje: o número é o medido, sem ajuste',
     Math.abs(hoje.valor - 1980) <= 1, `${hoje.valor} (esperado 1980)`);

  // ── O que a expiração jogava fora: a informação individual ─────────────
  //
  // A bioimpedância disse que este corpo gasta 172 kcal a mais do que a
  // fórmula prevê para ele. Esse offset é a única coisa que a medição
  // acrescenta — e ela continua valendo quando o peso muda, só que aplicada
  // sobre a estimativa do peso NOVO. Descartar tudo porque o peso mudou 3% é
  // jogar fora o que a medição tinha de próprio junto com o que ela tinha de
  // velho.
  const offsetReal = 1980 - mifflin(88);
  const magrou = cenario({ pesoAtual: 82, hojeIso: '2026-06-15' });
  const esperadoMagrou = mifflin(82) + offsetReal * envelhecer(1, 14);
  ok('peso 6,8% abaixo: o número acompanha o peso novo em vez de ser descartado',
     Math.abs(magrou.valor - esperadoMagrou) <= 2,
     `${magrou.valor} (esperado ${Math.round(esperadoMagrou)}; a estimativa pura daria ${Math.round(mifflin(82))})`);
  ok('e ele fica ENTRE a estimativa pura e a medição crua',
     magrou.valor > mifflin(82) && magrou.valor < 1980,
     `${Math.round(mifflin(82))} < ${magrou.valor} < 1980`);

  // ── Sem degrau: é isto que separa envelhecer de expirar ────────────────
  //
  // A régua que a expiração não passa. Dois dias consecutivos em torno do
  // antigo corte de 8 semanas trocavam 134 kcal de uma vez — um número que
  // muda sozinho, de uma quinta para uma sexta, sem nada ter acontecido com o
  // corpo. É o defeito que a própria Fase 5 nomeou ("um número que muda
  // sozinho e não se explica é pior que o número velho") aplicado à regra que
  // ela escreveu para consertá-lo.
  const emDias = (d) => {
    const base = Date.parse('2026-06-01') + d * 86_400_000;
    return cenario({ hojeIso: new Date(base).toISOString().slice(0, 10) });
  };
  let maiorDegrau = 0, ondeDegrau = '';
  for (let d = 1; d <= 130; d++) {
    const salto = Math.abs(emDias(d).valor - emDias(d - 1).valor);
    if (salto > maiorDegrau) { maiorDegrau = salto; ondeDegrau = `dia ${d - 1} → ${d}`; }
  }
  ok('o número nunca dá um degrau: de um dia para o outro muda no máximo 4 kcal',
     maiorDegrau <= 4, `maior salto ${Math.round(maiorDegrau)} kcal (${ondeDegrau})`);

  // Depois de 16 semanas o offset acabou e o que resta é a fórmula pura — sem
  // aviso, porque nada de estranho aconteceu: a medição envelheceu.
  const antiga = cenario({ hojeIso: '2026-10-01' }); // 122 dias
  ok('depois de 16 semanas sobra a estimativa pura',
     Math.abs(antiga.valor - mifflin(88)) <= 1, `${antiga.valor} (fórmula: ${Math.round(mifflin(88))})`);

  // ── O caso do Leonardo, que caía pelos DOIS gatilhos (N18) ─────────────
  const leo = cenario({ pesoAtual: 91.86, hojeIso: '2026-09-01' }); // 92 dias, +4,39%
  ok('92 dias e 4,39% de desvio não viram card laranja de alerta',
     !leo.motivo && leo.origem === 'ajustado',
     `motivo: ${leo.motivo ?? 'nenhum'} · origem: ${leo.origem} — a medição envelheceu, não expirou`);
  ok('e o que a expiração trocaria é pequeno demais para virar alerta',
     Math.abs(leo.valor - mifflin(91.86)) < 60,
     `${leo.valor} contra ${Math.round(mifflin(91.86))} da fórmula pura — ${Math.round(Math.abs(leo.valor - mifflin(91.86)))} kcal de diferença`);

  const semMedida = vigente({
    medidoKcal: null, medidoEm: null, pesoNaMedicao: null, estimadoNaMedicao: null,
    pesoAtual: 88, estimado: mifflin(88), hojeIso: '2026-06-15',
  });
  ok('sem bioimpedância nenhuma, usa a estimativa sem inventar motivo',
     semMedida.medido === false && Math.abs(semMedida.valor - mifflin(88)) <= 1 && !semMedida.motivo,
     `${semMedida.valor} / ${semMedida.motivo ?? 'sem motivo'}`);

  // ── N15: a GORDURA da mesma linha, pela MESMA política ─────────────────
  {
    const gv = META.gorduraVigente;
    const estimar = { alturaCm: ALT, idade: IDADE, genero: GEN };
    const chamar = (extra) =>
      typeof gv === 'function'
        ? gv({
            medidoPct: 27.2, medidoEm: '2026-06-01', pesoNaMedicao: 88,
            pesoAtual: 88, hojeIso: '2026-06-01', estimar, ...extra,
          })
        : // Fallback = a regra de hoje: o percentual vale para sempre, cru.
          { pct: 27.2, origem: 'bioimpedancia', diasDesde: null };

    const g0 = chamar({});
    ok('gordura medida hoje vale como medida',
       Math.abs((g0?.pct ?? 0) - 27.2) < 0.05 && g0?.origem === 'bioimpedancia',
       `${g0?.pct}% (${g0?.origem})`);

    // A mesma medição, 92 dias depois e com 3,86 kg a mais. A gordura NÃO
    // pode ser a mesma: assumir que todo o peso ganho tem a composição da
    // medição antiga é a suposição que ninguém escreveu e o app faz.
    const g1 = chamar({ pesoAtual: 91.86, hojeIso: '2026-09-01' });
    ok('gordura de 3 meses atrás com 3,9 kg a mais não continua valendo crua',
       Math.abs((g1?.pct ?? 27.2) - 27.2) > 0.15,
       `${g1?.pct?.toFixed?.(1) ?? g1?.pct}% contra os 27,2% do dia da medição`);
    ok('e ela deixa de se apresentar como medição',
       g1?.origem !== 'bioimpedancia', `origem = ${g1?.origem}`);
    ok('e ela também não dá degrau — é a mesma política do TMB',
       typeof META.gorduraVigente === 'function' &&
         typeof META.envelhecer === 'function' &&
         /envelhecer\(/.test(readFileSync(new URL('../src/features/perfil/meta.ts', import.meta.url), 'utf8')),
       'as duas vigências saem da mesma função de envelhecimento');

    // E a massa magra precisa saber. `estimada: false` para um número que é
    // metade medição e metade fórmula é o palpite com etiqueta de medição.
    const mm = RECOMP.massaMagraDe?.(91.86, g1?.pct ?? 27.2, estimar, g1?.origem);
    ok('a massa magra declara quando o percentual foi ajustado, não medido',
       mm && mm.origem !== undefined && mm.origem !== 'bioimpedancia',
       mm ? `origem = ${mm.origem}` : 'massaMagraDe não conhece origem');
  }

  // ── Uma política só, e ela chega às duas pontas do `resumo()` ──────────
  const FONTE_API = readFileSync(new URL('../src/features/perfil/api.ts', import.meta.url), 'utf8');
  ok('o resumo aplica a vigência à gordura, não só ao TMB',
     /gorduraVigente/.test(FONTE_API),
     /gorduraVigente/.test(FONTE_API) ? 'ligada' : 'bio?.gordura_pct entra cru no cálculo da proteína');

  // ── E o texto para de dizer que a balança mede metabolismo ─────────────
  //
  // Ela não mede. Estima a massa livre de gordura por impedância e joga numa
  // equação interna — é fórmula substituindo fórmula, não medição
  // substituindo estimativa. Karagun & Baklaci 2024 (Medicine 103(35):e39542,
  // https://pmc.ncbi.nlm.nih.gov/articles/PMC11365691/, aberto e conferido):
  // a BIA superestima em ~185 kcal contra calorimetria indireta e só 36,1%
  // dos casos caem dentro de ±10%. Vender isso como "o seu TMB real" é o
  // motivo de a Fase 5 ter dado à balança poder de veto sobre a fórmula.
  const FONTE_AJUDAS = readFileSync(new URL('../src/shared/ajudas.ts', import.meta.url), 'utf8');
  ok('o app não diz mais que a bioimpedância MEDE o metabolismo',
     !/ela mede o seu TMB real/i.test(FONTE_AJUDAS),
     /ela mede o seu TMB real/i.test(FONTE_AJUDAS) ? 'ajudas.ts ainda promete medição' : 'corrigido');
  ok('e diz que ela estima por equação, com a ordem de grandeza do erro',
     /equação|equacao/i.test(FONTE_AJUDAS) && /impedância|impedancia/i.test(FONTE_AJUDAS) &&
       /185|36,1|36\.1/.test(FONTE_AJUDAS),
     'o texto precisa dizer que é estimativa, por impedância, e quanto erra');

  // A tela de perfil continua dizendo de onde o número vem — o que mudou é
  // que agora existe um terceiro estado, "ajustado", e ele não é alerta.
  const FONTE_PERFIL = readFileSync(new URL('../app/(tabs)/perfil.tsx', import.meta.url), 'utf8');
  ok('a tela de perfil distingue medido, ajustado e estimado',
     /ajustad/i.test(FONTE_PERFIL),
     /ajustad/i.test(FONTE_PERFIL) ? 'exibe' : 'só medido × estimado, e o ajustado passa por medido');
}
// ── 35. O teclado nativo não cobre o campo do Sheet (U8) ───────────────────
//
// UNIDADE: a TELA — o mesmo da seção 27. `Sheet` é `Modal` + posição absoluta
// no bottom, sem reação nenhuma ao teclado: o sheet "Nota de setup" (altura
// 0,62, Input multiline) abre o teclado do iOS, que cobre a metade inferior —
// onde estão o campo e o "Salvar". Anotar "banco no furo 3" no meio do treino
// vira digitar às cegas, e no standalone é pior que no Safari.
console.log('\n35. Sheet com Input reage ao teclado (U8)');
{
  const HOOK = '../src/shared/hooks/useTeclado.ts';
  const temHook = existsSync(new URL(HOOK, import.meta.url));
  ok('existe um hook de altura do teclado', temHook, temHook ? 'sim' : 'não existe');
  const fonteHook = temHook ? readFileSync(new URL(HOOK, import.meta.url), 'utf8') : '';
  // No PWA (que é como o app roda no iPhone) o `Keyboard` do react-native-web
  // não emite nada: quem sabe a altura é `visualViewport`. Um hook que só
  // ouvisse `Keyboard` seria correto no simulador e inerte no aparelho real —
  // o mesmo modo de falhar do `hitSlop` na Fase 4.
  ok('e ele usa visualViewport (no PWA o Keyboard do RN-web não emite)',
     /visualViewport/.test(fonteHook), /visualViewport/.test(fonteHook) ? 'usa' : 'só ouviria Keyboard');
  ok('e também o Keyboard nativo, para o app compilado',
     /Keyboard/.test(fonteHook), /Keyboard/.test(fonteHook) ? 'usa' : 'só web');

  ok('o Sheet consome a altura do teclado', /useTeclado|alturaTeclado/.test(FONTE_SHEET),
     /useTeclado|alturaTeclado/.test(FONTE_SHEET) ? 'ligado' : 'Sheet não reage ao teclado');
  ok('e encolhe a altura máxima quando o teclado está aberto',
     /maxHeight[\s\S]{0,160}teclado/.test(FONTE_SHEET),
     /maxHeight[\s\S]{0,160}teclado/.test(FONTE_SHEET) ? 'encolhe' : 'maxHeight ignora o teclado');
  ok('e o conteúdo pode rolar (sem isso, encolher só corta o botão Salvar)',
     /rolavel/.test(FONTE_SHEET), /rolavel/.test(FONTE_SHEET) ? 'tem modo rolável' : 'children renderizados crus');

  // Os sheets que a auditoria cita, um a um: nota de setup (executor), ajustar
  // meta e editar perfil, registrar medidas, registrar alimento.
  const ROLAVEIS = [
    ['app/sessao/[id].tsx', 'nota de setup'],
    ['app/(tabs)/perfil.tsx', 'ajustar meta / editar perfil'],
    ['app/(tabs)/evolucao.tsx', 'registrar medidas'],
    ['app/(tabs)/dieta.tsx', 'registrar alimento'],
  ];
  for (const [caminho, rotulo] of ROLAVEIS) {
    const src = readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');
    ok(`${rotulo}: o sheet com Input é rolável`, /rolavel/.test(src),
       /rolavel/.test(src) ? 'marcado' : 'o campo continua atrás do teclado');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// G3 — Treinador que explica e varia (B7, B8, execução, objetivo)
//
// DUAS UNIDADES NOVAS, e as duas foram nomeadas pelas fases anteriores como o
// buraco de cobertura que sobrava:
//
//   · **bloco** — as 8 semanas em que a âncora não muda. G2.1 registrou o bloco
//     como a unidade mais fina; a correção do cross-review fechou o que
//     acontece DENTRO dele (semana que conta, deload que chega, modulação).
//   · **transição entre blocos** — o que muda de exercício quando o bloco
//     recomeça. É o nível 1 de B8, e hoje NADA mede: o gerador é determinístico
//     e, com o mesmo perfil, o bloco 2 é byte a byte igual ao bloco 1. Ou seja,
//     a variação entre ciclos não existe e nenhum teste percebe.
//
// Módulos novos por import DINÂMICO (mesmo motivo das seções 23 e 30): ausente
// vale objeto vazio e a asserção FALHA, em vez de o processo morrer no link
// antes da primeira asserção.
// ═══════════════════════════════════════════════════════════════════════════

const EXEC = await carregarModulo('../src/features/treino/execucao.ts');
const TEC = await carregarModulo('../src/features/treino/tecnicas.ts');
const PORQUE = await carregarModulo('../src/features/treino/porque.ts');
const VARIACAO = await carregarModulo('../src/features/treino/variacao.ts');

const FONTE_DURACAO = readFileSync(
  new URL('../src/features/treino/duracao.ts', import.meta.url),
  'utf8'
);
const FONTE_TELA_EX = readFileSync(
  new URL('../app/exercicio/[id].tsx', import.meta.url),
  'utf8'
);
const FONTE_DIA = readFileSync(new URL('../app/dia/[id].tsx', import.meta.url), 'utf8');
const FONTE_API = readFileSync(
  new URL('../src/features/treino/api.ts', import.meta.url),
  'utf8'
);

// ── 36. Execução: a camada de TEMPO, e ela é cadência (não intensidade) ─────
//
// UNIDADE: **exercício** — os 124 do catálogo, um a um.
//
// O catálogo tem `instrucoes` (o que fazer) e `dica` (uma frase solta). O que
// não existe em lugar nenhum é o TEMPO: quanto dura a descida, se há pausa
// embaixo, qual amplitude. E a armadilha está escrita na auditoria: negativa
// lenta é CADÊNCIA, não técnica de intensidade — Krzysztofik 2019 mede
// hipertrofia semelhante de 0,5 a 8 s, com ~2 s sendo o mais eficiente em
// tempo. Um app que vender "desça em 5 segundos para crescer mais" está
// mentindo com a fonte na mão.
//
// A segunda metade é sobre não criar DUAS definições do mesmo segundo:
// `duracao.ts` já assume 3 s por repetição (`SEG_POR_REP`) para estimar o
// treino inteiro. Se a cadência prescrita vier de outro lugar, o app passa a
// dizer "desça em 3 s, pause 1" numa tela e a cobrar 3 s por repetição na
// outra — que é exatamente como o crossover virou composto numa função e
// abertura em outra.
console.log('\n36. Execução detalhada: cadência, amplitude e erro comum (G3)');
{
  ok(
    'existe um módulo de EXECUÇÃO com a camada de tempo',
    typeof EXEC.execucaoDe === 'function',
    typeof EXEC.execucaoDe === 'function' ? 'execucaoDe' : 'não existe execucao.ts'
  );

  let semCadencia = 0, semAmplitude = 0, semErro = 0, excentricaFora = 0, concentricaFora = 0;
  let porTempoComCadencia = 0;
  const amostraExec = { cad: '', amp: '', err: '', exc: '', con: '', tempo: '' };
  const textosAmplitude = new Set();
  const textosErro = new Set();

  for (const e of CAT_FORCA) {
    const x =
      typeof EXEC.execucaoDe === 'function'
        ? EXEC.execucaoDe(e.nome, e.grupo_primario, e.equipamento, e.tipo_carga)
        : null;
    if (!x?.cadencia) {
      semCadencia++;
      amostraExec.cad ||= e.nome;
      continue;
    }
    if (!x.amplitude) { semAmplitude++; amostraExec.amp ||= e.nome; }
    else textosAmplitude.add(x.amplitude);
    if (!x.erroComum) { semErro++; amostraExec.err ||= e.nome; }
    else textosErro.add(x.erroComum);

    const { excentrica, concentrica } = x.cadencia;
    // Série por TEMPO (prancha) não tem repetição: cadência por repetição ali
    // é campo preenchido para não ficar vazio.
    if (e.tipo_carga === 'tempo') {
      if (excentrica > 0 || concentrica > 0) {
        porTempoComCadencia++;
        amostraExec.tempo ||= e.nome;
      }
      continue;
    }
    // 1 a 4 s na descida. O teto NÃO é 8: Krzysztofik mostra que 8 s rende o
    // mesmo que 2 e custa o triplo do tempo — prescrever 8 é vender cadência
    // como intensidade, que é o que a auditoria proíbe por escrito.
    if (!(excentrica >= 1 && excentrica <= 4)) {
      excentricaFora++;
      amostraExec.exc ||= `${e.nome} = ${excentrica}s`;
    }
    if (!(concentrica >= 1 && concentrica <= 3)) {
      concentricaFora++;
      amostraExec.con ||= `${e.nome} = ${concentrica}s`;
    }
  }

  ok('todo exercício de força tem cadência', semCadencia === 0, `${semCadencia} sem — ex.: ${amostraExec.cad}`);
  ok('todo exercício tem amplitude escrita', semAmplitude === 0, `${semAmplitude} sem — ex.: ${amostraExec.amp}`);
  ok('todo exercício tem o erro mais comum', semErro === 0, `${semErro} sem — ex.: ${amostraExec.err}`);
  ok('excêntrica entre 1 e 4 s (nunca 8)', excentricaFora === 0, `${excentricaFora} fora — ex.: ${amostraExec.exc}`);
  ok('concêntrica entre 1 e 3 s', concentricaFora === 0, `${concentricaFora} fora — ex.: ${amostraExec.con}`);
  ok('série por TEMPO não recebe cadência por repetição', porTempoComCadencia === 0,
     `${porTempoComCadencia} com — ex.: ${amostraExec.tempo}`);

  // Derivado, não escrito exercício por exercício: a auditoria pede que o
  // objetivo saia de `padraoDe`/`perfilDeResistencia`/`picoDeTensao`. Um texto
  // por exercício seria 124 frases para manter e estaria errado no dia em que
  // alguém acrescentar a 125ª.
  ok('amplitude é DERIVADA (menos textos que exercícios)',
     textosAmplitude.size > 1 && textosAmplitude.size < CAT_FORCA.length / 3,
     `${textosAmplitude.size} textos para ${CAT_FORCA.length} exercícios`);
  ok('erro comum é DERIVADO (menos textos que exercícios)',
     textosErro.size > 1 && textosErro.size < CAT_FORCA.length / 3,
     `${textosErro.size} textos para ${CAT_FORCA.length} exercícios`);

  // ── A frase que não pode existir ────────────────────────────────────────
  const PROIBIDO = [
    /t[ée]cnica de intensidade/i,
    /mais m[úu]sculo/i,
    /mais hipertrofia/i,
    /cresce mais/i,
    /avan[çc]ad/i,
  ];
  let vendeuComoIntensidade = 0;
  let amostraVenda = '';
  for (const e of CAT_FORCA) {
    const x = typeof EXEC.execucaoDe === 'function'
      ? EXEC.execucaoDe(e.nome, e.grupo_primario, e.equipamento, e.tipo_carga)
      : null;
    const texto = [x?.cadenciaTexto, x?.porqueCadencia, x?.amplitude, x?.erroComum]
      .filter(Boolean)
      .join(' ');
    if (PROIBIDO.some((r) => r.test(texto))) {
      vendeuComoIntensidade++;
      amostraVenda ||= `${e.nome}: ${texto.slice(0, 90)}`;
    }
  }
  ok('nenhum texto vende cadência como técnica de intensidade',
     vendeuComoIntensidade === 0, `${vendeuComoIntensidade} — ex.: ${amostraVenda}`);

  // E o contrário precisa estar dito: mais devagar NÃO é melhor.
  const porque = typeof EXEC.PORQUE_CADENCIA === 'string' ? EXEC.PORQUE_CADENCIA : '';
  ok('o app DIZ que mais devagar não rende mais',
     /0,5|meio segundo/.test(porque) && /8\s?s|oito segundo/.test(porque),
     porque ? porque.slice(0, 80) : 'não existe PORQUE_CADENCIA');

  // ── Um segundo só, não dois ─────────────────────────────────────────────
  //
  // `duracao.ts` cravava `SEG_POR_REP = 3`. Com a cadência nascendo em outro
  // arquivo, ou os dois números vêm da mesma fonte, ou o app estima o treino
  // com uma cadência e prescreve outra.
  ok('a duração consome a cadência, em vez de cravar os 3 s',
     /execucao/.test(FONTE_DURACAO) && !/const SEG_POR_REP = 3/.test(FONTE_DURACAO),
     /const SEG_POR_REP = 3/.test(FONTE_DURACAO) ? 'duracao.ts ainda crava 3' : 'derivado');
  if (typeof EXEC.tempoPorRepSeg === 'function' && typeof EXEC.execucaoDe === 'function') {
    const x = EXEC.execucaoDe('Supino reto com barra', 'peito', 'barra', 'peso_reps');
    ok('a cadência canônica continua valendo 3 s por repetição',
       EXEC.tempoPorRepSeg(x.cadencia) === 3, `${EXEC.tempoPorRepSeg(x.cadencia)}s`);
  } else {
    ok('a cadência canônica continua valendo 3 s por repetição', false, 'sem tempoPorRepSeg');
  }

  // A tela precisa mostrar. Camada de tempo que existe só no módulo é a mesma
  // `definirMetaCalorica` da fase 5: função certa sem chamador.
  ok('a tela do exercício mostra a cadência',
     /cadencia|cadência|execucaoDe/i.test(FONTE_TELA_EX),
     /execucaoDe/.test(FONTE_TELA_EX) ? 'ligada' : 'a tela não conhece a camada de tempo');
  ok('o executor mostra a cadência na hora de fazer a série',
     /execucaoDe|cadenciaTexto/.test(FONTE_SESSAO),
     /execucaoDe|cadenciaTexto/.test(FONTE_SESSAO) ? 'ligado' : 'só no detalhe do exercício');
}

// ── 37. Técnicas de intensidade por papel e fase (B7) ──────────────────────
//
// UNIDADE: **exercício × fase** — o mesmo tríceps na polia recebe drop set no
// acúmulo e NÃO recebe nada na readaptação, e é essa combinação que decide.
//
// B7 é a seção da auditoria com mais chance de virar exatamente o que ela
// proíbe. Três ressalvas do relatório precisam sobreviver à implementação, e
// nenhuma delas é opinião:
//
//   · **Myo-reps não tem nenhuma fonte aberta.** Prescrever como se tivesse é
//     repetir o achado de "pesquisa de IA cita fonte inventada".
//   · **Pré-exaustão é contraindicada** — Krzysztofik 2019: reduz o volume
//     total no multiarticular seguinte SEM vantagem de hipertrofia.
//   · **Drop set não rende mais músculo.** Sødal 2023: sem diferença vs séries
//     tradicionais (p = 0,392). O que ele entrega é TEMPO.
console.log('\n37. Técnicas de intensidade por papel e fase (B7)');
{
  ok(
    'existe um módulo de técnicas com a regra por papel e fase',
    typeof TEC.tecnicasDaSessao === 'function',
    typeof TEC.tecnicasDaSessao === 'function' ? 'tecnicasDaSessao' : 'não existe tecnicas.ts'
  );

  const FASES = ['readaptacao', 'acumulo', 'intensificacao', 'deload'];
  const PERFIS_TEC = [
    { ...base, focos: ['peito'], preferenciaEquipamento: 'maquina', minutosPorDia: Array(7).fill(90) },
    { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['inferior'] },
    { ...base, dias: 3, diasDisponiveis: [1, 3, 5], local: 'casa_equipada', focos: [] },
    { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], focos: ['superior'], experiencia: 'avancado' },
    { ...base, dias: 2, diasDisponiveis: [2, 5], minutosPorDia: Array(7).fill(45) },
  ];

  let noPapelErrado = 0, demaisNaSessao = 0, naVolta = 0, foraDaUltima = 0, semEvidencia = 0;
  const amostraTec = { papel: '', demais: '', volta: '', serie: '', evid: '' };
  let totalPrescritas = 0;
  const porPapelContagem = {};

  for (const p of PERFIS_TEC) {
    const plano = await montarPlano(p, fonte);
    const rot = `${p.dias}d/${p.local}/foco=${p.focos.join('+') || 'nenhum'}`;
    for (const d of plano.dias) {
      const forca = d.exercicios.filter((e) => e.grupo !== 'cardio');
      for (const fase of FASES) {
        const mapa =
          typeof TEC.tecnicasDaSessao === 'function' ? TEC.tecnicasDaSessao(forca, fase) : new Map();
        const aplicadas = [...(mapa instanceof Map ? mapa.entries() : [])];
        if (fase === 'acumulo' || fase === 'intensificacao') totalPrescritas += aplicadas.length;

        // 4. Zero durante readaptação e deload.
        if ((fase === 'readaptacao' || fase === 'deload') && aplicadas.length) {
          naVolta++;
          amostraTec.volta ||= `${rot} | ${d.nome} | ${fase} | ${aplicadas.length} técnica(s)`;
        }
        // 3. Máximo 2 por sessão.
        if (aplicadas.length > 2) {
          demaisNaSessao++;
          amostraTec.demais ||= `${rot} | ${d.nome} | ${fase} | ${aplicadas.length}`;
        }
        for (const [ex, t] of aplicadas) {
          porPapelContagem[ex.papel] = (porPapelContagem[ex.papel] ?? 0) + 1;
          // 1. Só em isolador ou finalizador.
          if (ex.papel !== 'isolador' && ex.papel !== 'finalizador') {
            noPapelErrado++;
            amostraTec.papel ||= `${rot} | ${d.nome} | ${ex.nome} é ${ex.papel}`;
          }
          // 2. Só na última série.
          if (t?.serie !== 'ultima') {
            foraDaUltima++;
            amostraTec.serie ||= `${rot} | ${d.nome} | ${ex.nome} | serie=${t?.serie}`;
          }
          // Toda técnica prescrita declara o nível de evidência dela.
          if (!t?.evidencia) {
            semEvidencia++;
            amostraTec.evid ||= `${rot} | ${ex.nome} | ${t?.nome ?? '?'}`;
          }
        }
      }
    }
  }

  ok('técnica só em isolador ou finalizador', noPapelErrado === 0, `${noPapelErrado} — ex.: ${amostraTec.papel}`);
  ok('no máximo 2 aplicações por sessão', demaisNaSessao === 0, `${demaisNaSessao} — ex.: ${amostraTec.demais}`);
  ok('zero técnicas na readaptação e no deload', naVolta === 0, `${naVolta} — ex.: ${amostraTec.volta}`);
  ok('sempre na ÚLTIMA série do exercício', foraDaUltima === 0, `${foraDaUltima} — ex.: ${amostraTec.serie}`);
  ok('toda técnica prescrita declara a evidência', semEvidencia === 0, `${semEvidencia} — ex.: ${amostraTec.evid}`);
  // A regra não pode ser cumprida por nunca prescrever nada: isso é o inverso
  // do achado M3 de G2.1 (invariante inatingível que escondia 112 defeitos).
  ok('e alguma técnica de fato é prescrita fora da volta', totalPrescritas > 0,
     `${totalPrescritas} aplicações no acúmulo/intensificação, por papel: ${JSON.stringify(porPapelContagem)}`);

  // ── As três ressalvas do relatório, uma asserção cada ────────────────────
  const CAT = Array.isArray(TEC.TECNICAS) ? TEC.TECNICAS : [];
  const acharTec = (id) => CAT.find((t) => t.id === id);

  const myo = acharTec('myo_reps');
  ok('myo-reps NUNCA é prescrita automaticamente',
     !myo || myo.prescrever === false,
     myo ? `prescrever=${myo.prescrever}` : 'ausente do catálogo (também vale)');
  ok('e, se aparece, declara que não tem fonte verificada',
     !myo || /sem fonte|nenhuma fonte|n[ãa]o verificad|pr[áa]tica comum/i.test(myo.evidencia ?? ''),
     myo ? (myo.evidencia ?? '').slice(0, 70) : 'ausente');

  const pre = acharTec('pre_exaustao');
  ok('pré-exaustão é declarada CONTRAINDICADA (não é opção)',
     !!pre && pre.contraindicada === true && pre.prescrever === false,
     pre ? `contraindicada=${pre.contraindicada} prescrever=${pre.prescrever}` : 'não está no catálogo — a contraindicação some junto');
  ok('e a contraindicação vem com o motivo medido',
     !!pre && /volume total|volume no multi|sem vantagem/i.test(pre.evidencia ?? ''),
     pre ? (pre.evidencia ?? '').slice(0, 70) : 'ausente');

  const drop = acharTec('drop_set');
  const textoDrop = drop ? `${drop.oQueGanha ?? ''} ${drop.evidencia ?? ''}` : '';
  ok('drop set: o ganho declarado é TEMPO, não hipertrofia',
     !!drop && /tempo/i.test(textoDrop) && !/mais m[úu]sculo|mais hipertrofia|rende mais/i.test(drop.oQueGanha ?? ''),
     textoDrop.slice(0, 90) || 'drop set não está no catálogo');
  ok('e o p = 0,392 de Sødal está escrito, não subentendido',
     /0,392|0\.392/.test(textoDrop), textoDrop ? 'sem o número' : 'ausente');

  // Negativa lenta NÃO pode estar no catálogo de técnicas: ela é cadência, e
  // isso está na seção 36. Duas casas para a mesma ideia é como o app começa a
  // mentir para si mesmo.
  ok('negativa lenta NÃO está entre as técnicas de intensidade',
     !CAT.some((t) => /negativa|exc[êe]ntrico lento|cad[êe]ncia/i.test(`${t.id} ${t.nome}`)),
     CAT.map((t) => t.id).join(', ') || 'catálogo vazio');

  // E a tela precisa mostrar — e mostrar na última série, que é onde a regra vive.
  ok('o executor conhece a técnica da última série',
     /tecnicasDaSessao|tecnicaDa/i.test(FONTE_SESSAO),
     /tecnicasDaSessao/.test(FONTE_SESSAO) ? 'ligado' : 'a regra existe e ninguém chama');
}

// ── 38. "Por que este exercício está aqui", específico e derivado ──────────
//
// UNIDADE: **exercício × sessão** — a resposta muda com o que MAIS está no dia.
//
// O papel já responde a parte estrutural ("Isolador · abre o grupo"), e isso
// está no ar desde G2. O que falta é o objetivo específico: o que AQUELE
// exercício acrescenta que os outros do dia não acrescentam. Se a frase for a
// mesma para os dois isoladores de peito da sessão, ela não respondeu a
// pergunta — só repetiu o rótulo com outras palavras.
console.log('\n38. O objetivo específico de cada exercício na sessão (G3)');
{
  ok(
    'existe uma função que responde "o que este acrescenta"',
    typeof PORQUE.porqueEsteExercicio === 'function',
    typeof PORQUE.porqueEsteExercicio === 'function' ? 'porqueEsteExercicio' : 'não existe porque.ts'
  );

  const PERFIS_PQ = [
    { ...base, focos: ['peito'], preferenciaEquipamento: 'maquina', minutosPorDia: Array(7).fill(90) },
    { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['inferior'] },
    { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], focos: ['superior'] },
    { ...base, dias: 3, diasDisponiveis: [1, 3, 5], local: 'casa_equipada' },
  ];

  let semObjetivo = 0, repetidoNoGrupo = 0, ecoDoPapel = 0;
  const amostraPq = { sem: '', rep: '', eco: '' };
  const todosOsTextos = new Set();

  for (const p of PERFIS_PQ) {
    const plano = await montarPlano(p, fonte);
    const rot = `${p.dias}d/${p.local}/foco=${p.focos.join('+') || 'nenhum'}`;
    for (const d of plano.dias) {
      const forca = d.exercicios.filter((e) => e.grupo !== 'cardio');
      const porGrupo = {};
      for (const e of forca) {
        const texto =
          typeof PORQUE.porqueEsteExercicio === 'function'
            ? PORQUE.porqueEsteExercicio(e, forca)
            : '';
        if (!texto) {
          semObjetivo++;
          amostraPq.sem ||= `${rot} | ${d.nome} | ${e.nome}`;
          continue;
        }
        todosOsTextos.add(texto);
        // O objetivo não pode ser o rótulo do papel repetido: se `PORQUE_PAPEL`
        // já dizia isso, a camada nova não acrescentou nada.
        const doPapel = (PORQUE.PORQUE_PAPEL ?? PAPEL_NS.PORQUE_PAPEL ?? {})[e.papel] ?? '';
        if (doPapel && texto.trim() === doPapel.trim()) {
          ecoDoPapel++;
          amostraPq.eco ||= `${rot} | ${e.nome}`;
        }
        (porGrupo[e.grupo] ??= []).push({ nome: e.nome, texto });
      }
      for (const [g, itens] of Object.entries(porGrupo)) {
        if (itens.length < 2) continue;
        const distintos = new Set(itens.map((x) => x.texto));
        if (distintos.size !== itens.length) {
          repetidoNoGrupo++;
          amostraPq.rep ||= `${rot} | ${d.nome} | ${g}: ${itens.length} exercícios, ${distintos.size} frases`;
        }
      }
    }
  }

  ok('todo exercício de força tem objetivo específico', semObjetivo === 0, `${semObjetivo} — ex.: ${amostraPq.sem}`);
  ok('dois exercícios do mesmo grupo no mesmo dia nunca dizem a mesma coisa',
     repetidoNoGrupo === 0, `${repetidoNoGrupo} — ex.: ${amostraPq.rep}`);
  ok('e o objetivo não é o rótulo do papel repetido', ecoDoPapel === 0, `${ecoDoPapel} — ex.: ${amostraPq.eco}`);

  // Derivado, não digitado: a auditoria manda derivar de `padraoDe`,
  // `perfilDeResistencia` e `picoDeTensao`. Um mapa nome→frase seria 124
  // entradas erradas na primeira vez que alguém acrescentar um exercício.
  const FONTE_PORQUE = existsSync(new URL('../src/features/treino/porque.ts', import.meta.url))
    ? readFileSync(new URL('../src/features/treino/porque.ts', import.meta.url), 'utf8')
    : '';
  const nomesLiterais = CAT_FORCA.filter((e) => FONTE_PORQUE.includes(`'${e.nome}'`)).length;
  ok('o objetivo é DERIVADO de atributos, não um mapa por nome',
     FONTE_PORQUE !== '' && nomesLiterais <= 3 && /padraoDe|perfilDeResistencia|picoDeTensao/.test(FONTE_PORQUE),
     FONTE_PORQUE ? `${nomesLiterais} nomes literais no arquivo` : 'porque.ts não existe');

  // Uma casa só para "por que": `PORQUE_PAPEL` não pode viver nos dois lugares.
  const FONTE_PAPEL = readFileSync(
    new URL('../src/features/treino/papel.ts', import.meta.url),
    'utf8'
  );
  const casas =
    (/export const PORQUE_PAPEL/.test(FONTE_PAPEL) ? 1 : 0) +
    (/export const PORQUE_PAPEL/.test(FONTE_PORQUE) ? 1 : 0);
  ok('"por que" tem UMA casa, não duas', casas === 1, `${casas} definições de PORQUE_PAPEL`);

  ok('a tela do dia mostra o objetivo específico',
     /porqueEsteExercicio/.test(FONTE_DIA),
     /porqueEsteExercicio/.test(FONTE_DIA) ? 'ligada' : 'a tela só mostra o rótulo do papel');
}

// ── 39. B8 níveis 0 e 2: a âncora fixa e o rodízio DENTRO do padrão ────────
//
// UNIDADE: **bloco** — as 8 semanas em que a âncora não muda. Um plano gerado
// é um bloco; tudo abaixo mede o bloco inteiro, não a sessão.
//
// O nível 0 já existe e a asserção aqui é para ele NÃO se perder: âncora na
// posição 1 do bloco do grupo, mesma faixa de repetições, o bloco inteiro.
//
// O nível 2 é o candidato 14 do roadmap, medido no print do celular: peito
// repete os mesmos três exercícios nos dias A e D. O `rodar()` funciona no
// nível dos candidatos, mas com preferência "máquina" o melhor de cada padrão
// é o mesmo nos dois dias e o teto por padrão fecha a porta para o resto. O
// critério de aceite registrado é claro: **o segundo dia do mesmo grupo troca
// o PERFIL DE RESISTÊNCIA (máquina → cabo/halter) mantendo o padrão.**
console.log('\n39. B8 níveis 0 e 2: âncora fixa no bloco, rodízio dentro do padrão');
{
  const PERFIS_B8 = [
    { ...base, focos: ['peito'], preferenciaEquipamento: 'maquina', minutosPorDia: Array(7).fill(90) },
    { ...base, focos: ['peito'], preferenciaEquipamento: 'maquina', minutosPorDia: Array(7).fill(90), experiencia: 'iniciante', objetivo: 'recomposicao' },
    { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['inferior'], preferenciaEquipamento: 'maquina' },
    { ...base, dias: 6, diasDisponiveis: [1, 2, 3, 4, 5, 6], focos: ['superior'] },
    { ...base, dias: 4, focos: ['costas'], preferenciaEquipamento: 'livre', minutosPorDia: Array(7).fill(90) },
    // ── O perfil que mostra o defeito de nível 0 que existe HOJE ────────────
    //
    // Em casa com halteres, 3 dias: o peito abre o dia A com `Supino inclinado
    // com halteres` (principal) e abre o dia B com `Supino reto com halteres`
    // (principal). Dois exercícios diferentes alimentando o MESMO gráfico
    // dentro do MESMO bloco — a definição literal do que B8 nível 0 proíbe.
    // A causa é a de sempre: o corte por tempo tira o primeiro da lista num dos
    // dias e quem sobra vira principal, sem ninguém reavaliar o bloco.
    { ...base, dias: 3, diasDisponiveis: [1, 3, 5], local: 'casa_equipada' },
  ];

  let ancoraFora = 0, ancoraFaixa = 0;
  const amostraB8 = { fora: '', faixa: '' };
  let paresMedidos = 0;

  for (const p of PERFIS_B8) {
    const plano = await montarPlano(p, fonte);
    const rot = `${p.dias}d/${p.preferenciaEquipamento}/foco=${p.focos.join('+') || 'nenhum'}`;

    // ── Nível 0: a âncora abre o bloco do grupo, no dia inteiro ────────────
    for (const d of plano.dias) {
      const forca = d.exercicios.filter((e) => e.grupo !== 'cardio');
      const vistos = new Set();
      for (const e of forca) {
        const primeiroDoGrupo = !vistos.has(e.grupo);
        vistos.add(e.grupo);
        if (e.ancora !== primeiroDoGrupo) {
          ancoraFora++;
          amostraB8.fora ||= `${rot} | ${d.nome} | ${e.nome} ancora=${e.ancora}`;
        }
      }
    }

    // ── O que exatamente não pode mudar no bloco ────────────────────────────
    //
    // B8 diz "o PRINCIPAL de cada grupo... é a única série cuja carga alimenta
    // o gráfico e o e1RM". A primeira escrita desta régua cobrava a ÂNCORA, e
    // ela mediu a coisa errada: no plano real o ombro abre o dia A com
    // `Face pull` (finalizador, nenhum principal de ombro naquele dia) e abre o
    // dia D com `Remada alta` (principal). Cobrar o mesmo nome ali obrigaria a
    // pôr um desenvolvimento pesado no dia de empurrar — que é exatamente o que
    // A9 proíbe e o invariante (b) já testa. Ou seja, a régua estrita exigiria
    // violar outra regra do próprio projeto.
    //
    // A régua honesta: o exercício que ALIMENTA O GRÁFICO não muda dentro do
    // bloco. Onde o grupo não tem principal naquela sessão, não há curva para
    // proteger, e quem abre o bloco pode ser outro — esse é o preço declarado
    // de A9, não uma quebra de comparabilidade.
    const porGrupo = {};
    for (const d of plano.dias)
      for (const e of d.exercicios) {
        if (e.grupo === 'cardio') continue;
        (porGrupo[e.grupo] ??= []).push({ dia: d.nome, e });
      }
    for (const [g, linhas] of Object.entries(porGrupo)) {
      const principais = linhas.filter((x) => x.e.papel === 'principal');
      if (principais.length < 2) continue;
      const nomes = new Set(principais.map((x) => x.e.nome));
      const faixas = new Set(principais.map((x) => `${x.e.repsMin}-${x.e.repsMax}`));
      if (nomes.size > 1) {
        ancoraFora++;
        amostraB8.fora ||= `${rot} | ${g}: principais diferentes no bloco (${[...nomes].join(' / ')})`;
      } else if (faixas.size > 1) {
        ancoraFaixa++;
        amostraB8.faixa ||= `${rot} | ${g}: ${[...faixas].join(' / ')}`;
      }
    }

    // Os 5 perfis nomeados também alimentam o mesmo acumulador da grade: eles
    // incluem o cenário do print (4 dias, foco peito, preferência máquina), que
    // é onde o candidato 14 foi visto no celular do Leonardo.
    const antes = B8.pares;
    medirNivel2(plano, p, rot);
    paresMedidos += B8.pares - antes;
  }

  ok('nível 0: quem alimenta o gráfico é o mesmo no bloco inteiro',
     ancoraFora === 0, `${ancoraFora} — ex.: ${amostraB8.fora}`);
  ok('nível 0: e mantém a mesma faixa de repetições no bloco',
     ancoraFaixa === 0, `${ancoraFaixa} — ex.: ${amostraB8.faixa}`);

  // ── E na GRADE, onde a régua cobra a EXCEÇÃO em vez do zero ────────────
  //
  // Nos 6 perfis nomeados o número é 0. Na grade inteira ele não é, e prometer
  // zero ali seria escrever um invariante inatingível — o defeito M3 de G2.1.
  // Toda instabilidade que sobra é explicada por uma regra do próprio projeto:
  // a variedade de padrão da semana (l) ou o teto de 2 aparições do mesmo
  // pesado (i). Sem explicação é defeito, e é isso que a asserção cobra.
  ok('nível 0 na grade: quando sobram DUAS referências, o plano diz',
     B8_0.naoDeclarados === 0,
     `${B8_0.instaveis} de ${B8_0.grupos} grupos com 2 principais no bloco; ` +
       `motivos: ${JSON.stringify(B8_0.porMotivo)}; não declarados: ${B8_0.naoDeclarados}` +
       (B8_0.amostra ? ` — ex.: ${B8_0.amostra}` : ''));
  ok('e a régua do nível 0 mediu de verdade (não passou por vacuidade)',
     B8_0.grupos > 0 && B8_0.instaveis > 0,
     `${B8_0.grupos} grupos medidos, ${B8_0.instaveis} instáveis`);

  // ── E o nível 2 medido na GRADE de 1.350 perfis, não aqui ──────────────
  //
  // Os contadores vêm de `medirNivel2`, chamado dentro da seção 16. Medir só
  // nos 5 perfis nomeados acima daria 0 e esconderia 8 pares — foi assim que as
  // asserções de G1 passaram contra o código que gerou o bug do print.
  ok('nível 2: o segundo dia do grupo não repete os mesmos acessórios',
     B8.iguais === 0,
     `${B8.iguais} de ${B8.comAlternativa} pares com alternativa — ex.: ${B8.amostraIguais}`);
  ok('nível 2: e a troca muda o PERFIL DE RESISTÊNCIA dentro do padrão',
     B8.mesmoPerfil === 0,
     `${B8.mesmoPerfil} de ${B8.comAlternativa} — ex.: ${B8.amostraPerfil}`);
  ok('e havia pares para medir (a régua não passou por vacuidade)',
     B8.comAlternativa > 0,
     `${B8.comAlternativa} pares com alternativa de ${B8.pares} medidos, na grade inteira`);
  ok('os 5 perfis nomeados também têm pares (a grade não é a única cobertura)',
     paresMedidos > 0, `${paresMedidos} pares nomeados`);

  // O rodízio não pode CRIAR nem ELIMINAR padrão da sessão — é a restrição
  // literal de B8 nível 2. Exercitada na função, não só no plano.
  ok('existe a função de rodízio dentro do padrão',
     typeof VARIACAO.variarEntreSessoes === 'function',
     typeof VARIACAO.variarEntreSessoes === 'function' ? 'variarEntreSessoes' : 'não existe variacao.ts');
}

// ── 40. B8 nível 1: a TRANSIÇÃO ENTRE BLOCOS ──────────────────────────────
//
// UNIDADE: **transição entre blocos** — a unidade que a correção do
// cross-review de G2.1 nomeou como a mais fina que sobrava, e que continua sem
// nenhum invariante. Nada no app mede o que acontece ENTRE dois blocos.
//
// O que B8 pede no nível 1: no bloco novo o principal PODE trocar, dentro do
// mesmo padrão, e quando troca o app **quebra a curva do gráfico
// explicitamente** — nova âncora, nova linha de base, duas curvas separadas.
// Fingir continuidade entre exercícios diferentes é pior que admitir a quebra.
//
// Hoje o gerador é determinístico e não recebe o passado: o bloco 2 sai igual
// ao bloco 1, exercício por exercício. Não existe nem a troca nem a quebra.
console.log('\n40. B8 nível 1: a transição entre blocos (unidade nova)');
{
  const PERFIS_TR = [
    { ...base, focos: ['peito'], preferenciaEquipamento: 'maquina', minutosPorDia: Array(7).fill(90) },
    { ...base, dias: 5, diasDisponiveis: [1, 2, 3, 4, 5], focos: ['inferior'] },
    { ...base, dias: 4, focos: ['costas'], preferenciaEquipamento: 'livre', minutosPorDia: Array(7).fill(90) },
    { ...base, dias: 3, diasDisponiveis: [1, 3, 5], local: 'casa_equipada' },
  ];

  // Quem alimenta o gráfico — a mesma leitura da seção 39, pelo mesmo motivo:
  // é o PRINCIPAL que B8 protege, não quem abre o bloco.
  const ancorasDe = (plano) => {
    const out = {};
    for (const d of plano.dias)
      for (const e of d.exercicios)
        if (e.papel === 'principal' && !out[e.grupo]) out[e.grupo] = e.nome;
    return out;
  };

  ok('existe uma leitura de âncoras do bloco',
     typeof VARIACAO.ancorasDoPlano === 'function',
     typeof VARIACAO.ancorasDoPlano === 'function' ? 'ancorasDoPlano' : 'não existe');
  ok('e uma função que nomeia a QUEBRA entre blocos',
     typeof VARIACAO.quebrasDeAncora === 'function',
     typeof VARIACAO.quebrasDeAncora === 'function' ? 'quebrasDeAncora' : 'não existe');

  let trocouDePadrao = 0, quebraNaoDeclarada = 0, quebraSemPar = 0, blocoSemVariacao = 0;
  let ancoraInstavelNoBloco = 0;
  const amostraTr = { padrao: '', dec: '', par: '', sem: '', inst: '' };
  let gruposComAlternativa = 0, gruposQueTrocaram = 0;

  for (const p of PERFIS_TR) {
    const bloco1 = await montarPlano(p, fonte);
    const a1 = ancorasDe(bloco1);
    const bloco2 = await montarPlano({ ...p, ancorasAnteriores: a1 }, fonte);
    const a2 = ancorasDe(bloco2);
    const rot = `${p.dias}d/${p.local}/${p.preferenciaEquipamento}/foco=${p.focos.join('+') || 'nenhum'}`;

    // Toda âncora ou fica, ou troca DENTRO DO MESMO PADRÃO.
    for (const [g, nome1] of Object.entries(a1)) {
      const nome2 = a2[g];
      if (!nome2 || nome2 === nome1) continue;
      gruposQueTrocaram++;
      if (padraoDe(nome1, g) !== padraoDe(nome2, g)) {
        trocouDePadrao++;
        amostraTr.padrao ||= `${rot} | ${g}: ${nome1} (${padraoDe(nome1, g)}) → ${nome2} (${padraoDe(nome2, g)})`;
      }
    }

    // E toda troca é DECLARADA — estruturada, não só em prosa.
    const quebras = Array.isArray(bloco2.quebras) ? bloco2.quebras : [];
    const declaradas = new Set(quebras.map((q) => `${q.grupo}:${q.de}→${q.para}`));
    for (const [g, nome1] of Object.entries(a1)) {
      const nome2 = a2[g];
      if (!nome2 || nome2 === nome1) continue;
      if (!declaradas.has(`${g}:${nome1}→${nome2}`)) {
        quebraNaoDeclarada++;
        amostraTr.dec ||= `${rot} | ${g}: ${nome1} → ${nome2} sem quebra declarada`;
      }
    }
    // Uma quebra declarada precisa ter as duas pontas e o padrão.
    for (const q of quebras) {
      if (!q.grupo || !q.de || !q.para || !q.padrao) {
        quebraSemPar++;
        amostraTr.par ||= `${rot} | ${JSON.stringify(q)}`;
      }
    }

    // Nível 0 preservado DENTRO do bloco 2: o principal não muda entre os dias.
    const porGrupo2 = {};
    for (const d of bloco2.dias)
      for (const e of d.exercicios)
        if (e.papel === 'principal') (porGrupo2[e.grupo] ??= new Set()).add(e.nome);
    for (const [g, nomes] of Object.entries(porGrupo2)) {
      if (nomes.size > 1) {
        ancoraInstavelNoBloco++;
        amostraTr.inst ||= `${rot} | ${g}: ${[...nomes].join(' / ')}`;
      }
    }

    // Havia alternativa de MESMO PADRÃO no local? Se havia e nada trocou, o
    // nível 1 não existe — que é o estado de hoje.
    let comAlternativa = 0;
    for (const [g, nome1] of Object.entries(a1)) {
      const pad = padraoDe(nome1, g);
      const alt = catalogoDoPerfil(p, g).some(
        (c) => c.nome !== nome1 && padraoDe(c.nome, g) === pad
      );
      if (alt) comAlternativa++;
    }
    gruposComAlternativa += comAlternativa;
    if (comAlternativa > 0 && Object.entries(a1).every(([g, n]) => a2[g] === n)) {
      blocoSemVariacao++;
      amostraTr.sem ||= `${rot} | ${comAlternativa} grupo(s) com alternativa e nenhuma âncora trocou`;
    }
  }

  ok('a âncora do bloco novo troca DENTRO do mesmo padrão',
     trocouDePadrao === 0, `${trocouDePadrao} trocas de padrão — ex.: ${amostraTr.padrao}`);
  ok('toda troca de âncora é declarada como QUEBRA da curva',
     quebraNaoDeclarada === 0, `${quebraNaoDeclarada} — ex.: ${amostraTr.dec}`);
  ok('e a quebra nomeia grupo, exercício antigo, novo e padrão',
     quebraSemPar === 0, `${quebraSemPar} — ex.: ${amostraTr.par}`);
  ok('nível 0 preservado: dentro do bloco novo a âncora continua uma só',
     ancoraInstavelNoBloco === 0, `${ancoraInstavelNoBloco} — ex.: ${amostraTr.inst}`);
  ok('o bloco novo de fato varia quando existe alternativa no mesmo padrão',
     blocoSemVariacao === 0,
     `${blocoSemVariacao} bloco(s) idênticos ao anterior; ${gruposQueTrocaram} grupos trocaram, ${gruposComAlternativa} tinham alternativa`);

  // A quebra precisa chegar ONDE A CURVA MORA. Declarar no plano e desenhar
  // uma linha contínua no gráfico seria fingir a continuidade que B8 proíbe.
  ok('a tela que desenha a curva sabe da quebra de âncora',
     /quebra|ancoraAnterior|trocou de âncora|trocouDeAncora/i.test(FONTE_TELA_EX),
     /quebra/i.test(FONTE_TELA_EX) ? 'ligada' : 'o gráfico não sabe que a âncora mudou');
  ok('e existe como descobrir a quebra a partir das rotinas já salvas',
     /quebrasDeAncora|ancorasDaRotina/.test(FONTE_API), 'sem leitura no api.ts');
}


// ═══════════════════════════════════════════════════════════════════════════
// FASE 5.1 — o que a Fase 5 criou na nutrição
// ═══════════════════════════════════════════════════════════════════════════

// ── 41. A meta manual sobrevive à próxima pesagem (N13, N14) ───────────────
//
// UNIDADE: **decisão de meta ao longo do tempo** — não a meta de um dia, mas o
// que acontece com ela no dia seguinte. Nenhum invariante deste arquivo media
// isso: a seção 33 varre 672 corpos num instante congelado, e o defeito só
// existe no segundo instante.
//
// `recalcularMeta` grava `salvarMeta(macros, 'auto')` **sem olhar a origem da
// meta vigente**, e roda em toda pesagem, toda bioimpedância e toda edição de
// perfil. A pessoa ajusta para 1.800 kcal, lê os avisos, aceita — e na manhã
// seguinte, ao se pesar, a meta volta para 2.464 sem nada na tela. A Fase 5
// investiu a fase inteira em fazer o caminho manual bom (a escada de gordura,
// os avisos, a conferência que soma) e ele é descartado na pesagem seguinte.
//
// E o vizinho de baixo (N14): `recalcularMeta` descarta os avisos
// explicitamente (`const { avisos: _avisos, ...macros } = m;`), e `resumo()` só
// usa `automatica.avisos` **quando não existe meta salva** — o que, depois do
// onboarding, nunca acontece. Os avisos de N8 aparecem no onboarding e no botão
// "Recalcular", e nunca mais. No estado estável o piso morde em silêncio.
console.log('\n41. A meta manual sobrevive à pesagem, e o piso continua explicado (N13, N14)');
{
  const FONTE_API_PERFIL = readFileSync(new URL('../src/features/perfil/api.ts', import.meta.url), 'utf8');

  // A decisão mora num módulo PURO, como a conta da meta já mora. Regra do
  // projeto e lição da Fase 5: o que vive dentro de `api.ts` é inalcançável
  // para este arquivo, e foi por isso que a proteína sobre o peso total
  // sobreviveu anos sem nenhum invariante.
  ok('a decisão de sobrescrever a meta é uma função pura, testável',
     typeof META.decidirRecalculo === 'function',
     typeof META.decidirRecalculo === 'function' ? 'decidirRecalculo' : 'a regra mora dentro de api.ts, fora do alcance do harness');

  const decidir =
    META.decidirRecalculo ??
    // Fallback = a regra de hoje: grava sempre, sem olhar a origem.
    (() => ({ gravar: true, aviso: null }));

  const automatica = { kcal: 2464, proteina_g: 154, carbo_g: 300, gordura_g: 68 };

  const semNada = decidir({ vigente: null, automatica });
  ok('sem meta salva, a automática entra', semNada.gravar === true, JSON.stringify(semNada));

  const eraAuto = decidir({
    vigente: { kcal: 2400, proteina_g: 150, carbo_g: 290, gordura_g: 67, origem: 'auto' },
    automatica,
  });
  ok('meta automática antiga é substituída pela nova', eraAuto.gravar === true, JSON.stringify(eraAuto));

  const eraManual = decidir({
    vigente: { kcal: 1800, proteina_g: 154, carbo_g: 170, gordura_g: 50, origem: 'manual' },
    automatica,
  });
  ok('meta MANUAL não é sobrescrita pela pesagem da manhã seguinte',
     eraManual.gravar === false, JSON.stringify(eraManual));
  ok('e a pessoa fica sabendo qual seria a automática de hoje',
     typeof eraManual.aviso === 'string' && /1\.?800/.test(eraManual.aviso) && /2\.?464/.test(eraManual.aviso),
     eraManual.aviso ?? 'sem aviso — a meta manual continua valendo e ninguém diz nada');

  // E o fio: as três telas que disparam o recálculo precisam usar a decisão.
  ok('recalcularMeta consulta a origem da meta vigente antes de gravar',
     /decidirRecalculo/.test(FONTE_API_PERFIL),
     /decidirRecalculo/.test(FONTE_API_PERFIL) ? 'ligada' : "recalcularMeta grava 'auto' cego");

  // ── N14: a razão da meta é calculada e jogada fora ──────────────────────
  //
  // As duas listas respondem perguntas diferentes, e a prova é aritmética:
  // existem corpos em que a meta automática tem RAZÃO (o piso mordeu, e por
  // quê) e zero ALERTA (ela é, por construção, uma meta correta). Para esses
  // corpos, mostrar só `avisosDaMeta` apaga a explicação inteira.
  {
    const auditar = META.avisosDaMeta ?? (() => []);
    const calcular2 = META.calcularMetaDetalhada;
    // Grade própria: a da seção 33 mora dentro do bloco dela, e copiar o laço
    // é mais honesto que vazar o escopo — aqui a pergunta é outra.
    const corpos41 = [];
    let i41 = 0;
    for (const pesoKg of [50, 62, 75, 88, 105, 120, 140])
      for (const gordura of [8, 15, 22, 30, 38, 45])
        for (const objetivo of ['emagrecimento', 'recomposicao', 'hipertrofia', 'manutencao'])
          for (const genero of ['masculino', 'feminino'])
            for (const medida of [true, false]) {
              corpos41.push({
                pesoKg, gorduraReal: gordura, objetivo, genero,
                alturaCm: [158, 172, 186][i41 % 3],
                idadeAnos: [22, 34, 47, 58][i41 % 4],
                nivel: ['sedentario', 'moderado', 'intenso'][i41 % 3],
                gorduraPct: medida ? gordura : null,
              });
              i41++;
            }
    let razaoQueSomeria = 0, amostraRazao = '';
    if (typeof calcular2 === 'function')
      for (const c of corpos41) {
        const basal = tmb(c.pesoKg, c.alturaCm, c.idadeAnos, c.genero);
        const gasto = tdee(basal, c.nivel);
        const estimar = { alturaCm: c.alturaCm, idade: c.idadeAnos, genero: c.genero };
        const ctx = { basal, tdee: gasto, pesoKg: c.pesoKg, gorduraPct: c.gorduraPct, estimar, genero: c.genero, objetivo: c.objetivo };
        const r = calcular2({ tdee: gasto, basal, pesoKg: c.pesoKg, objetivo: c.objetivo, gorduraPct: c.gorduraPct, estimar, genero: c.genero });
        if ((r.avisos ?? []).length > 0 && auditar(r.meta, ctx).length === 0) {
          razaoQueSomeria++;
          amostraRazao ||= `${c.pesoKg}kg/${c.gorduraReal}%/${c.objetivo}: "${r.avisos[0].slice(0, 70)}…"`;
        }
      }
    ok('existem corpos cuja RAZÃO some se a tela só mostrar o que está errado',
       razaoQueSomeria > 0, `${razaoQueSomeria} de ${corpos41.length} — ex.: ${amostraRazao}`);
    ok('por isso o resumo carrega a razão separada do alerta',
       /razaoMeta/.test(FONTE_API_PERFIL),
       /razaoMeta/.test(FONTE_API_PERFIL) ? 'razaoMeta + avisosMeta' : 'só avisosMeta, e ela some no estado estável');
    ok('e recalcularMeta não joga mais os avisos no lixo',
       !/avisos:\s*_avisos/.test(FONTE_API_PERFIL),
       /avisos:\s*_avisos/.test(FONTE_API_PERFIL) ? 'ainda descarta com `const { avisos: _avisos, ...macros }`' : 'derivado na leitura');

    // Regra 6: a razão é derivada, não é decisão. Gravá-la em
    // `nutrition_targets` congelaria uma explicação que depende do peso de
    // hoje — exatamente o histórico mentiroso que a regra proíbe.
    const insert = FONTE_API_PERFIL.match(/INSERT INTO nutrition_targets[\s\S]{0,220}/)?.[0] ?? '';
    ok('e a razão NÃO é gravada em nutrition_targets (regra 6)',
       !/razao|motivo|aviso/i.test(insert), insert.replace(/\s+/g, ' ').slice(0, 110));
  }

  // A tela precisa mostrar as duas com rótulos diferentes. "Duas listas de
  // texto laranja" seria a mesma coisa que uma.
  const FONTE_PERFIL_TELA = readFileSync(new URL('../app/(tabs)/perfil.tsx', import.meta.url), 'utf8');
  ok('a tela de perfil mostra a razão e o alerta como coisas diferentes',
     /razaoMeta/.test(FONTE_PERFIL_TELA),
     /razaoMeta/.test(FONTE_PERFIL_TELA) ? 'dois blocos' : 'a tela só conhece avisosMeta');
}

// ── 42. Treino à noite não perde o pós-treino (N10) ───────────────────────
//
// UNIDADE: **plano de refeições de um dia** — as fatias de caloria de um dia
// inteiro, que precisam somar o dia inteiro.
//
// `planoDoDia` corta o ramo `noite` com `slice(0, max(3, refeicoesPorDia))` e
// os outros quatro ramos ignoram `refeicoes_por_dia`. Só que a lista da noite
// está em ordem cronológica e o jantar — que é o `pos_treino` — é o ÚLTIMO
// item: com 4 refeições ele some e as fatias somam 0,72 do dia; com 3, somam
// 0,58 e o pré-treino vai junto. Quem treina à noite fica sem as duas
// refeições que o arquivo inteiro existe para posicionar.
console.log('\n42. O plano do dia soma o dia, em todo horário de treino (N10)');
{
  const TIMING = await carregarModulo('../src/features/dieta/timing.ts');
  ok('existe o plano de refeições por horário de treino', typeof TIMING.planoDoDia === 'function',
     typeof TIMING.planoDoDia);
  const plano = TIMING.planoDoDia ?? (() => []);
  const HORARIOS = ['jejum', 'manha', 'almoco', 'tarde', 'noite'];

  let naoSoma = 0, semPos = 0, semPre = 0;
  const amT = { soma: '', pos: '', pre: '' };
  for (const h of HORARIOS)
    for (const n of [3, 4, 5, 6]) {
      const p = plano(h, n, '06:30');
      const soma = p.reduce((s, r) => s + (r.fatiaKcal ?? 0), 0);
      if (Math.abs(soma - 1) > 0.02) {
        naoSoma++;
        amT.soma ||= `${h} com ${n} refeições: as fatias somam ${soma.toFixed(2)} do dia`;
      }
      if (!p.some((r) => r.papel === 'pos_treino')) {
        semPos++;
        amT.pos ||= `${h} com ${n} refeições: nenhuma refeição pós-treino`;
      }
      if (!p.some((r) => r.papel === 'pre_treino')) {
        semPre++;
        amT.pre ||= `${h} com ${n} refeições: nenhuma refeição pré-treino`;
      }
    }
  ok('as fatias de caloria somam o dia inteiro em todo horário',
     naoSoma === 0, `${naoSoma} de 20 — ${amT.soma}`);
  ok('todo plano tem a refeição de DEPOIS do treino', semPos === 0, `${semPos} de 20 — ${amT.pos}`);
  ok('e a de ANTES', semPre === 0, `${semPre} de 20 — ${amT.pre}`);
}

// ── 43. Código morto novo, contra a regra que a própria Fase 5 escreveu ────
//
// UNIDADE: **símbolo exportado sem chamador**. A Fase 5 renomeou
// `REGIOES_DOR.evitar` para `exemplos` com uma justificativa escrita — "lista
// antiga viva ao lado da regra nova é a que a próxima pessoa acha primeiro" —
// e não aplicou o critério ao próprio domínio. `macros()` continua exportada,
// chamável, e ainda contém `objetivo === 'emagrecimento' ? 2.2` sobre o peso
// total: é a função que produz os 264 g, viva ao lado da que produz 192.
console.log('\n43. A regra antiga não fica viva ao lado da nova (N21)');
{
  const FONTE_CALCULOS = readFileSync(new URL('../src/features/perfil/calculos.ts', import.meta.url), 'utf8');
  const FONTE_RECOMP2 = readFileSync(new URL('../src/features/perfil/recomposicao.ts', import.meta.url), 'utf8');
  const FONTE_API2 = readFileSync(new URL('../src/features/perfil/api.ts', import.meta.url), 'utf8');
  const CALC = await carregarModulo('../src/features/perfil/calculos.ts');
  const API_FONTE_OK = /export async function definirMetaCalorica/.test(FONTE_API2);

  ok('a proteína sobre o PESO TOTAL não existe mais em src/',
     typeof CALC.macros !== 'function' && !/'emagrecimento'\s*\n?\s*\?\s*2\.2/.test(FONTE_CALCULOS),
     typeof CALC.macros === 'function' ? 'calculos.macros() continua exportada e chamável' : 'apagada');
  ok('definirMetaCalorica não continua exportada sem chamador',
     !API_FONTE_OK, API_FONTE_OK ? 'zero chamadores em app/ e src/' : 'apagada');
  ok('projetar não continua exportada sem chamador',
     !/export function projetar/.test(FONTE_RECOMP2),
     /export function projetar/.test(FONTE_RECOMP2) ? 'zero chamadores em app/ e src/' : 'apagada');
}

// ═══════════════════════════════════════════════════════════════════════════
// Correção da validação de tela do G3 (5 ALTOs)
//
// UNIDADE NOVA: a **frase gerada**. Nenhuma das seções 36-40 podia pegar o pior
// defeito do G3 — elas mediam se a função DEVOLVE texto, e ela devolvia: 457
// frases distintas, das quais 7 corretas. Asserção de existência não lê
// português. A régua aqui varre o texto de verdade.
//
// A segunda unidade nova é o **lado da transição** (antigo/novo): o banner da
// quebra existia, era testado e nunca renderizava do lado novo, porque estava
// aninhado dentro do gráfico e exercício que acabou de entrar tem zero ponto.
// ═══════════════════════════════════════════════════════════════════════════

// ── 44. Toda frase de objetivo é português correto ────────────────────────
//
// UNIDADE: **frase gerada**. A varredura monta sessões sintéticas cobrindo os
// quatro ramos de `porqueEsteExercicio` (sozinho no grupo, único do padrão,
// único no pico, dividindo o padrão) para os 117 exercícios do catálogo.
console.log('\n44. Objetivo do exercício: português correto em TODA frase gerada');
{
  const porque = PORQUE.porqueEsteExercicio;
  ok('existe a função de objetivo', typeof porque === 'function', typeof porque);

  const frases = new Map(); // frase → contexto de exemplo
  if (typeof porque === 'function') {
    const porGrupo = {};
    for (const e of CAT_FORCA) (porGrupo[e.grupo_primario] ??= []).push(e);

    for (const [g, lista] of Object.entries(porGrupo)) {
      for (const alvo of lista) {
        const item = (x) => ({ nome: x.nome, grupo: x.grupo_primario, equipamento: x.equipamento });
        // Ramo 1: sozinho no grupo.
        const ctx = [[item(alvo)]];
        // Ramos 2-4: com cada um dos outros do MESMO grupo ao lado. Cobre
        // "mesmo padrão" (quando o outro compartilha padrão), "único no pico" e
        // "único do padrão" sem precisar adivinhar qual é qual.
        for (const outro of lista) if (outro !== alvo) ctx.push([item(alvo), item(outro)]);
        for (const sessao of ctx) {
          const f = porque(item(alvo), sessao);
          if (f && !frases.has(f)) frases.set(f, `${g} | ${alvo.nome} | com ${sessao.length - 1}`);
        }
      }
    }
  }

  ok('a varredura produziu frases para medir', frases.size > 100, `${frases.size} frases distintas`);

  const defeitos = {
    'preposição "de" sem contrair': /\bde\s+(o|a|os|as)\s/i,
    'preposição "por" sem contrair': /\bpor\s+(o|a|os|as)\s/i,
    'preposição "em" sem contrair': /\bem\s+(o|a|os|as)\s/i,
    'plural fingido com "(s)"': /\(s\)/,
    'contagem de exercícios na frase': /\d+\s+exerc[íi]cio/i,
    'fallback quebrado "o outro do dia"': /\bo outro do dia\b/i,
    'maiúscula no meio da frase': /[a-zà-ú,]\s+(É|A|O|De|Em|Por)\s+[a-zà-ú]/,
    'frase sem ponto final': /[^.!?]$/,
  };
  for (const [nome, re] of Object.entries(defeitos)) {
    const maus = [...frases.keys()].filter((f) => re.test(f));
    ok(`nenhuma frase com ${nome}`, maus.length === 0,
       `${maus.length} de ${frases.size}${maus.length ? ` — ex.: "${maus[0].slice(0, 120)}"` : ''}`);
  }

  // ── Concordância de gênero, cobrada contra o DADO, não contra uma lista ──
  //
  // Cada rótulo de padrão declara `genero`. A frase que anuncia unicidade tem
  // que usar "o único" para masculino e "a única" para feminino — 235 das 457
  // frases erravam isto, porque o "o" era fixo e 32 dos 45 rótulos são
  // femininos.
  const rotulos = typeof PORQUE.unicoDe === 'function' ? PORQUE : null;
  ok('gênero e número são dados declarados, não presumidos',
     typeof PORQUE.unicoDe === 'function' && typeof PORQUE.contrair === 'function',
     rotulos ? 'unicoDe + contrair' : 'não existem as funções de concordância');
  if (rotulos) {
    ok('unicoDe concorda no masculino', PORQUE.unicoDe({ nome: 'mergulho', genero: 'm' }) === 'o único mergulho');
    ok('unicoDe concorda no feminino', PORQUE.unicoDe({ nome: 'abertura', genero: 'f' }) === 'a única abertura');
    ok('contrair resolve de + as (costas)',
       PORQUE.contrair('de', { nome: 'costas', genero: 'f', plural: true }) === 'das costas');
    ok('contrair resolve por + o (peito)',
       PORQUE.contrair('por', { nome: 'peito', genero: 'm' }) === 'pelo peito');
  }

  // Discordância residual: "É o <rótulo feminino>" e "É a <rótulo masculino>".
  const generoErrado = [...frases.keys()].filter((f) =>
    /É o (única|abertura|remada|prensa|adução|rotação|extensão|elevação|flexora|puxada|dobradiça|abdução|panturrilha|rosca|cadeia)/.test(f) ||
    /É a (único|mergulho|empurrar|desenvolvimento|agachamento|coice|empurrão|encolhimento|trabalho|excêntrico)/.test(f)
  );
  ok('nenhuma frase com gênero discordante', generoErrado.length === 0,
     `${generoErrado.length}${generoErrado.length ? ` — ex.: "${generoErrado[0].slice(0, 110)}"` : ''}`);

  // ── Teto de comprimento: a tela do dia é uma coluna de 202 px a 11 px ────
  //
  // 64% das frases passavam de 200 caracteres, o que dava 6 a 9 linhas por card
  // e 910 px só de objetivo numa tela de 788. O teto é do LAYOUT, não do gosto.
  const TETO = 175;
  const longas = [...frases.keys()].filter((f) => f.length > TETO);
  const media = Math.round([...frases.keys()].reduce((a, f) => a + f.length, 0) / (frases.size || 1));
  ok(`nenhuma frase acima de ${TETO} caracteres`, longas.length === 0,
     `${longas.length} de ${frases.size}, média ${media}${longas.length ? ` — ex.: ${longas[0].length} chars` : ''}`);

  // E o fecho não pode ser o mesmo em todo card: 3 cards seguidos terminando na
  // mesma cláusula lê como boilerplate, e foi o que a validação viu no dia 7.
  const fechos = new Set([...frases.keys()].map((f) => f.split('. ').pop()));
  ok('os fechos variam (não é uma cláusula só repetida)',
     fechos.size >= 8, `${fechos.size} fechos distintos em ${frases.size} frases`);
}

// ── 45. Cadência × tipo de carga, e o texto que a acompanha ───────────────
//
// UNIDADE: **exercício**. `cadenciaDe` já devolvia {0,0,0} para série por tempo
// — o defeito estava no TEXTO ao lado, que não olhava esse caso: a prancha
// recebia "Desça em 2 s, suba com intenção de acelerar" e, duas linhas abaixo,
// "não há amplitude a percorrer". E a nórdica recebia 4-0-1 com um texto fixo
// dizendo "o padrão aqui é 2 s" logo embaixo.
console.log('\n45. Cadência e texto concordam com o tipo de carga (ALTO-2 e ALTO-3)');
{
  ok('o texto de cadência é derivado, não constante',
     typeof EXEC.porqueCadenciaDe === 'function',
     typeof EXEC.porqueCadenciaDe === 'function' ? 'porqueCadenciaDe' : 'só existe a constante');

  let tempoComRitmo = 0, lentoNegado = 0, semTexto = 0;
  const amostra = { tempo: '', lento: '', sem: '' };
  for (const e of CAT_FORCA) {
    const x = EXEC.execucaoDe?.(e.nome, e.grupo_primario, e.equipamento, e.tipo_carga);
    if (!x) { semTexto++; continue; }
    const contexto =
      typeof EXEC.porqueCadenciaDe === 'function' ? EXEC.porqueCadenciaDe(x.cadencia) : '';
    const todo = `${x.porqueCadencia} ${contexto}`;
    if (!x.porqueCadencia || !contexto) { semTexto++; amostra.sem ||= e.nome; continue; }

    // Série por tempo: nenhum texto pode mandar descer em 2 s nem falar de subida.
    // O que não pode é INSTRUÇÃO de ritmo — imperativo ou o número da cadência.
    // Casar com a palavra "descida" pegaria também "não há descida nem subida",
    // que é justamente a frase certa: régua que reprova a negação está medindo
    // a palavra, não o sentido.
    if (e.tipo_carga === 'tempo' && /(desça|suba)|2 s descendo|intenção de acelerar/i.test(todo)) {
      tempoComRitmo++;
      amostra.tempo ||= `${e.nome}: ${todo.slice(0, 90)}`;
    }
    // Excêntrico de 4 s: o texto ao lado não pode dizer que o padrão é 2 s nem
    // que descer mais devagar não adianta — a mesma tela acabou de prescrever 4.
    if (x.cadencia.excentrica >= 4 && /o padrão (aqui )?é 2 s|não substitui carga/i.test(todo)) {
      lentoNegado++;
      amostra.lento ||= `${e.nome}: ${todo.slice(0, 110)}`;
    }
  }
  ok('série por tempo não recebe instrução de descida/subida',
     tempoComRitmo === 0, `${tempoComRitmo} — ex.: ${amostra.tempo}`);
  ok('exercício de 4 s não é contradito pelo texto ao lado',
     lentoNegado === 0, `${lentoNegado} — ex.: ${amostra.lento}`);
  ok('todo exercício tem os dois textos', semTexto === 0, `${semTexto} — ex.: ${amostra.sem}`);

  // O rótulo "descida · pausa · subida" não pode aparecer sem as três fases.
  ok('a tela não rotula as três fases numa série por tempo',
     /temCadencia \? 'descida · pausa · subida'/.test(FONTE_TELA_EX),
     /descida · pausa · subida/.test(FONTE_TELA_EX) ? 'rótulo incondicional' : 'ausente');
  // E não inventa um número de repetições que ela não conhece.
  ok('a tela não crava um número de repetições',
     !/repsTipicas/.test(FONTE_TELA_EX),
     /repsTipicas/.test(FONTE_TELA_EX) ? 'ainda usa repsTipicas = 10' : 'por repetição');

  // ── ALTO-4: o checklist de vídeo não pode negar a evidência do card ─────
  const FONTE_VIDEO = readFileSync(
    new URL('../src/features/treino/video.ts', import.meta.url),
    'utf8'
  );
  // Só o ARRAY, não o arquivo: o comentário que explica a remoção cita a frase
  // removida, e comentário não chega à tela. Régua que lê prosa reprova a
  // própria explicação — foi o que aconteceu na primeira rodada desta seção.
  const arrayVideo = FONTE_VIDEO.slice(
    FONTE_VIDEO.indexOf('export const COMO_AVALIAR_VIDEO')
  );
  ok('o checklist de vídeo não vende excêntrica como ganho de hipertrofia',
     !!arrayVideo && !/onde mais se cresce|excêntrica é onde|mais se cresce/i.test(arrayVideo),
     /mais se cresce/i.test(arrayVideo) ? 'contradiz o card de cadência' : 'alinhado');

  // ── MÉDIO: o erro derivado não pode citar aparelho que não existe ───────
  const erroPanturrilha = EXEC.erroComumDe?.('Panturrilha em pé', 'panturrilha', 'maquina', 'peso_reps') ?? '';
  ok('o erro da panturrilha em pé não fala de banco',
     !!erroPanturrilha && !/banco/i.test(erroPanturrilha), erroPanturrilha.slice(0, 90));
  const erroSupino = EXEC.erroComumDe?.('Supino máquina', 'peito', 'maquina', 'peso_reps') ?? '';
  ok('e não é o mesmo texto do supino de máquina',
     erroPanturrilha !== erroSupino, erroPanturrilha === erroSupino ? 'idênticos' : 'distintos');

  // ── MÉDIO: a dica do catálogo não pode pedir o que a cadência não prescreve ──
  //
  // `Panturrilha em pé` pedia "pausa embaixo" enquanto o card acima prescrevia
  // 2-0-1. A pausa foi medida e rejeitada (−1.184 séries na grade); quem estava
  // errado era o texto. E não basta corrigir o seed: `completarCatalogo` só
  // insere o que falta, então o aparelho de quem já usa o app precisa do passo
  // de sincronização.
  const SEED = readFileSync(new URL('../src/db/seed/exercicios.ts', import.meta.url), 'utf8');
  const semPausa = CAT_FORCA.filter((e) => {
    const cad = EXEC.cadenciaDe?.(e.nome, e.grupo_primario, e.equipamento, e.tipo_carga);
    return cad && cad.pausa === 0 && (EXEC.tempoPorRepSeg?.(cad) ?? 0) > 0;
  });
  const pedemPausa = semPausa.filter((e) => {
    const i = SEED.indexOf(`'${e.nome}'`);
    return i > 0 && /pausa embaixo/i.test(SEED.slice(i, i + 900));
  });
  ok('nenhuma dica pede pausa em exercício prescrito sem pausa',
     pedemPausa.length === 0, `${pedemPausa.length}${pedemPausa.length ? ` — ex.: ${pedemPausa[0].nome}` : ''}`);
  const FONTE_NORM = readFileSync(new URL('../src/db/normalizar.ts', import.meta.url), 'utf8');
  ok('e o banco de quem já usa o app recebe o texto corrigido',
     /sincronizarDicas/.test(FONTE_NORM),
     /sincronizarDicas/.test(FONTE_NORM) ? 'passo de sincronização existe' : 'só o seed foi corrigido');
}

// ── 46. O banner da quebra renderiza dos DOIS lados ───────────────────────
//
// UNIDADE: **lado da transição** (`antigo` / `novo`). O texto existia, a função
// devolvia `lado: 'novo'` com a frase certa, e a tela nunca mostrava: o bloco
// estava aninhado em `serie.length > 1`, e exercício que acabou de entrar tem
// zero ponto por definição. Metade das 1.252 quebras era impossível de exibir —
// e era o lado em que a pessoa pergunta "por que estou começando do zero?".
console.log('\n46. A quebra de âncora aparece nos dois lados da transição');
{
  const fonte = FONTE_TELA_EX;
  const iQuebra = fonte.indexOf("quebra.lado === 'antigo'");
  // A âncora é o JSX, não a palavra: o comentário que documenta o defeito cita
  // `serie.length > 1` e a régua anterior casava com ele, dando a posição
  // errada. Régua de fonte precisa apontar para código.
  const iGrafico = fonte.indexOf('{serie.length > 1 ? (');
  ok('a tela conhece os dois lados da quebra', iQuebra > 0, iQuebra > 0 ? 'sim' : 'não renderiza');
  ok('e o banner NÃO depende de haver gráfico',
     iQuebra > 0 && iGrafico > 0 && iQuebra < iGrafico,
     iQuebra > iGrafico ? 'aninhado dentro de serie.length > 1' : 'independente do gráfico');

  // A régua estrutural: o bloco da quebra tem que FECHAR antes de o gráfico
  // abrir. Se ele fechasse depois, estaria envolvendo o gráfico — e se não
  // fechasse, estaria dentro dele, que era o defeito.
  const iAbre = fonte.indexOf('{quebra ? (');
  const trecho = iAbre > 0 && iGrafico > iAbre ? fonte.slice(iAbre, iGrafico) : '';
  ok('o bloco da quebra fecha antes de o gráfico abrir',
     !!trecho && trecho.includes(') : null}'),
     trecho ? 'fechado' : 'o bloco não fecha antes do gráfico');

  // E os dois textos são diferentes: "termina aqui" e "começa do zero" contam
  // histórias opostas e nenhuma delas serve para o outro lado.
  ok('os dois lados têm rótulo próprio',
     /Esta curva termina aqui/.test(fonte) && /Esta curva começa do zero/.test(fonte));
}

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
