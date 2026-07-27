import { ehComposto, ehPesado } from './classificacao';
import type { RoutineExerciseFull } from '@/db/types';

/**
 * Análise da ordem DESTE dia de treino.
 *
 * A versão anterior era uma lista fixa de regras — num dia de costas e bíceps
 * ela falava de agachamento e terra, exercícios que não estavam ali. Conselho
 * que não olha para o que está na tela é ruído.
 *
 * O enquadramento também mudou, e isso vem da evidência. A meta-análise de
 * Nunes (2021, 11 estudos) achou que a ordem afeta FORÇA — o ganho é maior no
 * exercício feito primeiro — mas **não afeta hipertrofia**: crescer, cresce
 * igual em qualquer ordem. E o Position Stand do ACSM de 2026 nem lista ordem
 * entre os fatores que puxam adaptação.
 *
 * Então nada aqui é "você está errando". É: você fica mais forte no que faz
 * primeiro, então escolha de propósito quem vem primeiro.
 */

export interface ObservacaoOrdem {
  tipo: 'nota' | 'atencao';
  titulo: string;
  texto: string;
}

/** Grupos que entram como ajudantes em compostos de outro grupo. */
const AJUDA_EM: Record<string, string[]> = {
  biceps: ['costas'],
  triceps: ['peito', 'ombro'],
  ombro: ['peito'],
  posterior: ['quadriceps', 'gluteo'],
  antebraco: ['costas'],
  trapezio: ['costas', 'ombro'],
};

const NOME_GRUPO: Record<string, string> = {
  peito: 'peito',
  costas: 'costas',
  ombro: 'ombros',
  biceps: 'bíceps',
  triceps: 'tríceps',
  quadriceps: 'quadríceps',
  posterior: 'posteriores',
  gluteo: 'glúteos',
  panturrilha: 'panturrilha',
  abdomen: 'abdômen',
  antebraco: 'antebraço',
  trapezio: 'trapézio',
  cardio: 'cardio',
};

const g = (k: string) => NOME_GRUPO[k] ?? k;

export function analisarOrdem(exercicios: RoutineExerciseFull[]): ObservacaoOrdem[] {
  if (exercicios.length === 0) return [];

  const obs: ObservacaoOrdem[] = [];
  const forca = exercicios.filter((e) => e.grupo_primario !== 'cardio');
  const primeiro = forca[0];

  // ── 1. Quem vem primeiro ────────────────────────────────────────────────
  if (primeiro) {
    obs.push({
      tipo: 'nota',
      titulo: `Primeiro: ${primeiro.nome}`,
      texto:
        `É neste que você mais vai ganhar força, porque chega nele descansado. ` +
        `Ordem quase não muda o crescimento do músculo — muda a força. Se hoje ` +
        `o que mais importa é outro exercício, ele é que deveria abrir.`,
    });
  }

  // ── 2. Cardio antes de peso ─────────────────────────────────────────────
  const iCardio = exercicios.findIndex((e) => e.grupo_primario === 'cardio');
  const iForca = exercicios.findIndex((e) => e.grupo_primario !== 'cardio');
  if (iCardio >= 0 && iForca >= 0 && iCardio < iForca) {
    obs.push({
      tipo: 'atencao',
      titulo: `${exercicios[iCardio].nome} está antes da musculação`,
      texto:
        'Cardio antes derruba a força do treino inteiro. Deixe para o fim, ou ' +
        'separe por umas 3 horas.',
    });
  } else if (iCardio >= 0) {
    obs.push({
      tipo: 'nota',
      titulo: `${exercicios[iCardio].nome} no fim`,
      texto:
        'Posição certa. Cardio depois da musculação não atrapalha a hipertrofia — ' +
        'o que atrapalha é fazer antes.',
    });
  }

  // ── 3. Isolador antes do composto que depende dele ──────────────────────
  // Rosca antes de remada é o caso clássico: o bíceps chega cansado e vira o
  // limitante da remada, que é onde as costas de fato trabalham.
  for (let i = 0; i < forca.length; i++) {
    const a = forca[i];
    if (ehComposto(a.nome)) continue;
    const ajuda = AJUDA_EM[a.grupo_primario];
    if (!ajuda) continue;

    const depois = forca.slice(i + 1).find((b) => ehComposto(b.nome) && ajuda.includes(b.grupo_primario));
    if (depois) {
      obs.push({
        tipo: 'atencao',
        titulo: `${a.nome} antes de ${depois.nome}`,
        texto:
          `O ${g(a.grupo_primario)} ajuda no ${depois.nome.toLowerCase()}. Cansado antes, ele vira ` +
          `o limite do exercício e o ${g(depois.grupo_primario)} recebe menos estímulo do que poderia.`,
      });
      break; // um aviso por dia basta; mais que isso vira lista de defeitos
    }
  }

  // ── 4. Abdômen antes de composto pesado ─────────────────────────────────
  const iAbs = forca.findIndex((e) => e.grupo_primario === 'abdomen');
  if (iAbs >= 0) {
    const pesadoDepois = forca.slice(iAbs + 1).find((e) => ehPesado(e.nome));
    if (pesadoDepois) {
      obs.push({
        tipo: 'atencao',
        titulo: `Abdômen antes de ${pesadoDepois.nome}`,
        texto:
          'O core segura a coluna nesse exercício. Esgotado antes, você perde ' +
          'estabilidade justo onde ela protege.',
      });
    } else {
      obs.push({
        tipo: 'nota',
        titulo: 'Abdômen no fim',
        texto: 'Posição certa — ele estabiliza os outros exercícios e precisa chegar inteiro neles.',
      });
    }
  }

  // ── 5. Sequência de grupos ──────────────────────────────────────────────
  const grupos = [...new Set(forca.map((e) => e.grupo_primario))];
  if (grupos.length > 1) {
    const alternando = forca.some((e, i) => i > 0 && i < forca.length - 1 &&
      e.grupo_primario !== forca[i - 1].grupo_primario &&
      forca.slice(i + 1).some((x) => x.grupo_primario === forca[i - 1].grupo_primario));
    if (alternando) {
      obs.push({
        tipo: 'atencao',
        titulo: 'Grupos embaralhados',
        texto:
          `Você volta a um grupo depois de já ter passado para outro. Agrupar ` +
          `(${grupos.map(g).join(' → ')}) mantém o músculo aquecido e evita ` +
          `esperar o mesmo aparelho duas vezes.`,
      });
    }
  }

  return obs;
}

/**
 * Frase de uma linha para o topo do dia: o que ele treina, na ordem.
 * Serve de resposta rápida ao "o que é este treino mesmo?".
 */
export function resumoDoDia(exercicios: RoutineExerciseFull[]): string {
  const grupos = [...new Set(exercicios.filter((e) => e.grupo_primario !== 'cardio').map((e) => e.grupo_primario))];
  if (grupos.length === 0) return 'Sem exercícios.';
  const series = exercicios.reduce((a, e) => a + e.series_alvo, 0);
  return `${series} séries · ${grupos.map(g).join(', ')}`;
}
