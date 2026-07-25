import { all, first, run } from '@/db/client';
import type {
  Food,
  Macros,
  MealLogItem,
  Recipe,
  RecipeIngredientFull,
  RecipeStep,
  TipoRefeicao,
} from '@/db/types';
import { hoje, somarDias } from '@/shared/utils/date';
import { metaAtual } from '../perfil/api';

// ─────────────────────────── ALIMENTOS ───────────────────────────

export async function listarAlimentos(busca?: string, categoria?: string): Promise<Food[]> {
  const cond: string[] = [];
  const p: string[] = [];
  if (busca?.trim()) {
    cond.push('nome LIKE ?');
    p.push(`%${busca.trim()}%`);
  }
  if (categoria && categoria !== 'todos') {
    cond.push('categoria = ?');
    p.push(categoria);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  return all<Food>(`SELECT * FROM foods ${where} ORDER BY nome COLLATE NOCASE LIMIT 200`, p);
}

export async function criarAlimento(f: Omit<Food, 'id' | 'fonte'>): Promise<number> {
  return run(
    `INSERT INTO foods
       (nome, marca, fonte, porcao_base_g, kcal, proteina_g, carbo_g, gordura_g,
        fibra_g, categoria, medida_caseira, g_por_medida)
     VALUES (?,?,'custom',?,?,?,?,?,?,?,?,?)`,
    [
      f.nome,
      f.marca,
      f.porcao_base_g,
      f.kcal,
      f.proteina_g,
      f.carbo_g,
      f.gordura_g,
      f.fibra_g,
      f.categoria,
      f.medida_caseira,
      f.g_por_medida,
    ]
  );
}

// ─────────────────────────── RECEITAS ───────────────────────────

export interface ReceitaComMacros extends Recipe {
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
  qtd_ingredientes: number;
}

/** Macros da receita = soma dos ingredientes ÷ porções. Nunca armazenado. */
export async function listarReceitas(busca?: string): Promise<ReceitaComMacros[]> {
  const where = busca?.trim() ? 'WHERE r.nome LIKE ?' : '';
  const p = busca?.trim() ? [`%${busca.trim()}%`] : [];
  return all<ReceitaComMacros>(
    `SELECT r.*,
            COALESCE(SUM(f.kcal       * ri.quantidade / 100.0), 0) / r.rendimento_porcoes AS kcal,
            COALESCE(SUM(f.proteina_g * ri.quantidade / 100.0), 0) / r.rendimento_porcoes AS proteina_g,
            COALESCE(SUM(f.carbo_g    * ri.quantidade / 100.0), 0) / r.rendimento_porcoes AS carbo_g,
            COALESCE(SUM(f.gordura_g  * ri.quantidade / 100.0), 0) / r.rendimento_porcoes AS gordura_g,
            COUNT(ri.id) AS qtd_ingredientes
       FROM recipes r
       LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
       LEFT JOIN foods f ON f.id = ri.food_id
       ${where}
      GROUP BY r.id
      ORDER BY r.nome COLLATE NOCASE`,
    p
  );
}

export async function getReceita(id: number): Promise<ReceitaComMacros | null> {
  const rs = await listarReceitas();
  return rs.find((r) => r.id === id) ?? null;
}

export async function ingredientesDaReceita(id: number): Promise<RecipeIngredientFull[]> {
  return all<RecipeIngredientFull>(
    `SELECT ri.*, f.nome, f.kcal, f.proteina_g, f.carbo_g, f.gordura_g, f.categoria
       FROM recipe_ingredients ri
       JOIN foods f ON f.id = ri.food_id
      WHERE ri.recipe_id = ?
      ORDER BY ri.id`,
    [id]
  );
}

export async function passosDaReceita(id: number): Promise<RecipeStep[]> {
  return all<RecipeStep>('SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY ordem', [id]);
}

// ─────────────────────────── DIÁRIO ALIMENTAR ───────────────────────────

export interface RefeicaoDoDia {
  tipo: TipoRefeicao;
  logId: number | null;
  itens: MealLogItem[];
  macros: Macros;
}

export async function refeicoesDoDia(data = hoje()): Promise<RefeicaoDoDia[]> {
  const logs = await all<{ id: number; tipo: TipoRefeicao }>(
    'SELECT id, tipo FROM meal_logs WHERE data = ?',
    [data]
  );

  const out: RefeicaoDoDia[] = [];
  for (const l of logs) {
    const itens = await all<MealLogItem>(
      'SELECT * FROM meal_log_items WHERE meal_log_id = ? ORDER BY id',
      [l.id]
    );
    out.push({
      tipo: l.tipo,
      logId: l.id,
      itens,
      macros: somarMacros(itens),
    });
  }
  return out;
}

function somarMacros(itens: MealLogItem[]): Macros {
  return itens.reduce<Macros>(
    (a, i) => ({
      kcal: a.kcal + i.kcal_snap,
      proteina_g: a.proteina_g + i.prot_snap,
      carbo_g: a.carbo_g + i.carb_snap,
      gordura_g: a.gordura_g + i.gord_snap,
    }),
    { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 }
  );
}

export async function macrosDoDia(data = hoje()): Promise<Macros> {
  const r = await first<Macros>(
    `SELECT COALESCE(SUM(mli.kcal_snap),0) AS kcal,
            COALESCE(SUM(mli.prot_snap),0) AS proteina_g,
            COALESCE(SUM(mli.carb_snap),0) AS carbo_g,
            COALESCE(SUM(mli.gord_snap),0) AS gordura_g
       FROM meal_logs ml
       JOIN meal_log_items mli ON mli.meal_log_id = ml.id
      WHERE ml.data = ?`,
    [data]
  );
  return r ?? { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 };
}

async function garantirLog(data: string, tipo: TipoRefeicao): Promise<number> {
  const existente = await first<{ id: number }>(
    'SELECT id FROM meal_logs WHERE data = ? AND tipo = ?',
    [data, tipo]
  );
  if (existente) return existente.id;
  return run('INSERT INTO meal_logs (data, tipo, registrado_em) VALUES (?,?,?)', [
    data,
    tipo,
    Date.now(),
  ]);
}

/**
 * Registra um alimento consumido.
 *
 * Os macros entram como snapshot: se a tabela nutricional do alimento for
 * corrigida amanhã, o que você comeu hoje continua sendo o que foi.
 */
export async function registrarAlimento(
  tipo: TipoRefeicao,
  food: Food,
  gramas: number,
  data = hoje()
) {
  const logId = await garantirLog(data, tipo);
  const f = gramas / 100;
  await run(
    `INSERT INTO meal_log_items
       (meal_log_id, food_id, nome_snap, quantidade, unidade,
        kcal_snap, prot_snap, carb_snap, gord_snap)
     VALUES (?,?,?,?, 'g', ?,?,?,?)`,
    [
      logId,
      food.id,
      food.nome,
      gramas,
      food.kcal * f,
      food.proteina_g * f,
      food.carbo_g * f,
      food.gordura_g * f,
    ]
  );
}

export async function registrarReceita(
  tipo: TipoRefeicao,
  receita: ReceitaComMacros,
  porcoes = 1,
  data = hoje()
) {
  const logId = await garantirLog(data, tipo);
  await run(
    `INSERT INTO meal_log_items
       (meal_log_id, recipe_id, nome_snap, quantidade, unidade,
        kcal_snap, prot_snap, carb_snap, gord_snap)
     VALUES (?,?,?,?, 'porção', ?,?,?,?)`,
    [
      logId,
      receita.id,
      receita.nome,
      porcoes,
      receita.kcal * porcoes,
      receita.proteina_g * porcoes,
      receita.carbo_g * porcoes,
      receita.gordura_g * porcoes,
    ]
  );
}

export async function removerItem(id: number) {
  await run('DELETE FROM meal_log_items WHERE id = ?', [id]);
  // Refeição sem item não deve continuar existindo e poluindo o dia.
  await run(`DELETE FROM meal_logs
              WHERE id NOT IN (SELECT DISTINCT meal_log_id FROM meal_log_items)`);
}

export async function historicoCalorias(dias = 14) {
  const rows = await all<{ dia: string; kcal: number }>(
    `SELECT ml.data AS dia, COALESCE(SUM(mli.kcal_snap),0) AS kcal
       FROM meal_logs ml
       JOIN meal_log_items mli ON mli.meal_log_id = ml.id
      WHERE ml.data >= ?
      GROUP BY ml.data
      ORDER BY ml.data`,
    [somarDias(hoje(), -dias)]
  );
  return rows;
}

// ─────────────────────────── CARDÁPIO ───────────────────────────

export interface ItemCardapio {
  id: number;
  dia_semana: number;
  tipo: TipoRefeicao;
  plan_meal_id: number;
  recipe_id: number | null;
  food_id: number | null;
  quantidade: number;
  nome: string;
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

export async function planoAtivo() {
  return first<{ id: number; nome: string }>(
    'SELECT id, nome FROM diet_plans WHERE ativo = 1 ORDER BY id DESC LIMIT 1'
  );
}

export async function cardapioDoDia(diaSemana: number): Promise<ItemCardapio[]> {
  const plano = await planoAtivo();
  if (!plano) return [];

  return all<ItemCardapio>(
    `SELECT pmi.id, pm.dia_semana, pm.tipo, pm.id AS plan_meal_id,
            pmi.recipe_id, pmi.food_id, pmi.quantidade,
            COALESCE(r.nome, f.nome) AS nome,
            CASE WHEN pmi.recipe_id IS NOT NULL
                 THEN (SELECT COALESCE(SUM(fo.kcal * ri.quantidade / 100.0),0) / r.rendimento_porcoes
                         FROM recipe_ingredients ri JOIN foods fo ON fo.id = ri.food_id
                        WHERE ri.recipe_id = r.id) * pmi.quantidade
                 ELSE f.kcal * pmi.quantidade / 100.0 END AS kcal,
            CASE WHEN pmi.recipe_id IS NOT NULL
                 THEN (SELECT COALESCE(SUM(fo.proteina_g * ri.quantidade / 100.0),0) / r.rendimento_porcoes
                         FROM recipe_ingredients ri JOIN foods fo ON fo.id = ri.food_id
                        WHERE ri.recipe_id = r.id) * pmi.quantidade
                 ELSE f.proteina_g * pmi.quantidade / 100.0 END AS proteina_g,
            CASE WHEN pmi.recipe_id IS NOT NULL
                 THEN (SELECT COALESCE(SUM(fo.carbo_g * ri.quantidade / 100.0),0) / r.rendimento_porcoes
                         FROM recipe_ingredients ri JOIN foods fo ON fo.id = ri.food_id
                        WHERE ri.recipe_id = r.id) * pmi.quantidade
                 ELSE f.carbo_g * pmi.quantidade / 100.0 END AS carbo_g,
            CASE WHEN pmi.recipe_id IS NOT NULL
                 THEN (SELECT COALESCE(SUM(fo.gordura_g * ri.quantidade / 100.0),0) / r.rendimento_porcoes
                         FROM recipe_ingredients ri JOIN foods fo ON fo.id = ri.food_id
                        WHERE ri.recipe_id = r.id) * pmi.quantidade
                 ELSE f.gordura_g * pmi.quantidade / 100.0 END AS gordura_g
       FROM plan_meals pm
       JOIN plan_meal_items pmi ON pmi.plan_meal_id = pm.id
       LEFT JOIN recipes r ON r.id = pmi.recipe_id
       LEFT JOIN foods f   ON f.id = pmi.food_id
      WHERE pm.diet_plan_id = ? AND pm.dia_semana = ?
      ORDER BY CASE pm.tipo
                 WHEN 'cafe' THEN 0 WHEN 'lanche_manha' THEN 1
                 WHEN 'almoco' THEN 2 WHEN 'lanche_tarde' THEN 3
                 WHEN 'jantar' THEN 4 ELSE 5 END`,
    [plano.id, diaSemana]
  );
}

/**
 * Monta um cardápio de 7 dias a partir das receitas disponíveis, ajustando as
 * porções para chegar perto da meta calórica.
 *
 * Existe para o app não abrir com uma tela de dieta vazia — cardápio em branco
 * é a razão nº 1 de a pessoa desistir do controle alimentar no primeiro dia.
 */
export async function gerarCardapioSemanal(): Promise<number> {
  const meta = await metaAtual();
  const kcalAlvo = meta?.kcal ?? 2200;
  const receitas = await listarReceitas();
  if (receitas.length === 0) throw new Error('Sem receitas cadastradas');

  await run('UPDATE diet_plans SET ativo = 0');
  const planoId = await run(
    'INSERT INTO diet_plans (nome, ativo, inicio) VALUES (?,1,?)',
    ['Cardápio da semana', hoje()]
  );

  // Distribuição clássica: almoço e jantar sustentam o dia, lanches completam.
  const estrutura: [TipoRefeicao, number, string][] = [
    ['cafe', 0.22, '07:00'],
    ['lanche_manha', 0.1, '10:00'],
    ['almoco', 0.3, '12:30'],
    ['lanche_tarde', 0.13, '16:00'],
    ['jantar', 0.25, '19:30'],
  ];

  const porTipo = (tipo: TipoRefeicao) => {
    const leves = receitas.filter((r) => r.kcal > 0 && r.kcal < 400);
    const fortes = receitas.filter((r) => r.kcal >= 400);
    if (tipo === 'almoco' || tipo === 'jantar') return fortes.length ? fortes : receitas;
    return leves.length ? leves : receitas;
  };

  for (let dia = 0; dia < 7; dia++) {
    for (let i = 0; i < estrutura.length; i++) {
      const [tipo, fatia, hora] = estrutura[i];
      const opcoes = porTipo(tipo);
      // Rotaciona por dia para a semana não repetir a mesma refeição sempre.
      const escolhida = opcoes[(dia + i) % opcoes.length];
      if (!escolhida || escolhida.kcal <= 0) continue;

      const alvo = kcalAlvo * fatia;
      const porcoes = Math.max(0.5, Math.round((alvo / escolhida.kcal) * 2) / 2);

      const pmId = await run(
        'INSERT INTO plan_meals (diet_plan_id, dia_semana, tipo, horario) VALUES (?,?,?,?)',
        [planoId, dia, tipo, hora]
      );
      await run(
        `INSERT INTO plan_meal_items (plan_meal_id, recipe_id, quantidade, unidade)
         VALUES (?,?,?, 'porção')`,
        [pmId, escolhida.id, porcoes]
      );
    }
  }

  return planoId;
}

// ─────────────────────────── LISTA DE COMPRAS ───────────────────────────

export interface ItemCompra {
  id: number;
  nome: string;
  quantidade_total: number;
  unidade: string;
  categoria: string | null;
  comprado: number;
}

/**
 * Compila os ingredientes do cardápio num período e gera a lista de compras.
 *
 * Tudo é convertido para gramas antes de somar. Sem essa normalização a lista
 * tentaria juntar "2 colheres" com "300 g" e devolveria um número sem sentido —
 * e lista de compras errada é pior que lista de compras nenhuma.
 */
export async function gerarListaCompras(dias = 7): Promise<number> {
  const plano = await planoAtivo();
  if (!plano) throw new Error('Nenhum cardápio ativo');

  const linhas = await all<{
    food_id: number;
    nome: string;
    categoria: string | null;
    gramas: number;
    medida: string | null;
    g_por_medida: number | null;
  }>(
    `SELECT f.id AS food_id, f.nome, f.categoria,
            SUM(ri.quantidade * pmi.quantidade) AS gramas,
            f.medida_caseira AS medida, f.g_por_medida
       FROM plan_meals pm
       JOIN plan_meal_items pmi ON pmi.plan_meal_id = pm.id
       JOIN recipes r           ON r.id = pmi.recipe_id
       JOIN recipe_ingredients ri ON ri.recipe_id = r.id
       JOIN foods f             ON f.id = ri.food_id
      WHERE pm.diet_plan_id = ? AND pm.dia_semana < ?
      GROUP BY f.id
      ORDER BY f.categoria, f.nome`,
    [plano.id, Math.min(7, dias)]
  );

  // Alimentos avulsos do cardápio (sem receita) entram na mesma lista.
  const avulsos = await all<{
    food_id: number;
    nome: string;
    categoria: string | null;
    gramas: number;
  }>(
    `SELECT f.id AS food_id, f.nome, f.categoria, SUM(pmi.quantidade) AS gramas
       FROM plan_meals pm
       JOIN plan_meal_items pmi ON pmi.plan_meal_id = pm.id
       JOIN foods f ON f.id = pmi.food_id
      WHERE pm.diet_plan_id = ? AND pm.dia_semana < ? AND pmi.food_id IS NOT NULL
      GROUP BY f.id`,
    [plano.id, Math.min(7, dias)]
  );

  const mapa = new Map<number, { nome: string; categoria: string | null; gramas: number }>();
  for (const l of [...linhas, ...avulsos]) {
    const atual = mapa.get(l.food_id);
    mapa.set(l.food_id, {
      nome: l.nome,
      categoria: l.categoria,
      gramas: (atual?.gramas ?? 0) + l.gramas,
    });
  }

  const listaId = await run(
    'INSERT INTO shopping_lists (diet_plan_id, periodo_inicio, periodo_fim, gerada_em) VALUES (?,?,?,?)',
    [plano.id, hoje(), somarDias(hoje(), dias - 1), Date.now()]
  );

  for (const [foodId, v] of mapa) {
    // Acima de 1 kg lê melhor em kg do que "1450 g".
    const emKg = v.gramas >= 1000;
    await run(
      `INSERT INTO shopping_list_items
         (lista_id, food_id, nome, quantidade_total, unidade, categoria)
       VALUES (?,?,?,?,?,?)`,
      [
        listaId,
        foodId,
        v.nome,
        emKg ? Math.round(v.gramas / 10) / 100 : Math.ceil(v.gramas),
        emKg ? 'kg' : 'g',
        v.categoria,
      ]
    );
  }

  return listaId;
}

export async function listaAtual(): Promise<{
  id: number;
  periodo_inicio: string;
  periodo_fim: string;
  itens: ItemCompra[];
} | null> {
  const l = await first<{ id: number; periodo_inicio: string; periodo_fim: string }>(
    'SELECT id, periodo_inicio, periodo_fim FROM shopping_lists ORDER BY gerada_em DESC LIMIT 1'
  );
  if (!l) return null;
  const itens = await all<ItemCompra>(
    'SELECT * FROM shopping_list_items WHERE lista_id = ? ORDER BY categoria, nome',
    [l.id]
  );
  return { ...l, itens };
}

export async function alternarComprado(itemId: number) {
  await run('UPDATE shopping_list_items SET comprado = 1 - comprado WHERE id = ?', [itemId]);
}

export const CATEGORIAS_COMPRA: Record<string, { label: string; emoji: string }> = {
  hortifruti: { label: 'Hortifruti', emoji: '🥬' },
  acougue: { label: 'Açougue e peixaria', emoji: '🥩' },
  laticinios: { label: 'Laticínios', emoji: '🧀' },
  mercearia: { label: 'Mercearia', emoji: '🛒' },
  padaria: { label: 'Padaria', emoji: '🥖' },
  frios: { label: 'Frios', emoji: '🥓' },
  suplementos: { label: 'Suplementos', emoji: '💊' },
};
