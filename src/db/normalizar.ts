import type * as SQLite from 'expo-sqlite';
import { COMPOSTOS, COMPOSTOS_PESADOS } from '@/features/treino/classificacao';
import {
  descansoCorreto,
  papeisDaRotina,
  prescricaoDe,
  type Papel,
} from '@/features/treino/papel';
import { EXERCICIOS, MEDIA_BASE } from './seed/exercicios';

/**
 * Normalização pós-migração.
 *
 * Roda toda abertura do banco e é idempotente. Serve para regras que dependem
 * de listas em código, e não de SQL — classificar exercícios e derivar o
 * descanso a partir dessa classificação.
 *
 * Existe porque descanso digitado à mão em cada rotina envelhece mal: o
 * catálogo tinha supino com 120 s e puxada com 90 s, abaixo do que a evidência
 * indica. Corrigir por regra conserta o que já está no aparelho de quem usa.
 */
export async function normalizar(db: SQLite.SQLiteDatabase) {
  await renomearExercicios(db);
  await completarCatalogo(db);
  await sincronizarDicas(db);
  await classificarExercicios(db);
  // ORDEM: o papel entra ANTES do descanso, e isso é a fase inteira.
  // Sem papel, `corrigirDescansos` cai no fallback que trata todo
  // multiarticular como principal — o que é falso a partir do segundo
  // exercício do grupo e daria descanso ERRADO, não só diferente.
  await preencherPapeis(db);
  await corrigirDescansos(db);
}

/**
 * Exercício que trocou de nome no catálogo, renomeado NO LUGAR.
 *
 * ── E quem já está com o banco montado? ──────────────────────────────────
 *
 * `completarCatalogo` casa por nome: sem isto, corrigir um nome no seed não
 * corrige o banco de ninguém — insere uma linha nova e deixa a antiga, errada,
 * do lado. O usuário fica com os dois na busca e com o histórico preso no que
 * está errado.
 *
 * Renomear pelo id preserva TUDO que aponta para ele: `set_logs`,
 * `personal_records`, `routine_exercises`. Nada de DELETE, nada de INSERT —
 * é a mesma linha com o nome, a imagem e o texto certos.
 *
 * Idempotente por construção (o WHERE só acha o nome velho) e conservador: se
 * as duas linhas já existirem, não faz nada, porque juntar duas linhas com
 * histórico é decisão que não cabe a uma normalização silenciosa.
 */
const RENOMEADOS: [de: string, para: string][] = [
  ['Crossover na polia baixa', 'Supino na polia'],
];

async function renomearExercicios(db: SQLite.SQLiteDatabase) {
  for (const [de, para] of RENOMEADOS) {
    const velho = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM exercises WHERE nome = ?',
      [de]
    );
    if (!velho) continue;
    const novo = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM exercises WHERE nome = ?',
      [para]
    );
    if (novo) continue;

    const linha = EXERCICIOS.find(([nome]) => nome === para);
    if (!linha) continue;
    const [, grupo, sec, equip, carga, slug, instr, dica] = linha;
    await db.runAsync(
      `UPDATE exercises
          SET nome = ?, grupo_primario = ?, grupos_secundarios = ?, equipamento = ?,
              tipo_carga = ?, media_url = ?, instrucoes = ?, dica = ?
        WHERE id = ?`,
      [para, grupo, sec, equip, carga, slug ? `${MEDIA_BASE}/${slug}` : null, instr, dica, velho.id]
    );
    console.log(`[forja] "${de}" virou "${para}" — histórico preservado (id ${velho.id})`);
  }
}

/**
 * Insere exercício novo do catálogo em banco que já existe.
 *
 * `seedIfEmpty` só roda em banco vazio — o nome não mente. Então todo exercício
 * acrescentado depois do primeiro uso ficava invisível para quem já tinha o app
 * instalado, que é justamente todo mundo que usa. A expansão que levou o
 * catálogo de 74 para 104 (inferiores e peso corporal, os dois buracos que
 * faziam "foco em glúteo" e "em casa sem equipamento" saírem sem treino) não
 * chegaria em nenhum aparelho.
 *
 * Casa por NOME, que é o que o app mostra e o que o usuário reconhece — id de
 * seed não sobrevive a reset. Quem já existe não é tocado: mexer em exercício
 * com série registrada apagaria histórico.
 */
