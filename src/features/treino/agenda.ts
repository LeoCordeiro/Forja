import { all, first, run } from '@/db/client';
export { PADROES } from './padroes';
import { PADROES } from './padroes';
import { mapaDeRecuperacao, type RecuperacaoGrupo } from './recuperacao';

/**
 * Agenda semanal: cada dia tem dono, e o app recalcula quando você fura.
 *
 * ── Por que dia fixo ────────────────────────────────────────────────────
 *
 * "Treine 3× por semana" não é plano — é intenção. Sem dia marcado, a decisão
 * de treinar volta a ser tomada todo dia, e decisão tomada todo dia é decisão
 * que uma hora sai não.
 *
 * Mas dia fixo sozinho cria o problema oposto: quem furou segunda faz o treino
 * de segunda na terça, o de terça na quarta, e em duas semanas está fazendo
 * peito três dias seguidos sem perceber. É aí que a agenda precisa pensar.
 *
 * ── A regra que não pode ser quebrada ───────────────────────────────────
 *
 * Um grupo muscular não volta a ser treinado em menos de ~48 h. A síntese
 * proteica fica elevada por 24 a 48 h depois da sessão, e treinar de novo
 * dentro dessa janela não soma estímulo — soma fadiga. Peito na segunda, peito
 * na terça e peito na quarta é uma sessão boa seguida de duas ruins.
 *
 * O Position Stand do ACSM de 2026 fecha do outro lado: cada grupo precisa
 * aparecer **pelo menos 2× por semana**. Junte as duas coisas e a distância
 * ideal entre sessões do mesmo grupo é de 48 a 96 h — que é exatamente o que
 * uma semana bem distribuída produz sozinha.
 *
 * ── Como o recálculo decide ─────────────────────────────────────────────
 *
 * Quando você fura, o app não empurra a fila. Ele escolhe entre os treinos
 * pendentes o que tem os músculos mais recuperados E está devendo há mais
 * tempo. Treino cujo grupo principal treinou há menos de 48 h fica de fora,
 * mesmo que seja "a vez dele".
 */

export type TipoDoDia = 'treino' | 'cardio' | 'mobilidade' | 'descanso';

export interface DiaDaAgenda {
  /** 0 = domingo. */
  diaSemana: number;
  letra: string;
  nome: string;
  tipo: TipoDoDia;
  routineDayId: number | null;
  rotuloTreino: string | null;
  /** Grupos que o treino desse dia ataca. */
  grupos: string[];
}

const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Distância mínima entre duas sessões do mesmo grupo. */
export const HORAS_MINIMAS = 44;

// ── Leitura ───────────────────────────────────────────────────────────────

export async function agendaSemanal(): Promise<DiaDaAgenda[]> {
  const dias = await all<{
    id: number;
    nome: string;
    dia_semana: number | null;
    tipo: string | null;
  }>(
    `SELECT rd.id, rd.nome, rd.dia_semana, rd.tipo
       FROM routine_days rd
       JOIN routines r ON r.id = rd.routine_id
      WHERE r.ativa = 1
      ORDER BY rd.ordem`
  );

  const grupos = await gruposPorDia(dias.map((d) => d.id));

  return Array.from({ length: 7 }, (_, i) => {
    const d = dias.find((x) => x.dia_semana === i);
    if (!d) {
      return {
        diaSemana: i,
        letra: LETRAS[i],
        nome: NOMES[i],
        tipo: 'descanso' as const,
        routineDayId: null,
        rotuloTreino: null,
        grupos: [],
      };
    }
    return {
      diaSemana: i,
      letra: LETRAS[i],
      nome: NOMES[i],
      tipo: (d.tipo === 'cardio' ? 'cardio' : d.tipo === 'mobilidade' ? 'mobilidade' : 'treino') as TipoDoDia,
      routineDayId: d.id,
      rotuloTreino: d.nome,
      grupos: grupos[d.id] ?? [],
    };
  });
}

