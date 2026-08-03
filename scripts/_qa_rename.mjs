/** Cenários do rename que o teste 6 não cobre. NAO faz parte do projeto. */
import { DatabaseSync } from 'node:sqlite';
import { DDL } from '../src/db/schema.ts';
import { aplicarMigracoes } from '../src/db/migrar.ts';
import { normalizar } from '../src/db/normalizar.ts';
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';

const adaptar = (db) => ({
  execAsync: async (sql) => void db.exec(sql),
  getFirstAsync: async (sql, ps = []) => db.prepare(sql).get(...ps) ?? null,
  getAllAsync: async (sql, ps = []) => db.prepare(sql).all(...ps),
  runAsync: async (sql, ps = []) => db.prepare(sql).run(...ps),
});

const novo = async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(DDL);
  await aplicarMigracoes(adaptar(db));
  return db;
};

const inserir = (db, nome, extra = {}) =>
  db.prepare(
    `INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga, media_url, is_custom)
     VALUES (?,?,?,?,?,?,?)`
  ).run(nome, extra.grupo ?? 'peito', extra.sec ?? 'ombro', 'cabo', 'peso_reps', extra.media ?? '.../X', extra.custom ?? 0);

const linhas = (db) =>
  db.prepare(`SELECT id, nome, grupos_secundarios, media_url, eh_composto, is_custom FROM exercises
              WHERE nome IN ('Crossover na polia baixa','Supino na polia') ORDER BY id`).all();

console.log('=== CENÁRIO 1: usuário já tem exercício CUSTOM chamado "Supino na polia" ===');
{
  const db = await novo();
  inserir(db, 'Crossover na polia baixa', { media: '.../Cable_Chest_Press' });
  inserir(db, 'Supino na polia', { custom: 1, media: null, sec: '' });
  const velho = db.prepare(`SELECT id FROM exercises WHERE nome='Crossover na polia baixa'`).get().id;
  // histórico preso no nome errado
  db.prepare(`INSERT INTO routines (nome, ativa, criado_em) VALUES ('T',1,0)`).run();
  db.prepare(`INSERT INTO routine_days (routine_id, nome, ordem) VALUES (1,'A',0)`).run();
  db.prepare(`INSERT INTO routine_exercises (routine_day_id, exercise_id, ordem, series_alvo, descanso_seg) VALUES (1,?,0,3,150)`).run(velho);
  db.prepare(`INSERT INTO workout_sessions (nome, iniciado_em) VALUES ('A',0)`).run();
  db.prepare(`INSERT INTO set_logs (session_id, exercise_id, serie_index, peso_kg, reps, registrado_em) VALUES (1,?,1,40,10,0)`).run(velho);

  await normalizar(adaptar(db));
  await normalizar(adaptar(db)); // 2a abertura
  console.table(linhas(db));
  const total = db.prepare('SELECT COUNT(*) AS n FROM exercises').get().n;
  console.log(`catálogo: ${total} linhas (seed tem ${EXERCICIOS.length})`);
  console.log(`>>> "Crossover na polia baixa" ainda existe? ${!!db.prepare(`SELECT 1 FROM exercises WHERE nome='Crossover na polia baixa'`).get()}`);
}

console.log('\n=== CENÁRIO 2: banco antigo COMPLETO (nome velho + resto do catálogo) ===');
{
  const db = await novo();
  for (const [nome, grupo, sec, equip, carga, slug] of EXERCICIOS) {
    if (nome === 'Supino na polia') { inserir(db, 'Crossover na polia baixa', { grupo, sec: 'ombro', media: '.../Cable_Chest_Press' }); continue; }
    db.prepare(`INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga, media_url)
                VALUES (?,?,?,?,?,?)`).run(nome, grupo, sec, equip, carga, slug ?? null);
  }
  // simula banco JÁ CLASSIFICADO (é o estado real de quem usa o app)
  db.prepare(`UPDATE exercises SET eh_composto = 1 WHERE nome = 'Crossover na polia baixa'`).run();
  db.exec(`CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.prepare(`INSERT OR REPLACE INTO app_flags (key,value) VALUES ('descansos_v3','0')`).run();

  const antes = db.prepare(`SELECT id, eh_composto, descanso_padrao FROM exercises WHERE nome='Crossover na polia baixa'`).get();
  await normalizar(adaptar(db));
  const depois = db.prepare(`SELECT id, nome, eh_composto, descanso_padrao FROM exercises WHERE id=?`).get(antes.id);
  console.log('antes :', antes);
  console.log('depois:', depois);
  console.log(`total no catálogo: ${db.prepare('SELECT COUNT(*) AS n FROM exercises').get().n} (seed: ${EXERCICIOS.length})`);
}

console.log('\n=== CENÁRIO 3: id do rename bate com o id do seed novo? (backup não leva `exercises`) ===');
{
  const fresco = await novo();
  for (const [nome, grupo, sec, equip, carga, slug] of EXERCICIOS)
    fresco.prepare(`INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga, media_url)
                    VALUES (?,?,?,?,?,?)`).run(nome, grupo, sec, equip, carga, slug ?? null);
  const idFresco = fresco.prepare(`SELECT id FROM exercises WHERE nome='Supino na polia'`).get().id;

  const antigo = await novo();
  for (const [nome, grupo, sec, equip, carga, slug] of EXERCICIOS) {
    const n = nome === 'Supino na polia' ? 'Crossover na polia baixa' : nome;
    antigo.prepare(`INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga, media_url)
                    VALUES (?,?,?,?,?,?)`).run(n, grupo, sec, equip, carga, slug ?? null);
  }
  await normalizar(adaptar(antigo));
  const idRenomeado = antigo.prepare(`SELECT id FROM exercises WHERE nome='Supino na polia'`).get().id;
  console.log(`id em instalação nova = ${idFresco} | id após rename em banco antigo = ${idRenomeado} | ${idFresco === idRenomeado ? 'BATEM (backup/restore preserva o vínculo)' : '*** DIVERGEM'}`);
}
