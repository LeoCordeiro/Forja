import { Platform } from 'react-native';
import { manterAudioVivo } from '@/shared/utils/alarme';

/**
 * Descanso que sobrevive a sair do app.
 *
 * O problema: um contador que faz `setTimeout(-1s)` para de contar quando o
 * navegador congela a aba. Você troca de app para ver uma mensagem, volta, e o
 * cronômetro está onde você deixou — mentindo sobre o tempo real.
 *
 * A correção tem três partes, e as três são necessárias:
 *
 * 1. **Guardar o instante em que acaba, não os segundos que faltam.** Assim o
 *    valor certo é sempre uma subtração, independente de quantos ticks o
 *    navegador engoliu. Isso sozinho já conserta o número na tela.
 * 2. **Persistir esse instante.** Fechar o app no meio do descanso e voltar
 *    devolve o tempo correto — inclusive já vencido.
 * 3. **Manter a aba viva enquanto descansa**, tocando um silêncio em loop. Sem
 *    isso o alarme não dispara em segundo plano: o navegador não executa nada
 *    para avisar. Com áudio ativo, iOS e Android mantêm a página rodando.
 *
 * E, como rede de segurança, uma notificação do sistema quando o tempo fecha
 * com o app fora da tela.
 */

const CHAVE = 'forja.descanso';

export interface DescansoAtivo {
  /** Timestamp em ms de quando o descanso termina. */
  fim: number;
  exercicio: string;
  serieFeita: number;
  serieTotal: number;
  proximo?: string;
}

// ── persistência ──────────────────────────────────────────────────────────
function armazem(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function salvarDescanso(d: DescansoAtivo | null) {
  const a = armazem();
  if (!a) return;
  try {
    if (d) a.setItem(CHAVE, JSON.stringify(d));
    else a.removeItem(CHAVE);
  } catch {
    /* modo privado do Safari pode recusar; o descanso só não sobrevive ao fechar */
  }
}

export function lerDescanso(): DescansoAtivo | null {
  const a = armazem();
  if (!a) return null;
  try {
    const bruto = a.getItem(CHAVE);
    if (!bruto) return null;
    const d = JSON.parse(bruto) as DescansoAtivo;
    // Mais de 10 minutos vencido é resto de uma sessão antiga, não descanso.
    if (typeof d.fim !== 'number' || Date.now() - d.fim > 600_000) {
      a.removeItem(CHAVE);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

/** Segundos que faltam. Passa a negativo de propósito: atraso é informação. */
export function restantes(fim: number): number {
  return Math.round((fim - Date.now()) / 1000);
}

// ── manter a aba acordada ─────────────────────────────────────────────────
/**
 * Enquanto o descanso corre, a sessão de áudio fica aberta — é isso que impede
 * o navegador de congelar a aba e engolir o alarme. A implementação vive em
 * `alarme.ts`, junto do contexto de áudio que já existia.
 */
export function manterAcordado(ligar: boolean) {
  if (Platform.OS !== 'web') return;
  manterAudioVivo(ligar);
}

// ── notificação ───────────────────────────────────────────────────────────
type Notif = {
  permission: string;
  requestPermission: () => Promise<string>;
  new (t: string, o?: object): unknown;
};

function api(): Notif | null {
  if (Platform.OS !== 'web') return null;
  return (globalThis as unknown as { Notification?: Notif }).Notification ?? null;
}

/**
 * Pede permissão no começo do treino, junto com o gesto de "iniciar".
 * Pedir na hora que o descanso acaba seria tarde: o pop-up não aparece com a
 * aba escondida, que é exatamente quando a notificação faria falta.
 */
export async function pedirPermissaoAviso() {
  const N = api();
  if (!N || N.permission !== 'default') return;
  try {
    await N.requestPermission();
  } catch {
    /* alguns navegadores exigem gesto direto; sem permissão, resta o som */
  }
}

export function avisarFimDoDescanso(proximo?: string) {
  const N = api();
  if (!N || N.permission !== 'granted') return;
  const doc = (globalThis as unknown as { document?: Document }).document;
  // Com o app na tela o alarme sonoro já resolve; notificação seria ruído.
  if (doc && doc.visibilityState === 'visible') return;

  try {
    new N('Descanso terminou', {
      body: proximo ? `Agora: ${proximo}` : 'Hora da próxima série.',
      icon: '/icone-192.png',
      badge: '/icone-192.png',
      tag: 'forja-descanso', // substitui a anterior em vez de empilhar
      requireInteraction: false,
    });
  } catch {
    /* ignorado: é redundância, não o caminho principal */
  }
}
