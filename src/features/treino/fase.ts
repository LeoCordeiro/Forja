import {
  LABEL_FASE,
  planoRetorno,
  RIR_POR_FASE,
  textoAjusteDaFase,
  type Fase,
} from './periodizacao';
import { BLOCO, faseDaSemanaDoBloco, SEMANAS_DO_BLOCO } from './programa';
import { deIso, diasEntre } from '@/shared/utils/date';

/**
 * A fase que vale para UMA sessão de treino.
 *
 * O app sempre teve duas fontes de fase — o plano de retorno pós-pausa e o
 * bloco de 8 semanas — mas as duas eram só decorativas: a Home e a tela do
 * programa mostravam "semana leve, volume 55%" enquanto o executor abria a
 * sessão com 100% das séries. Este módulo resolve qual fonte manda e entrega
 * um único resultado que o executor consegue aplicar.
 *
 * ── Por que a resolução pode devolver null ──────────────────────────────
 *
 * Nem `faseDaSemana` nem `semanaDoBloco` expiram: os dois clampam na última
 * semana, que nos dois planos é a leve. Aplicar volume cegamente deixaria
 * qualquer usuário com `retomou_em` antigo ou bloco vencido em DELOAD
 * PERMANENTE — metade das séries para sempre, sem aviso. Plano vencido aqui
 * significa "sem modulação", e o app já avisa bloco vencido em outra tela.
 */
export interface FaseEfetiva {
  fonte: 'retorno' | 'bloco';
  fase: Fase;
  semana: number;
  /** % do volume da fase. Acima de 100 existe (semanas 5-7 do bloco) mas nunca infla séries. */
  volumePct: number;
  /** % da carga anterior a herdar. Null = mantém a carga (deload do bloco: "metade das séries, mesma carga"). */
  cargaPct: number | null;
  rir: { min: number; max: number } | null;
  /**
   * Chip curto da fase — **direção, nunca número absoluto** (M3-texto).
   *
   * Era "RIR 4-5", vindo de `RIR_POR_FASE.deload`, impresso no cabeçalho do
   * executor. Duas linhas abaixo, cada exercício mostrava o RIR dele vindo de
   * `rirNaFase` — e no deload o isolador recebe 2. A tela dizia 4-5 no topo e
   * 2 na linha, sobre o mesmo treino. Não havia número certo a pôr no topo: o
   * afrouxamento da fase é relativo ao alvo de cada exercício, e o alvo muda
   * com o papel. Agora o chip diz o que a fase FAZ ("afrouxe 1 a 2 reps") e o
   * número continua sendo o da linha.
   *
   * Vazio quando a fase não afrouxa nada (acúmulo e intensificação): ali o
   * alvo da linha já é o alvo da semana, e repetir isso no topo seria ruído.
   */
  rirTexto: string;
  /** Nome que o usuário já conhece das outras telas: "Readaptação", "Aliviar"… */
  titulo: string;
  /** A orientação da semana — nota do plano de retorno ou o_que_fazer do bloco. */
  descricao: string;
  /**
   * Meia-noite local do dia da retomada, em ms — só na fonte 'retorno'.
   *
   * É o divisor que impede o `cargaPct` de compor: a rampa do plano (67→73→80)
   * é percentual da carga PRÉ-PAUSA. Série registrada depois deste instante já
   * carrega a redução — aplicar o percentual de novo sobre ela viraria queda
   * geométrica (100 → 67 → 45 → 33…) numa semana em que a nota manda subir.
   */
  retomadaEmMs: number | null;
}

export interface ArgsFase {
  /** profile.retomou_em — âncora do plano de retorno. */
  retomouEm: string | null;
  mesesParado: number;
  /** routines.criado_em em ISO local — início do bloco de 8 semanas. */
  rotinaCriadaEmIso: string | null;
  /** A data que conta como "hoje" — para sessão, a data em que ela COMEÇOU. */
  hojeIso: string;
  /** workout_sessions.semana_plano: congela o alvo de sessão retomada dias depois. */
  semanaPlanoGravada?: number | null;
}

/** Semana 1-based decorrida entre duas datas ISO. */
function semanaDesde(inicioIso: string, hojeIso: string): number {
  return Math.max(1, Math.floor(diasEntre(inicioIso, hojeIso) / 7) + 1);
}

