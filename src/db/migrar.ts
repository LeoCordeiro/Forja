import { MIGRACOES } from './migracoes';

/**
 * O mínimo de banco que a migração precisa.
 *
 * Existe para que esta lógica possa rodar fora do React Native — o teste em
 * `scripts/testar-migracao.mjs` roda estas mesmas funções contra o SQLite do
 * Node. Sem isso, o único jeito de verificar um bug de migração seria quebrar
 * um aparelho de verdade e ver o que acontece, que foi exatamente como o
 * `custo_100g` chegou até o iPhone do usuário.
 */
export interface BancoSQL {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  getAllAsync<T>(sql: string): Promise<T[]>;
}

/**
 * Comentários saem ANTES de dividir por ';'. Um ponto e vírgula dentro de
 * comentário — `data:image/jpeg;base64` foi o caso real — partia o comando ao
 * meio e derrubava a criação da tabela, enquanto o `user_version` subia do
 * mesmo jeito. Resultado: migração marcada como aplicada e tabela inexistente,
 * sem jeito de rodar de novo.
 */
export function semComentarios(sql: string) {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
}

/** Aplica os degraus pendentes, curando o banco se a marca estiver mentindo. */
export async function aplicarMigracoes(db: BancoSQL) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let atual = row?.user_version ?? 0;

  if (atual > 0 && !(await marcaConfere(db, atual))) {
    console.warn(`[migração] banco diz v${atual} mas não tem o esquema da v${atual} — refazendo`);
    atual = 0;
  }

  for (const m of MIGRACOES) {
    if (m.versao <= atual) continue;
    // Comando a comando: um ALTER TABLE de coluna que já existe (banco criado
    // pelo DDL novo) não pode derrubar o resto da migração.
    for (const cmd of semComentarios(m.sql).split(';')) {
      const sql = cmd.trim();
      if (!sql) continue;
      try {
        await db.execAsync(sql);
      } catch (e) {
        const msg = String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[migração]', m.versao, sql.slice(0, 60), msg);
        }
      }
    }
    await db.execAsync(`PRAGMA user_version = ${m.versao}`);
  }
}

/**
 * O `user_version` está dizendo a verdade?
 *
 * ── O bug que isto conserta ────────────────────────────────────────────────
 *
 * `user_version` é pragma do BANCO, não da tabela: sobrevive ao DROP TABLE. A
 * versão antiga do "apagar dados" dropava tudo, reaplicava o DDL e parava aí —
 * o banco voltava ao esquema base ainda jurando estar na última versão. Daí
 * nenhuma migração rodava de novo e o app abria com metade das colunas
 * faltando. No iPhone isso apareceu como `table foods has no column named
 * custo_100g`, que é o seed tentando gravar numa coluna criada na v3.
 *
 * Consertar o reset (já feito) impede o estrago novo, mas não cura quem já
 * quebrou — e o aparelho quebrado não tem como rodar o reset, porque o app nem
 * abre. Por isso a checagem é na abertura.
 *
 * O que cada migração promete sai do próprio SQL dela: nenhuma lista de
 * sentinelas para manter em paralelo, nada que esquecer na próxima migração.
 */
export async function marcaConfere(db: BancoSQL, atual: number) {
  const esperado = MIGRACOES.filter((m) => m.versao <= atual);
  if (!esperado.length) return true;

  const tabelas = new Map<string, Set<string>>();
  for (const t of await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table'`
  )) {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${t.name}")`);
    tabelas.set(t.name, new Set(cols.map((c) => c.name)));
  }

  for (const m of esperado) {
    const sql = semComentarios(m.sql);
    for (const [, nome] of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/gi)) {
      if (!tabelas.has(nome)) return false;
    }
    for (const [, tabela, coluna] of sql.matchAll(/ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/gi)) {
      // Tabela ausente aqui é tabela que nasceu numa migração e foi removida
      // noutra — só coluna faltando em tabela que existe é sinal de estrago.
      if (tabelas.has(tabela) && !tabelas.get(tabela)!.has(coluna)) return false;
    }
  }
  return true;
}
