import { equipamentosDe, foraDoLocal, labelLocal } from './local';
import { bloqueadoPorDor, type ExercicioParaDor } from './contraindicacao';

/**
 * Quem pode entrar no lugar do exercício, no meio do treino.
 *
 * ── O buraco que isto fecha ──────────────────────────────────────────────
 *
 * `substitutosDisponiveis` devolvia o mapa `SUBSTITUICOES` cru. O gerador
 * gastava o plano inteiro protegendo a pessoa — tira o desenvolvimento militar
 * de quem marcou dor no ombro, tira o que a academia não tem — e a proteção
 * era desfeita em um toque, no ponto de maior risco: no meio da sessão, com
 * pressa, aparelho ocupado, e a sugestão contraindicada em PRIMEIRO lugar na
 * lista.
 *
 * O fluxo concreto, medido: perfil com dor no ombro → o gerador exclui o
 * militar → na sessão o usuário troca o desenvolvimento com halteres porque o
 * aparelho está ocupado → o sheet oferece "Desenvolvimento militar" como
 * primeira opção. Nas combinações que o harness varre, o mapa cru oferecia
 * substituto contraindicado 275 vezes e substituto que o local não tem 4.746.
 *
 * ── Por que é função pura, e não SQL dentro da tela ──────────────────────
 *
 * Porque assim ela é exercitável contra o catálogo inteiro × cada dor × cada
 * local, que é a única escala em que este tipo de buraco aparece. A casca com
 * banco vive em `api.ts` e não decide nada.
 *
 * ── E por que a recusa é DEVOLVIDA, em vez de a opção só sumir ───────────
 *
 * Opção que some sem explicação, no meio do treino, parece bug do app. "O
 * militar não está aqui porque você marcou dor no ombro" é a diferença entre a
 * pessoa confiar na lista curta e procurar o exercício na mão.
 */

export interface ContextoTroca {
  /** Regiões marcadas no perfil (`profile.dores`, já quebrado em lista). */
  dores: string[];
  /** Chave de `LOCAIS`. */
  local: string;
}

export interface RecusaTroca {
  nome: string;
  /** `dor` é o que a tela mostra; `local` a pessoa já sabe (é a academia dela). */
  tipo: 'dor' | 'local';
  motivo: string;
}

export interface SaidaTroca<T> {
  permitidos: T[];
  recusados: RecusaTroca[];
}

/**
 * Filtra os candidatos a substituto.
 *
 * A ordem de entrada é preservada: quem chama põe primeiro os substitutos
 * mapeados (equivalentes de verdade) e depois o resto do grupo muscular.
 */
export function filtrarSubstitutos<T extends ExercicioParaDor>(
  atual: string,
  candidatos: T[],
  ctx: ContextoTroca
): SaidaTroca<T> {
  const equipamentos = new Set(equipamentosDe(ctx.local));
  const semLocal = foraDoLocal(ctx.local);
  const permitidos: T[] = [];
  const recusados: RecusaTroca[] = [];
  const vistos = new Set<string>();

  for (const c of candidatos) {
    // Trocar um exercício por ele mesmo não é recusa, é ruído: nem entra.
    if (c.nome === atual || vistos.has(c.nome)) continue;
    vistos.add(c.nome);

    if ((c.equipamento && !equipamentos.has(c.equipamento)) || semLocal.has(c.nome)) {
      recusados.push({
        nome: c.nome,
        tipo: 'local',
        motivo: `Não tem em ${labelLocal(ctx.local).toLowerCase()}.`,
      });
      continue;
    }

    const dor = bloqueadoPorDor(c, ctx.dores);
    if (dor) {
      recusados.push({ nome: c.nome, tipo: 'dor', motivo: dor.motivo });
      continue;
    }

    permitidos.push(c);
  }

  return { permitidos, recusados };
}
