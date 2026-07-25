import { all, first, run } from '@/db/client';

/**
 * Compartilhamento de rotinas por código.
 *
 * Não existe servidor, então não existe "convite" de verdade — o que existe é
 * um código que carrega a rotina inteira dentro dele. Você monta o treino,
 * manda o texto por WhatsApp, a outra pessoa cola no app dela e a rotina
 * aparece igual. Funciona entre aparelhos, offline dos dois lados.
 *
 * Formato: JSON compacto em base64, com prefixo de versão para o importador
 * saber recusar código de uma versão futura em vez de quebrar.
 */

const PREFIXO = 'FORJA1:';

interface RotinaExportada {
  nome: string;
  descricao: string | null;
  autor?: string;
  dias: {
    nome: string;
    cor: string | null;
    exercicios: {
      exercicio: string;
      series: number;
      repsMin: number | null;
      repsMax: number | null;
      descanso: number;
      obs: string | null;
    }[];
  }[];
}

function paraBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function deBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function exportarRotina(routineId: number, autor?: string): Promise<string> {
  const rot = await first<{ nome: string; descricao: string | null }>(
    'SELECT nome, descricao FROM routines WHERE id = ?',
    [routineId]
  );
  if (!rot) throw new Error('Rotina não encontrada');

  const dias = await all<{ id: number; nome: string; cor: string | null }>(
    'SELECT id, nome, cor FROM routine_days WHERE routine_id = ? ORDER BY ordem',
    [routineId]
  );

  const payload: RotinaExportada = { nome: rot.nome, descricao: rot.descricao, autor, dias: [] };

  for (const d of dias) {
    const exs = await all<{
      nome: string;
      series_alvo: number;
      reps_min: number | null;
      reps_max: number | null;
      descanso_seg: number;
      observacao: string | null;
    }>(
      `SELECT e.nome, re.series_alvo, re.reps_min, re.reps_max, re.descanso_seg, re.observacao
         FROM routine_exercises re
         JOIN exercises e ON e.id = re.exercise_id
        WHERE re.routine_day_id = ?
        ORDER BY re.ordem`,
      [d.id]
    );
    payload.dias.push({
      nome: d.nome,
      cor: d.cor,
      // Exercício vai pelo NOME: o id é local de cada aparelho e não serve.
      exercicios: exs.map((e) => ({
        exercicio: e.nome,
        series: e.series_alvo,
        repsMin: e.reps_min,
        repsMax: e.reps_max,
        descanso: e.descanso_seg,
        obs: e.observacao,
      })),
    });
  }

  return PREFIXO + paraBase64(JSON.stringify(payload));
}

export interface ResultadoImport {
  ok: boolean;
  rotina?: string;
  dias?: number;
  exercicios?: number;
  ignorados?: string[];
  erro?: string;
}

export async function importarRotina(codigo: string): Promise<ResultadoImport> {
  const limpo = codigo.trim().replace(/\s/g, '');
  if (!limpo.startsWith(PREFIXO)) {
    return { ok: false, erro: 'Código inválido. Ele deve começar com FORJA1:' };
  }

  let payload: RotinaExportada;
  try {
    payload = JSON.parse(deBase64(limpo.slice(PREFIXO.length)));
  } catch {
    return { ok: false, erro: 'Código corrompido ou incompleto. Copie o texto inteiro.' };
  }

  const exs = await all<{ id: number; nome: string }>('SELECT id, nome FROM exercises');
  const porNome = new Map(exs.map((e) => [e.nome.toLowerCase(), e.id]));

  const routineId = await run(
    'INSERT INTO routines (nome, descricao, ativa, criado_em) VALUES (?,?,1,?)',
    [payload.nome, payload.descricao ?? null, Date.now()]
  );

  const ignorados: string[] = [];
  let total = 0;

  for (let i = 0; i < payload.dias.length; i++) {
    const d = payload.dias[i];
    const dayId = await run(
      'INSERT INTO routine_days (routine_id, nome, cor, ordem) VALUES (?,?,?,?)',
      [routineId, d.nome, d.cor, i]
    );

    for (let k = 0; k < d.exercicios.length; k++) {
      const e = d.exercicios[k];
      const eid = porNome.get(e.exercicio.toLowerCase());
      if (!eid) {
        // Exercício que não existe no catálogo de quem importa: registra e segue.
        ignorados.push(e.exercicio);
        continue;
      }
      await run(
        `INSERT INTO routine_exercises
           (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg, observacao)
         VALUES (?,?,?,?,?,?,?,?)`,
        [dayId, eid, k, e.series, e.repsMin, e.repsMax, e.descanso, e.obs]
      );
      total++;
    }
  }

  return {
    ok: true,
    rotina: payload.nome,
    dias: payload.dias.length,
    exercicios: total,
    ignorados,
  };
}

/** Backup completo — para trocar de aparelho sem perder histórico. */
export async function exportarBackup(): Promise<string> {
  const tabelas = [
    'profile',
    'body_metrics',
    'nutrition_targets',
    'routines',
    'routine_days',
    'routine_exercises',
    'workout_sessions',
    'set_logs',
    'personal_records',
    'water_logs',
    'meal_logs',
    'meal_log_items',
    'point_events',
    'user_stats',
    'user_achievements',
    'food_prefs',
  ];

  const dump: Record<string, unknown[]> = {};
  for (const t of tabelas) {
    try {
      dump[t] = await all(`SELECT * FROM ${t}`);
    } catch {
      dump[t] = [];
    }
  }
  return 'FORJABACKUP1:' + paraBase64(JSON.stringify(dump));
}

export function tamanhoLegivel(codigo: string): string {
  const kb = new Blob([codigo]).size / 1024;
  return kb < 1024 ? `${kb.toFixed(1).replace('.', ',')} KB` : `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}