async function completarCatalogo(db: SQLite.SQLiteDatabase) {
  const existentes = new Set(
    (await db.getAllAsync<{ nome: string }>('SELECT nome FROM exercises')).map((e) => e.nome)
  );
  if (!existentes.size) return; // banco novo: o seed dá conta

  const faltando = EXERCICIOS.filter(([nome]) => !existentes.has(nome));
  if (!faltando.length) return;

  for (const [nome, grupo, sec, equip, carga, slug, instr, dica] of faltando) {
    await db.runAsync(
      `INSERT INTO exercises
         (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga,
          media_url, instrucoes, dica)
       VALUES (?,?,?,?,?,?,?,?)`,
      [nome, grupo, sec, equip, carga, slug ? `${MEDIA_BASE}/${slug}` : null, instr, dica]
    );
  }

  // Força a reclassificação: sem isto o exercício novo entra sem saber se é
  // composto e com descanso zerado, e o gerador prescreve pausa errada nele.
  //
  // ── A flag de descanso NÃO é mais apagada aqui ──────────────────────────
  //
  // Ela era, e o efeito colateral custava a escolha do usuário: `corrigirDescansos`
  // só SOBE o intervalo, então quem tinha baixado um descanso de propósito o
  // recebia de volta no valor da regra toda vez que o catálogo crescesse. E o
  // motivo do DELETE nem existia: catálogo novo entra em `exercises`, não em
  // `routine_exercises` — nenhum exercício recém-inserido está na rotina de
  // ninguém, então não há descanso de rotina a recalcular. Quem precisa do
  // descanso certo é a linha do CATÁLOGO, e ela é escrita por
  // `classificarExercicios` logo abaixo. G2.1 não criou este mecanismo, mas
  // multiplicou a magnitude dele ao fazer a regra nova valer para todo mundo.
  await db.runAsync('UPDATE exercises SET eh_composto = 0');
}

/**
 * Dica do catálogo que CONTRADIZIA a prescrição do app, corrigida no lugar.
 *
 * ── O caso, achado na validação de tela do G3 ────────────────────────────
 *
 * `Panturrilha em pé` pedia "pausa embaixo" na dica enquanto o card de cadência,
 * três centímetros acima, prescrevia **2-0-1** — pausa zero. A pausa de 1 s foi
 * medida e rejeitada de propósito (custava 1.184 séries na grade de 1.350
 * perfis, por algo que Krzysztofik 2019 não prescreve), então quem está errado é
 * o texto antigo.
 *
 * ── E quem já está com o banco montado? ──────────────────────────────────
 *
 * `completarCatalogo` só INSERE o que falta: corrigir o seed não corrige o
 * aparelho de ninguém. Este passo escreve o texto novo por NOME, e é a mesma
 * forma de `renomearExercicios` — lista declarada, curta, idempotente (o WHERE
 * só acha o texto velho), e escreve numa coluna só de UMA tabela. `set_logs`,
 * `personal_records` e `routine_exercises` não aparecem em cláusula nenhuma.
 *
 * A lista é declarada de propósito, e não "sincronize tudo do seed": reescrever
 * em massa texto que o app mostra é o tipo de passo que passa despercebido e
 * apaga correção feita à mão. Aqui entra só o que contradiz uma prescrição.
 */
const DICAS_CORRIGIDAS: [nome: string, de: string, para: string][] = [
  [
    'Panturrilha em pé',
    'Amplitude total e pausa embaixo. Meia amplitude não desenvolve panturrilha.',
    'Amplitude total, sem quicar embaixo. Meia amplitude não desenvolve panturrilha.',
  ],
];