/** "2 a 3" → {min:2, max:3}; "1" → {min:1, max:1}. */
function parseRir(texto: string): { min: number; max: number } | null {
  const nums = texto.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return { min: nums[0], max: nums[nums.length - 1] };
}

/**
 * Resolve a fase efetiva com precedência: retorno em curso > bloco vigente >
 * nada. O plano de retorno manda porque a proteção é tendínea — tendão e
 * articulação se readaptam mais devagar que o músculo, e a lesão de quem
 * volta forte demais custa mais semanas que a cautela.
 */
export function resolverFase(args: ArgsFase): FaseEfetiva | null {
  // (a) Plano de retorno EM CURSO. `mesesParado < 1` gera o plano-nulo de
  // uma semana ("sem pausa relevante") — não é retorno, cai direto para (b).
  if (args.mesesParado >= 1 && (args.retomouEm || args.semanaPlanoGravada != null)) {
    const plano = planoRetorno(args.mesesParado);
    const semana =
      args.semanaPlanoGravada ??
      (args.retomouEm ? semanaDesde(args.retomouEm, args.hojeIso) : 1);

    // Plano vencido não clampa na semana leve: expira de verdade.
    if (semana >= 1 && semana <= plano.semanas.length) {
      const s = plano.semanas[semana - 1];
      const rir = { min: RIR_POR_FASE[s.fase].min, max: RIR_POR_FASE[s.fase].max };
      return {
        fonte: 'retorno',
        fase: s.fase,
        semana,
        volumePct: s.volumePct,
        cargaPct: s.cargaPct,
        rir,
        rirTexto: textoAjusteDaFase(s.fase),
        titulo: LABEL_FASE[s.fase],
        descricao: s.nota,
        retomadaEmMs: args.retomouEm ? deIso(args.retomouEm).getTime() : null,
      };
    }
  }

  // (b) Bloco de 8 semanas, ancorado no criado_em da rotina — a semana é
  // calculada SEM o clamp de `semanaDoBloco`, para o bloco vencido expirar.
  if (args.rotinaCriadaEmIso) {
    const dias = diasEntre(args.rotinaCriadaEmIso, args.hojeIso);
    const semana = dias < 0 ? 1 : Math.floor(dias / 7) + 1;
    if (semana > SEMANAS_DO_BLOCO) return null; // bloco vencido → sem modulação

    const s = BLOCO[semana - 1];
    const fase = faseDaSemanaDoBloco(s, semana);
    // O RIR da semana é o textual do bloco; no deload, o RIR_POR_FASE dá o
    // min/max ("4 a 5") que o texto cru da semana ("4") não tem.
    const rir =
      fase === 'deload'
        ? { min: RIR_POR_FASE.deload.min, max: RIR_POR_FASE.deload.max }
        : parseRir(s.rir);
    return {
      fonte: 'bloco',
      fase,
      semana,
      volumePct: s.volumePct,
      // Deload do bloco mantém carga: "metade das séries, mesma carga" — é o
      // peso que segura a força enquanto a fadiga sai.
      cargaPct: null,
      rir,
      rirTexto: textoAjusteDaFase(fase),
      titulo: s.titulo,
      descricao: s.o_que_fazer,
      retomadaEmMs: null,
    };
  }

  return null;
}

/**
 * Séries-alvo da sessão sob a fase. Modulação SÓ reduz: as semanas de 110%
 * do bloco orientam pelo texto ("entra uma série a mais nos principais") —
 * inflar o alvo de todo exercício silenciosamente não é o combinado.
 */
export function modularSeries(seriesAlvo: number, fase: FaseEfetiva | null): number {
  if (!fase || fase.volumePct >= 100) return seriesAlvo;
  // ── O piso é 2, e na readaptação a redução é de UMA série ──────────────
  //
  // B11 é explícita: "−1 série por exercício (não −50% linear)". O que precisa
  // cair na volta é a proximidade da falha e a carga absoluta, não a cobertura
  // de padrões — e cortar pela metade tira justamente os isoladores do fim,
  // que são os de menor demanda articular.
  //
  // E o piso de 2 não é enfeite: o piso de A7 cria exercício de 2 séries, e
  // `round(2 × 0,55)` devolvia 1 — exercício de série única é presença, não
  // estímulo, e B2 proíbe nos dois sentidos.
  if (fase.fase === 'readaptacao') return Math.max(2, seriesAlvo - 1);
  return Math.max(2, Math.round((seriesAlvo * fase.volumePct) / 100));
}
