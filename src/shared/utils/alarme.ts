import { Platform } from 'react-native';
import { buzz } from './haptics';

/**
 * Alarme de fim de descanso.
 *
 * Gera o som por Web Audio em vez de tocar um arquivo: não precisa embarcar
 * áudio no bundle, funciona no PWA e toca instantaneamente — um `<audio>` com
 * arquivo tem latência de carregamento justo na hora que o aviso importa.
 *
 * No app nativo cai no haptic forte, que aliás funciona melhor com o celular
 * no bolso e a academia barulhenta.
 */

type Ctx = { ctx: AudioContext; ganho: GainNode } | null;
let cache: Ctx = null;

function contexto(): Ctx {
  if (Platform.OS !== 'web') return null;
  try {
    if (cache) return cache;
    const AC =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const ganho = ctx.createGain();
    ganho.connect(ctx.destination);
    cache = { ctx, ganho };
    return cache;
  } catch {
    return null;
  }
}

/**
 * Destrava o áudio.
 *
 * Navegadores só deixam tocar som depois de um gesto do usuário. Chamamos isto
 * ao iniciar o treino para que o alarme do descanso, que vem sem gesto nenhum,
 * já encontre o contexto liberado.
 */
export function prepararAudio() {
  const c = contexto();
  if (!c) return;
  if (c.ctx.state === 'suspended') void c.ctx.resume();
}

function bip(freq: number, inicio: number, duracao: number, volume: number) {
  const c = contexto();
  if (!c) return;
  const osc = c.ctx.createOscillator();
  const g = c.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(c.ganho);

  const t = c.ctx.currentTime + inicio;
  // Envelope: sem a rampa, o corte seco produz um "clique" desagradável.
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  osc.start(t);
  osc.stop(t + duracao + 0.02);
}

/** Contagem regressiva: bip curto e discreto nos últimos segundos. */
export function bipCurto() {
  const c = contexto();
  if (c) {
    if (c.ctx.state === 'suspended') void c.ctx.resume();
    bip(880, 0, 0.12, 0.18);
  }
  buzz.leve();
}

/** Fim do descanso: três bips ascendentes — impossível confundir com notificação. */
export function alarmeFimDescanso() {
  const c = contexto();
  if (c) {
    if (c.ctx.state === 'suspended') void c.ctx.resume();
    bip(660, 0, 0.16, 0.3);
    bip(880, 0.2, 0.16, 0.3);
    bip(1175, 0.4, 0.3, 0.34);
  }
  buzz.forte();
  // Repete a vibração: com o celular no bolso, um pulso só passa batido.
  setTimeout(() => buzz.forte(), 260);
  setTimeout(() => buzz.forte(), 520);
}

/** Descanso estourou muito: aviso mais insistente. */
export function alarmeAtraso() {
  const c = contexto();
  if (c) {
    if (c.ctx.state === 'suspended') void c.ctx.resume();
    bip(520, 0, 0.5, 0.28);
    bip(440, 0.55, 0.5, 0.28);
  }
  buzz.aviso();
}

/** Treino concluído. */
export function alarmeConclusao() {
  const c = contexto();
  if (c) {
    if (c.ctx.state === 'suspended') void c.ctx.resume();
    [523, 659, 784, 1047].forEach((f, i) => bip(f, i * 0.13, 0.3, 0.28));
  }
  buzz.ok();
}