async function sincronizarDicas(db: SQLite.SQLiteDatabase) {
  for (const [nome, de, para] of DICAS_CORRIGIDAS) {
    await db.runAsync('UPDATE exercises SET dica = ? WHERE nome = ? AND dica = ?', [para, nome, de]);
  }
}

async function classificarExercicios(db: SQLite.SQLiteDatabase) {
  const marcados = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM exercises WHERE eh_composto = 1'
  );
  if ((marcados?.n ?? 0) > 0) return; // já classificado

  for (const nome of COMPOSTOS) {
    await db.runAsync('UPDATE exercises SET eh_composto = 1 WHERE nome = ?', [nome]);
  }

  // Guarda o descanso ideal no próprio catálogo, para rotinas novas já nascerem
  // com o valor certo.
  // Só roda em banco recém-criado (o `return` acima corta quando já existe
  // exercício classificado), então aqui a regra NOVA é a certa: ninguém tem
  // rotina montada ainda para ser reescrita por baixo.
  //
  // `equipamento` entra na conta porque é ele que dá a demanda de
  // estabilização — sem ele, supino com barra e supino máquina recebiam o
  // mesmo descanso padrão, que é justamente a distinção de B6.
  const exs = await db.getAllAsync<{
    id: number;
    nome: string;
    grupo_primario: string;
    equipamento: string | null;
  }>('SELECT id, nome, grupo_primario, equipamento FROM exercises');
  for (const e of exs) {
    await db.runAsync('UPDATE exercises SET descanso_padrao = ? WHERE id = ?', [
      descansoCorreto(e.nome, 10, e.grupo_primario, undefined, e.equipamento),
      e.id,
    ]);
  }
}

/**
 * Preenche `papel` e RIR nas rotinas anteriores à v16 — pelo contexto do DIA.
 *
 * ── E quem já está com o banco estragado? ────────────────────────────────
 *
 * Ele é atendido aqui, sem tocar em nada que seja histórico. Este passo roda em
 * `normalizar`, a cada abertura do banco, e escreve em UMA tabela só:
 * `routine_exercises`, e só nas linhas em que `papel IS NULL`. `set_logs`,
 * `personal_records`, `point_events` e `workout_sessions` não aparecem nem numa
 * cláusula — o histórico, os recordes e o XP saem de lá e continuam exatamente
 * como estavam. Nenhuma linha é criada, nenhuma é apagada. Rodar dez vezes é
 * igual a rodar uma, porque a segunda passada não encontra mais NULL.
 *
 * ── Por que por DIA, e não por linha ─────────────────────────────────────
 *
 * Papel é propriedade da SESSÃO. Ler a linha isolada dá a resposta certa no
 * primeiro exercício do grupo e errada em todos os seguintes: o segundo supino
 * do dia é complementar, não principal — a diferença é 150 s contra 180 s e
 * RIR 1-2 contra 2-3. Foi exatamente por isso que G2 preferiu não mexer no
 * plano de quem já usava: o fallback sem papel trata todo multiarticular como
 * principal, e aplicar a regra nova sobre ele daria descanso ERRADO, não só
 * diferente (medido: 4 de 5 linhas mudando e a sessão ganhando 7 minutos).
 *
 * Com a coluna preenchida pelo contexto do dia, a regra nova passa a valer para
 * todo mundo de uma vez — e as telas param de deduzir papel em runtime, que era
 * a segunda fonte de verdade. `papeisDaRotina` é a MESMA função que a tela do
 * dia e o executor usam; nada aqui reimplementa a regra.
 *
 * ── O que este passo NÃO preenche, e por quê ─────────────────────────────
 *
 * `aquecimento_series` fica em 0. Aproximação é prescrição NOVA (duas séries a
 * mais no principal), não correção de um dado ausente — a rotina antiga não as
 * tinha porque ninguém as prescreveu, e inventá-las por baixo mudaria o treino
 * de quem não pediu. Quem quiser as aproximações refaz o treino, e aí elas
 * nascem com o resto.
 */
