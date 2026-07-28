import { Platform } from 'react-native';
import { all, getDb, run } from '@/db/client';

/**
 * Backup e restauração.
 *
 * ── Por que isto existe ──────────────────────────────────────────────────
 *
 * O app guarda tudo no dispositivo: nada de nuvem, nada de conta. Isso é bom —
 * funciona no modo avião, ninguém vê seus dados, custo zero. E tem um preço
 * que só aparece no pior dia: **limpar os dados do navegador apaga meses de
 * histórico e não existe cópia em lugar nenhum.**
 *
 * No iPhone o risco é maior do que parece. O Safari descarta o armazenamento
 * de sites que ficam semanas sem ser abertos. Um PWA instalado na tela inicial
 * é mais resistente, mas não imune.
 *
 * Nenhum app resolve isso pedindo desculpa depois. Resolve gerando um arquivo
 * antes — e lembrando de gerar.
 *
 * ── O que vai no arquivo ─────────────────────────────────────────────────
 *
 * Tudo que você produziu: perfil, medidas, séries, treinos, refeições, água,
 * passos, check-ins. Fora catálogo (exercícios, alimentos), que o app
 * reconstrói sozinho — incluir isso só engordaria o arquivo.
 */

/** Tabelas com dados do usuário. Catálogo fica de fora: o seed recria. */
const TABELAS = [
  'profile',
  'perfis',
  'body_metrics',
  'nutrition_targets',
  'routines',
  'routine_days',
  'routine_exercises',
  'workout_sessions',
  'set_logs',
  'personal_records',
  'meal_logs',
  'meal_log_items',
  'water_logs',
  'passos_log',
  'checkin_log',
  'mobilidade_log',
  'sono_log',
  'rotina_log',
  'point_events',
  'achievements',
  'food_prefs',
  'diet_config',
  'substituicoes',
  'notas_exercicio',
];

/**
 * Fotos ficam fora por padrão.
 *
 * Uma foto reduzida ocupa perto de 200 KB; o resto do histórico inteiro — anos
 * de séries, refeições e medidas — não chega a 2 MB. Incluir as fotos multiplica
 * o arquivo por dez ou mais, e um arquivo grande demais é um arquivo que a
 * pessoa desiste de gerar toda semana.
 *
 * Então é escolha explícita, com o tamanho na tela antes de decidir.
 */
const TABELA_FOTOS = 'fotos_progresso';

export interface Backup {
  versao: 1;
  app: 'forja';
  criado_em: string;
  comFotos?: boolean;
  tabelas: Record<string, Record<string, unknown>[]>;
}

export async function gerarBackup(comFotos = false): Promise<Backup> {
  const tabelas: Record<string, Record<string, unknown>[]> = {};
  const lista = comFotos ? [...TABELAS, TABELA_FOTOS] : TABELAS;
  for (const t of lista) {
    try {
      tabelas[t] = await all<Record<string, unknown>>(`SELECT * FROM ${t}`);
    } catch {
      // Tabela pode não existir em banco antigo — backup parcial é melhor que
      // backup nenhum, então segue.
    }
  }
  return { versao: 1, app: 'forja', criado_em: new Date().toISOString(), comFotos, tabelas };
}

export function resumirBackup(b: Backup) {
  return {
    treinos: b.tabelas.workout_sessions?.length ?? 0,
    series: b.tabelas.set_logs?.length ?? 0,
    medidas: b.tabelas.body_metrics?.length ?? 0,
    recordes: b.tabelas.personal_records?.length ?? 0,
    dias: (() => {
      const s = b.tabelas.workout_sessions ?? [];
      if (!s.length) return 0;
      const inicios = s.map((x) => Number(x.iniciado_em)).filter(Boolean);
      if (!inicios.length) return 0;
      return Math.round((Date.now() - Math.min(...inicios)) / 86400000);
    })(),
  };
}

/** Nome com data: `forja-2026-07-27.json`. Ordenar a pasta já ordena por tempo. */
export function nomeDoArquivo(): string {
  return `forja-${new Date().toISOString().slice(0, 10)}.json`;
}

