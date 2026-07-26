import { all, first, run } from '@/db/client';
import type { DietConfig, FoodPref } from '@/db/types';

/**
 * Preferências alimentares.
 *
 * Cardápio montado sem saber o que a pessoa come vira lista de comida que
 * ninguém prepara. Perguntar antes custa uma tela e muda tudo depois.
 */

export async function listarPreferencias(): Promise<FoodPref[]> {
  return all<FoodPref>('SELECT * FROM food_prefs ORDER BY tipo, termo');
}

export async function definirPreferencia(
  tipo: FoodPref['tipo'],
  termo: string,
  categoria?: string
) {
  await run(
    `INSERT INTO food_prefs (tipo, categoria, termo) VALUES (?,?,?)
     ON CONFLICT(tipo, termo) DO UPDATE SET categoria = excluded.categoria`,
    [tipo, categoria ?? null, termo]
  );
}

export async function removerPreferencia(tipo: string, termo: string) {
  await run('DELETE FROM food_prefs WHERE tipo = ? AND termo = ?', [tipo, termo]);
}

/** Marca as categorias que a pessoa come, apagando o que ficou de fora. */
export async function salvarCategoriasQueCome(chaves: string[]) {
  await run(`DELETE FROM food_prefs WHERE tipo = 'gosta'`);
  for (const c of chaves) await definirPreferencia('gosta', c, c);
}

export async function categoriasQueCome(): Promise<string[]> {
  const rows = await all<{ termo: string }>(`SELECT termo FROM food_prefs WHERE tipo = 'gosta'`);
  return rows.map((r) => r.termo);
}

export async function getConfigDieta(): Promise<DietConfig> {
  let c = await first<DietConfig>('SELECT * FROM diet_config WHERE id = 1');
  if (!c) {
    await run(
      `INSERT OR IGNORE INTO diet_config (id, restricao, tempo_max_preparo, refeicoes_por_dia, cozinha_de_verdade, atualizado_em)
       VALUES (1, 'nenhuma', 45, 5, 1, ?)`,
      [Date.now()]
    );
    c = await first<DietConfig>('SELECT * FROM diet_config WHERE id = 1');
  }
  return c!;
}

export async function salvarConfigDieta(cfg: Partial<DietConfig>) {
  await getConfigDieta();
  await run(
    `UPDATE diet_config SET
       restricao = COALESCE(?, restricao),
       tempo_max_preparo = COALESCE(?, tempo_max_preparo),
       refeicoes_por_dia = COALESCE(?, refeicoes_por_dia),
       cozinha_de_verdade = COALESCE(?, cozinha_de_verdade),
       praticidade = COALESCE(?, praticidade),
       orcamento = COALESCE(?, orcamento),
       faz_marmita = COALESCE(?, faz_marmita),
       atualizado_em = ?
     WHERE id = 1`,
    [
      cfg.restricao ?? null,
      cfg.tempo_max_preparo ?? null,
      cfg.refeicoes_por_dia ?? null,
      cfg.cozinha_de_verdade ?? null,
      cfg.praticidade ?? null,
      cfg.orcamento ?? null,
      cfg.faz_marmita ?? null,
      Date.now(),
    ]
  );
}

/**
 * Filtra receitas pelas preferências.
 *
 * A regra é permissiva de propósito: uma receita só é descartada quando o
 * ingrediente principal está fora. Filtro rígido demais esvazia o cardápio e
 * a pessoa acaba sem opção nenhuma — pior que uma sugestão imperfeita.
 */
export function combinaComPreferencias(
  tags: string[],
  come: string[],
  restricao: string,
  tempoMin: number,
  tempoMax: number
): boolean {
  if (tempoMin > tempoMax) return false;
  if (restricao !== 'nenhuma' && !tags.includes(restricao)) {
    // Restrição só reprova quando a receita tem o ingrediente proibido.
    const proibido: Record<string, string[]> = {
      'sem-lactose': ['laticinio', 'whey'],
      'sem-gluten': ['gluten'],
      vegetariano: ['frango', 'carne', 'peixe'],
    };
    const veto = proibido[restricao] ?? [];
    if (tags.some((t) => veto.includes(t))) return false;
  }

  // Sem preferência declarada, tudo passa.
  if (come.length === 0) return true;

  const principais = ['frango', 'carne', 'peixe', 'ovo', 'whey'];
  const principaisDaReceita = tags.filter((t) => principais.includes(t));
  if (principaisDaReceita.length === 0) return true;

  return principaisDaReceita.some((p) => come.includes(p));
}