async function preencherPapeis(db: SQLite.SQLiteDatabase) {
  const linhas = await db.getAllAsync<{
    id: number;
    dia: number;
    nome: string;
    grupo: string;
    equipamento: string | null;
    tipoCarga: string | null;
    papel: string | null;
  }>(
    // ── Só a rotina ATIVA ───────────────────────────────────────────────
    //
    // "Refazer meu treino" arquiva a anterior com `ativa = 0` e nada mais lê
    // aquelas linhas — a tela do dia, o executor e a auditoria de volume todos
    // filtram por `r.ativa = 1`. Reescrever papel e RIR ali era escrita
    // invisível: custo de UPDATE em rotina que ninguém abre, e mais linhas
    // tocadas do que o necessário num banco que já teve quatro planos. O
    // histórico das rotinas velhas mora em `set_logs`, que este passo não toca
    // de qualquer forma.
    `SELECT re.id, re.routine_day_id AS dia, e.nome, e.grupo_primario AS grupo,
            e.equipamento, e.tipo_carga AS tipoCarga, re.papel
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
       JOIN routine_days rd ON rd.id = re.routine_day_id
       JOIN routines r ON r.id = rd.routine_id
      WHERE r.ativa = 1
      ORDER BY re.routine_day_id, re.ordem, re.id`
  );
  if (!linhas.length) return;

  const porDia = new Map<number, typeof linhas>();
  for (const l of linhas) {
    if (!porDia.has(l.dia)) porDia.set(l.dia, []);
    porDia.get(l.dia)!.push(l);
  }

  let preenchidas = 0;
  for (const doDia of porDia.values()) {
    // `papeisDaRotina` devolve o papel GRAVADO quando ele existe e o derivado
    // quando não — por isso a escolha de alguém nunca é sobrescrita, e por isso
    // um dia meio preenchido converge para o resto sem virar dois critérios.
    const papeis = papeisDaRotina(doDia);
    for (const l of doDia) {
      if (l.papel) continue; // já resolvida: idempotência mora aqui
      const papel = papeis.get(l.id)?.papel;
      if (!papel) continue; // cardio: papel não se aplica, e inventar um mente

      // Série por TEMPO não tem "repetição que sobrou" para contar, e o
      // excêntrico puro também não — `prescricaoDe` já devolve `rir: null` no
      // segundo caso, e o primeiro é decidido aqui, como no gerador.
      const pres = prescricaoDe(papel, l.nome, l.grupo, l.equipamento, l.tipoCarga);
      const rir = l.tipoCarga === 'tempo' ? null : pres.rir;

      await db.runAsync(
        'UPDATE routine_exercises SET papel = ?, rir_min = ?, rir_max = ? WHERE id = ?',
        [papel, rir?.[0] ?? null, rir?.[1] ?? null, l.id]
      );
      preenchidas++;
    }
  }

  if (preenchidas > 0) {
    console.log(
      `[forja] papel e esforço (RIR) preenchidos em ${preenchidas} exercício(s) das suas rotinas`
    );
  }
}

/**
 * Ajusta o descanso das rotinas já existentes.
 *
 * Só sobe, nunca desce: se a pessoa configurou 4 minutos de propósito, isso é
 * escolha dela. O que corrigimos é o valor curto demais herdado do catálogo.
 *
 * ── O fallback sem papel morreu, e por quê ───────────────────────────────
 *
 * Até G2 esta função tinha dois ramos: a linha com papel usava a regra nova, a
 * sem papel usava `descansoLegado` (a regra pré-G2, que saía de "é composto?" +
 * repetições). O motivo era bom — sem papel, a regra nova erra — mas a solução
 * era conservar a regra velha para sempre em metade da base. Com `preencherPapeis`
 * rodando logo acima, `papel` NULL só sobra em cardio, e ali o descanso é 0 de
 * qualquer forma. Uma regra só, para todo mundo. `descansoLegado` foi apagado
 * de `papel.ts` junto: função morta com regra velha não é neutra — é a que a
 * próxima pessoa acha primeiro, e foi assim que `descansoSugerido` sobreviveu
 * até A5.
 *
 * A flag subiu para `descansos_v4` de propósito: quem já tem `descansos_v3`
 * gravada nunca mais rodaria este passo, e é justamente essa pessoa — a que já
 * usa o app — que a decisão do Leonardo mandou atender.
 */