async function gruposPorDia(ids: number[]): Promise<Record<number, string[]>> {
  if (!ids.length) return {};
  const marcas = ids.map(() => '?').join(',');
  const rows = await all<{ routine_day_id: number; grupo_primario: string; n: number }>(
    `SELECT re.routine_day_id, e.grupo_primario, COUNT(*) AS n
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_day_id IN (${marcas}) AND e.grupo_primario != 'cardio'
      GROUP BY re.routine_day_id, e.grupo_primario
      ORDER BY n DESC`,
    ids
  );
  const out: Record<number, string[]> = {};
  for (const r of rows) {
    if (!out[r.routine_day_id]) out[r.routine_day_id] = [];
    // Só os grupos que o dia treina de verdade — 1 exercício solto não define
    // o dia e não deveria bloquear a agenda inteira.
    if (r.n >= 2) out[r.routine_day_id].push(r.grupo_primario);
  }
  return out;
}

export async function definirDia(routineDayId: number, diaSemana: number | null) {
  // Um dia da semana tem um dono só: atribuir libera quem estava lá.
  if (diaSemana !== null) {
    await run(
      `UPDATE routine_days SET dia_semana = NULL
        WHERE dia_semana = ?
          AND routine_id IN (SELECT id FROM routines WHERE ativa = 1)`,
      [diaSemana]
    );
  }
  await run('UPDATE routine_days SET dia_semana = ? WHERE id = ?', [diaSemana, routineDayId]);
}

/**
 * Distribui os dias de treino na semana automaticamente.
 *
 * Espalha em vez de amontoar: com 3 treinos, segunda/quarta/sexta; com 4,
 * segunda/terça/quinta/sexta. É a distribuição que maximiza a distância entre
 * sessões do mesmo grupo sem precisar saber quais grupos são.
 */

/**
 * Distribui olhando os MÚSCULOS, não só a quantidade de dias.
 *
 * A primeira versão só espalhava as datas — e produziu "quinta e sexta treinam
 * costas", exatamente o problema que a agenda existe para evitar. Espaçar dias
 * não é a mesma coisa que espaçar grupos musculares: dois treinos diferentes
 * podem atacar as mesmas costas.
 *
 * Agora cada treino é colocado no encaixe que deixa a MAIOR distância possível
 * até outro dia que compartilhe grupo com ele. A semana é circular — domingo
 * encosta na segunda —, então a conta considera as duas direções.
 */
export async function distribuirAutomaticamente(): Promise<void> {
  const dias = await all<{ id: number }>(
    `SELECT rd.id FROM routine_days rd
       JOIN routines r ON r.id = rd.routine_id
      WHERE r.ativa = 1 ORDER BY rd.ordem`
  );
  if (!dias.length) return;

  const grupos = await gruposPorDia(dias.map((d) => d.id));
  const encaixes = PADROES[Math.min(6, dias.length)] ?? [1, 3, 5];

  /** Distância circular entre dois dias da semana, em dias. */
  const dist = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, 7 - d);
  };

  const colocados: { dia: number; grupos: string[] }[] = [];
  const livres = [...encaixes];
  // Treino com mais grupos primeiro: ele é o mais difícil de encaixar, e
  // deixar o difícil por último é como se produz conflito.
  const ordem = [...dias].sort(
    (a, b) => (grupos[b.id]?.length ?? 0) - (grupos[a.id]?.length ?? 0)
  );

  for (const d of ordem) {
    const meus = grupos[d.id] ?? [];

    let melhor = livres[0];
    let melhorNota = -Infinity;

    for (const candidato of livres) {
      // Nota do encaixe = menor distância até um dia que compartilha grupo.
      // Sem grupo em comum, a distância é infinita — pode ficar em qualquer
      // lugar. Empate cai para o encaixe mais cedo, que mantém a ordem.
      let nota = Infinity;
      for (const c of colocados) {
        if (!c.grupos.some((g) => meus.includes(g))) continue;
        nota = Math.min(nota, dist(candidato, c.dia));
      }
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = candidato;
      }
    }

    await definirDia(d.id, melhor);
    colocados.push({ dia: melhor, grupos: meus });
    livres.splice(livres.indexOf(melhor), 1);
  }
}