/**
 * Exporta no aplicativo instalado.
 *
 * No Android o app escreve numa pasta que só ele enxerga — um arquivo salvo lá
 * e nunca compartilhado é backup no papel e nada na prática, porque some junto
 * com o app se o aparelho for trocado. Por isso escreve e abre a folha de
 * compartilhamento na mesma ação: o arquivo só vira backup quando sai daqui.
 */
async function exportarNativo(comFotos: boolean): Promise<boolean> {
  try {
    const [{ File, Paths }, Sharing] = await Promise.all([
      import('expo-file-system'),
      import('expo-sharing'),
    ]);
    if (!(await Sharing.isAvailableAsync())) return false;

    const b = await gerarBackup(comFotos);
    const arquivo = new File(Paths.cache, nomeDoArquivo());
    if (arquivo.exists) arquivo.delete();
    arquivo.create();
    arquivo.write(JSON.stringify(b));

    await Sharing.shareAsync(arquivo.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Salvar backup da Forja',
      UTI: 'public.json',
    });
    marcarBackupFeito();
    return true;
  } catch {
    return false;
  }
}

export async function baixarBackup(comFotos = false): Promise<boolean> {
  if (Platform.OS !== 'web') return exportarNativo(comFotos);
  try {
    const b = await gerarBackup(comFotos);
    const doc = (globalThis as unknown as { document?: Document }).document;
    const URLc = (globalThis as unknown as { URL?: typeof URL }).URL;
    const Blobc = (globalThis as unknown as { Blob?: typeof Blob }).Blob;
    if (!doc || !URLc || !Blobc) return false;

    const url = URLc.createObjectURL(new Blobc([JSON.stringify(b)], { type: 'application/json' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = nomeDoArquivo();
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(() => URLc.revokeObjectURL(url), 2000);
    marcarBackupFeito();
    return true;
  } catch {
    return false;
  }
}

/**
 * Restaura substituindo o conteúdo das tabelas do usuário.
 *
 * Substitui em vez de mesclar: mesclar dois históricos duplicaria séries e
 * quebraria os recordes derivados delas. Restaurar é voltar para um ponto no
 * tempo, não somar dois aparelhos.
 */
export async function restaurar(b: Backup): Promise<{ ok: boolean; erro?: string }> {
  if (b.app !== 'forja' || b.versao !== 1) {
    return { ok: false, erro: 'Arquivo não é um backup da Forja.' };
  }
  const db = await getDb();
  try {
    await db.execAsync('PRAGMA foreign_keys = OFF');
    for (const t of [...TABELAS, TABELA_FOTOS]) {
      const linhas = b.tabelas[t];
      if (!linhas) continue;
      try {
        await run(`DELETE FROM ${t}`);
      } catch {
        continue; // tabela não existe neste banco
      }
      for (const l of linhas) {
        const cols = Object.keys(l);
        if (!cols.length) continue;
        const marcas = cols.map(() => '?').join(',');
        try {
          await run(
            `INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${marcas})`,
            cols.map((c) => l[c] as string | number | null)
          );
        } catch {
          // Coluna que não existe mais nesta versão: pula a linha e segue.
        }
      }
    }
    await db.execAsync('PRAGMA foreign_keys = ON');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

// ── Lembrete ──────────────────────────────────────────────────────────────

const CHAVE = 'forja.backup.ultimo';

function armazem(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function marcarBackupFeito() {
  try {
    armazem()?.setItem(CHAVE, String(Date.now()));
  } catch {
    /* ignorado */
  }
}

export function diasDesdeBackup(): number | null {
  const v = armazem()?.getItem(CHAVE);
  if (!v) return null;
  return Math.floor((Date.now() - Number(v)) / 86400000);
}

/**
 * Quando cobrar. Trinta dias é o intervalo em que a perda ainda dói pouco:
 * refazer um mês de registro é chato, refazer seis é motivo para largar o app.
 */
export function precisaBackup(): boolean {
  const d = diasDesdeBackup();
  return d === null || d >= 30;
}