const FLAG_DESCANSO = 'descansos_v4';

async function corrigirDescansos(db: SQLite.SQLiteDatabase) {
  const jaFeito = await db.getFirstAsync<{ v: string }>(
    `SELECT value AS v FROM app_flags WHERE key = '${FLAG_DESCANSO}'`
  ).catch(() => null);
  if (jaFeito?.v) return;

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
  const flag = await db.getFirstAsync<{ v: string }>(
    `SELECT value AS v FROM app_flags WHERE key = '${FLAG_DESCANSO}'`
  );
  if (flag?.v) return;

  const linhas = await db.getAllAsync<{
    id: number;
    nome: string;
    grupo: string;
    equipamento: string | null;
    tipoCarga: string | null;
    papel: string | null;
    reps_max: number | null;
    descanso_seg: number;
  }>(
    // Mesma razão de `preencherPapeis`: rotina arquivada não é lida por tela
    // nenhuma, e subir o descanso dela é escrita que ninguém vê.
    `SELECT re.id, e.nome, e.grupo_primario AS grupo, e.equipamento,
            e.tipo_carga AS tipoCarga, re.papel, re.reps_max, re.descanso_seg
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
       JOIN routine_days rd ON rd.id = re.routine_day_id
       JOIN routines r ON r.id = rd.routine_id
      WHERE r.ativa = 1`
  );

  let ajustadas = 0;
  const subiram: string[] = [];
  for (const l of linhas) {
    const papel = (l.papel as Papel | null) ?? undefined;
    const ideal = descansoCorreto(
      l.nome,
      l.reps_max ?? 10,
      l.grupo,
      papel,
      l.equipamento,
      l.tipoCarga
    );
    if (ideal > l.descanso_seg) {
      await db.runAsync('UPDATE routine_exercises SET descanso_seg = ? WHERE id = ?', [ideal, l.id]);
      ajustadas++;
      if (subiram.length < 3) subiram.push(`${l.nome} ${l.descanso_seg}→${ideal}s`);
    }
    // Marca composto na linha da rotina — a tela usa para explicar o descanso.
    await db.runAsync('UPDATE routine_exercises SET eh_composto = ? WHERE id = ?', [
      COMPOSTOS.includes(l.nome) ? 1 : 0,
      l.id,
    ]);
  }

  await db.runAsync(`INSERT OR REPLACE INTO app_flags (key, value) VALUES ('${FLAG_DESCANSO}', ?)`, [
    String(ajustadas),
  ]);
  // A marca da rodada anterior sai junto. Ela não controla mais nada, e flag
  // órfã com nome de flag viva é o mesmo problema de `descansoLegado`: a
  // próxima pessoa acha `descansos_v3` no banco e passa meia hora procurando
  // quem a lê.
  await db.runAsync(`DELETE FROM app_flags WHERE key = 'descansos_v3'`);

  // O log diz o que ACONTECEU, não o que a função faria. Antes ele dizia
  // "descanso corrigido em N" sem N nenhum de referência e sem dizer para
  // quanto; quando ele aparecia depois de uma mudança de regra, não dava para
  // saber se a regra nova tinha pegado ou se o número vinha do catálogo.
  if (ajustadas > 0) {
    console.log(
      `[forja] descanso corrigido em ${ajustadas} de ${linhas.length} exercício(s) das suas ` +
        `rotinas, agora pelo papel de cada um — ex.: ${subiram.join(', ')}`
    );
  }
}

export { COMPOSTOS_PESADOS };