// ── O que fazer hoje ──────────────────────────────────────────────────────

export interface Recomendacao {
  tipo: TipoDoDia;
  routineDayId: number | null;
  titulo: string;
  /** Por que ESTE e não outro. Sem isso o app vira caixa-preta. */
  motivo: string;
  /** true quando o que está sendo sugerido não é o do calendário. */
  remanejado: boolean;
  /** Treinos que ficaram para trás e ainda cabem nesta semana. */
  atrasados: string[];
}

export async function oQueFazerHoje(hojeDiaSemana = new Date().getDay()): Promise<Recomendacao> {
  const agenda = await agendaSemanal();
  const recup = await mapaDeRecuperacao();
  const plano = agenda[hojeDiaSemana];

  const feitos = await treinosDaSemana();
  const jaFezHoje = feitos.some((f) => f.diaSemana === hojeDiaSemana);

  if (jaFezHoje) {
    return {
      tipo: 'descanso',
      routineDayId: null,
      titulo: 'Você já treinou hoje',
      motivo: 'Duas sessões no mesmo dia não somam — a segunda entra em cima da fadiga da primeira.',
      remanejado: false,
      atrasados: [],
    };
  }

  // Treinos da semana que ainda não foram feitos.
  const pendentes = agenda.filter(
    (d) =>
      d.tipo === 'treino' &&
      d.routineDayId !== null &&
      !feitos.some((f) => f.routineDayId === d.routineDayId)
  );

  const podeHoje = (d: DiaDaAgenda) => descansoSuficiente(d.grupos, recup);

  // 1) O do calendário, se os músculos estiverem prontos.
  if (plano?.tipo === 'treino' && plano.routineDayId && podeHoje(plano)) {
    return {
      tipo: 'treino',
      routineDayId: plano.routineDayId,
      titulo: plano.rotuloTreino ?? 'Treino',
      motivo: `${plano.nome} é o dia dele, e os músculos estão descansados.`,
      remanejado: false,
      atrasados: atrasadosAntes(pendentes, hojeDiaSemana, plano.routineDayId),
    };
  }

  // 2) O calendário mandou treinar, mas o grupo ainda não recuperou.
  if (plano?.tipo === 'treino' && plano.routineDayId && !podeHoje(plano)) {
    const alternativa = pendentes
      .filter((d) => d.routineDayId !== plano.routineDayId && podeHoje(d))
      .sort((a, b) => folga(a.grupos, recup) - folga(b.grupos, recup))
      .pop();

    if (alternativa?.routineDayId) {
      return {
        tipo: 'treino',
        routineDayId: alternativa.routineDayId,
        titulo: alternativa.rotuloTreino ?? 'Treino',
        motivo:
          `Hoje era ${plano.rotuloTreino}, mas ${nomearGrupos(plano.grupos)} ainda não completou ` +
          `${HORAS_MINIMAS} h de descanso. Este está pronto e devendo há mais tempo.`,
        remanejado: true,
        atrasados: [],
      };
    }

    return {
      tipo: 'mobilidade',
      routineDayId: null,
      titulo: 'Mobilidade ou cardio leve',
      motivo:
        `Nenhum treino da semana está com os músculos descansados. Forçar hoje soma fadiga, ` +
        `não estímulo — amanhã rende mais.`,
      remanejado: true,
      atrasados: pendentes.map((p) => p.rotuloTreino!).filter(Boolean),
    };
  }

  // 3) Dia sem treino marcado: se sobrou treino atrasado e dá para fazer, faz.
  const recuperar = pendentes
    .filter((d) => d.diaSemana < hojeDiaSemana && podeHoje(d))
    .sort((a, b) => a.diaSemana - b.diaSemana)[0];

  if (recuperar?.routineDayId) {
    return {
      tipo: 'treino',
      routineDayId: recuperar.routineDayId,
      titulo: recuperar.rotuloTreino ?? 'Treino',
      motivo: `Ficou pendente de ${recuperar.nome} e os músculos estão prontos. Hoje dá para recuperar.`,
      remanejado: true,
      atrasados: pendentes
        .filter((p) => p.routineDayId !== recuperar.routineDayId)
        .map((p) => p.rotuloTreino!)
        .filter(Boolean),
    };
  }

  // 4) O que o calendário mandou (cardio, mobilidade ou descanso).
  const rotulos: Record<TipoDoDia, string> = {
    treino: 'Treino',
    cardio: 'Cardio',
    mobilidade: 'Mobilidade',
    descanso: 'Descanso',
  };
  return {
    tipo: plano?.tipo ?? 'descanso',
    routineDayId: plano?.routineDayId ?? null,
    titulo: plano?.rotuloTreino ?? rotulos[plano?.tipo ?? 'descanso'],
    motivo:
      plano?.tipo === 'descanso'
        ? 'Descanso é parte do plano: é dormindo e parado que o músculo construído no treino aparece.'
        : `${plano?.nome ?? 'Hoje'} é dia de ${rotulos[plano?.tipo ?? 'descanso'].toLowerCase()}.`,
    remanejado: false,
    atrasados: pendentes.filter((p) => p.diaSemana < hojeDiaSemana).map((p) => p.rotuloTreino!),
  };
}

