import type * as SQLite from 'expo-sqlite';
import { COMPOSTOS, COMPOSTOS_PESADOS } from '@/features/treino/classificacao';
import { descansoCorreto, descansoLegado, type Papel } from '@/features/treino/papel';
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
  await classificarExercicios(db);
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
  // O CREATE não é redundante: `app_flags` nasce lá embaixo, dentro de
  // `corrigirDescansos`, e num banco que ainda não chegou lá o DELETE estoura.
  // Como `normalizar` roda dentro da abertura do banco, isso não daria um erro
  // discreto — daria o app inteiro sem abrir.
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
  await db.runAsync(`DELETE FROM app_flags WHERE key = 'descansos_v3'`);
  await db.runAsync('UPDATE exercises SET eh_composto = 0');
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
 * Ajusta o descanso das rotinas já existentes.
 *
 * Só sobe, nunca desce: se a pessoa configurou 4 minutos de propósito, isso é
 * escolha dela. O que corrigimos é o valor curto demais herdado do catálogo.
 */
async function corrigirDescansos(db: SQLite.SQLiteDatabase) {
  const jaFeito = await db.getFirstAsync<{ v: string }>(
    `SELECT value AS v FROM app_flags WHERE key = 'descansos_v3'`
  ).catch(() => null);
  if (jaFeito?.v) return;

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
  const flag = await db.getFirstAsync<{ v: string }>(
    `SELECT value AS v FROM app_flags WHERE key = 'descansos_v3'`
  );
  if (flag?.v) return;

  const linhas = await db.getAllAsync<{
    id: number;
    nome: string;
    grupo: string;
    equipamento: string | null;
    papel: string | null;
    reps_max: number | null;
    descanso_seg: number;
  }>(
    `SELECT re.id, e.nome, e.grupo_primario AS grupo, e.equipamento, re.papel,
            re.reps_max, re.descanso_seg
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id`
  );

  let ajustadas = 0;
  for (const l of linhas) {
    // ── A linha com papel usa a regra nova; a sem papel, a antiga ──────────
    //
    // Rotina anterior à v16 não tem papel, e sem ele a regra nova trata todo
    // multiarticular como principal — falso a partir do segundo exercício do
    // grupo. Aplicar isso aqui faria o plano que já está no aparelho ganhar
    // ~7 min por sessão sozinho, sem ninguém pedir, estourando o tempo para o
    // qual ele foi dimensionado. Rotina que funciona em produção só muda por
    // decisão do dono: quando ele refizer o treino, ela nasce com papel e com
    // a regra nova de uma vez.
    const papel = (l.papel as Papel | null) ?? null;
    const ideal = papel
      ? descansoCorreto(l.nome, l.reps_max ?? 10, l.grupo, papel, l.equipamento)
      : descansoLegado(l.nome, l.reps_max ?? 10, l.grupo);
    if (ideal > l.descanso_seg) {
      await db.runAsync('UPDATE routine_exercises SET descanso_seg = ? WHERE id = ?', [ideal, l.id]);
      ajustadas++;
    }
    // Marca composto na linha da rotina — a tela usa para explicar o descanso.
    await db.runAsync('UPDATE routine_exercises SET eh_composto = ? WHERE id = ?', [
      COMPOSTOS.includes(l.nome) ? 1 : 0,
      l.id,
    ]);
  }

  await db.runAsync(`INSERT OR REPLACE INTO app_flags (key, value) VALUES ('descansos_v3', ?)`, [
    String(ajustadas),
  ]);

  if (ajustadas > 0) {
    console.log(`[forja] descanso corrigido em ${ajustadas} exercício(s) das suas rotinas`);
  }
}

export { COMPOSTOS_PESADOS };