/** Nenhum grupo principal do dia pode estar dentro da janela de recuperação. */
function descansoSuficiente(grupos: string[], recup: RecuperacaoGrupo[]): boolean {
  if (!grupos.length) return true;
  return grupos.every((g) => {
    const r = recup.find((x) => x.grupo === g);
    return !r || r.horasDesde === null || r.horasDesde >= HORAS_MINIMAS;
  });
}

/** Quão folgado está o dia: usa o grupo MENOS recuperado como gargalo. */
function folga(grupos: string[], recup: RecuperacaoGrupo[]): number {
  if (!grupos.length) return 999;
  return Math.min(
    ...grupos.map((g) => recup.find((x) => x.grupo === g)?.horasDesde ?? 999)
  );
}

function nomearGrupos(g: string[]): string {
  const nomes: Record<string, string> = {
    peito: 'peito',
    costas: 'costas',
    ombro: 'ombro',
    biceps: 'bíceps',
    triceps: 'tríceps',
    quadriceps: 'quadríceps',
    posterior: 'posterior',
    gluteo: 'glúteo',
  };
  return g.map((x) => nomes[x] ?? x).join(' e ') || 'o grupo do dia';
}

function atrasadosAntes(pendentes: DiaDaAgenda[], hoje: number, excetoId: number): string[] {
  return pendentes
    .filter((p) => p.diaSemana < hoje && p.routineDayId !== excetoId)
    .map((p) => p.rotuloTreino!)
    .filter(Boolean);
}

/** Treinos concluídos desde a segunda-feira desta semana. */
async function treinosDaSemana(): Promise<{ routineDayId: number | null; diaSemana: number }[]> {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  inicio.setHours(0, 0, 0, 0);

  const rows = await all<{ routine_day_id: number | null; iniciado_em: number }>(
    `SELECT routine_day_id, iniciado_em FROM workout_sessions
      WHERE finalizado_em IS NOT NULL AND iniciado_em >= ?`,
    [inicio.getTime()]
  );
  return rows.map((r) => ({
    routineDayId: r.routine_day_id,
    diaSemana: new Date(r.iniciado_em).getDay(),
  }));
}

/** Quantos dias de treino a rotina ativa tem — usado para sugerir o padrão. */
export async function contarDiasDeTreino(): Promise<number> {
  const r = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM routine_days rd
       JOIN routines r ON r.id = rd.routine_id WHERE r.ativa = 1`
  );
  return r?.n ?? 0;
}
