import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Notificações e alarmes.
 *
 * ── O que funciona onde, sem enrolação ───────────────────────────────────
 *
 * **APK Android**: tudo. Agendamento local de verdade — o lembrete dispara com
 * o app fechado, toca som, vibra e aparece na tela de bloqueio. É o que faz um
 * lembrete de água às 15h existir de fato.
 *
 * **PWA no iPhone**: notificação só com permissão e só se instalado na tela
 * inicial (iOS 16.4+), e **sem agendamento** — a Web só dispara notificação com
 * a página viva. Ou seja: no PWA o alarme de descanso funciona (o app está
 * aberto), mas "me lembre de beber água às 15h" não funciona.
 *
 * Isso não é limitação do app, é do navegador. Quem quiser lembrete que toca
 * com o celular no bolso e o app fechado precisa do APK — e o app diz isso na
 * cara em vez de agendar algo que nunca vai disparar.
 *
 * ── Por que canal separado para o alarme ─────────────────────────────────
 *
 * Fim de descanso não é notificação, é alarme: precisa furar o modo silencioso
 * da atenção, tocar alto e vibrar. Notificação de "beba água" precisa do
 * contrário — avisar sem assustar. No Android isso se resolve com dois canais
 * de importância diferente; misturar os dois faria a pessoa desligar os dois.
 */

export type CanalAviso = 'alarme' | 'lembrete';

export const suportaAgendamento = Platform.OS !== 'web';

// O app decide o que fazer com a notificação que chega com ele aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function prepararCanais() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('alarme', {
    name: 'Alarmes de treino',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 600],
    sound: 'default',
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('lembrete', {
    name: 'Lembretes do dia',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    sound: 'default',
  });
}

export async function pedirPermissao(): Promise<boolean> {
  try {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.granted) {
      await prepararCanais();
      return true;
    }
    const pedido = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false, allowCriticalAlerts: false },
    });
    if (pedido.granted) await prepararCanais();
    return pedido.granted;
  } catch {
    return false;
  }
}

export async function temPermissao(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// ── Alarme de descanso ────────────────────────────────────────────────────

const ID_DESCANSO = 'forja-descanso';

/**
 * Alarme para o fim do descanso.
 *
 * Agendado no momento em que a série é concluída, e cancelado se você seguir
 * antes. Assim o aviso toca mesmo com o celular no bolso e a tela apagada —
 * que é o cenário real de quem descansa 3 minutos entre séries pesadas.
 */
export async function agendarFimDoDescanso(segundos: number, proximo?: string) {
  if (!suportaAgendamento || segundos < 5) return;
  await cancelarAlarmeDescanso();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_DESCANSO,
      content: {
        title: '⏱️ Descanso terminou',
        body: proximo ? `Agora: ${proximo}` : 'Hora da próxima série.',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 400, 200, 400],
        ...(Platform.OS === 'android' ? { channelId: 'alarme' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: segundos,
      },
    });
  } catch {
    /* sem permissão: o alarme sonoro do app aberto continua valendo */
  }
}

export async function cancelarAlarmeDescanso() {
  if (!suportaAgendamento) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_DESCANSO);
  } catch {
    /* nada agendado */
  }
}

// ── Lembretes diários ─────────────────────────────────────────────────────

export interface Lembrete {
  chave: string;
  titulo: string;
  corpo: string;
  hora: number;
  minuto: number;
  /** Dias da semana em que repete. Vazio = todos. */
  dias?: number[];
}

/**
 * Reagenda tudo do zero.
 *
 * Cancelar e recriar em vez de reconciliar: o sistema é a fonte de verdade do
 * que está agendado, e tentar sincronizar dois estados produz notificação
 * duplicada — que é o jeito mais rápido de a pessoa desligar tudo.
 */
export async function reagendarLembretes(lembretes: Lembrete[]) {
  if (!suportaAgendamento) return;
  if (!(await temPermissao())) return;

  const agendadas = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of agendadas) {
    if (n.identifier !== ID_DESCANSO) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  for (const l of lembretes) {
    const dias = l.dias?.length ? l.dias : [null];
    for (const d of dias) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${l.chave}-${d ?? 'todos'}`,
          content: {
            title: l.titulo,
            body: l.corpo,
            sound: 'default',
            ...(Platform.OS === 'android' ? { channelId: 'lembrete' } : {}),
          },
          trigger:
            d === null
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DAILY,
                  hour: l.hora,
                  minute: l.minuto,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                  weekday: d + 1, // expo usa 1 = domingo
                  hour: l.hora,
                  minute: l.minuto,
                },
        });
      } catch {
        /* um lembrete que falha não pode derrubar os outros */
      }
    }
  }
}

/**
 * Monta os lembretes do dia a partir do que a pessoa já configurou.
 *
 * Nada de horário genérico: a água segue o plano calculado sobre a meta, o
 * treino segue a agenda semanal, e a refeição segue o horário do treino. Aviso
 * fora de hora é o que ensina a ignorar aviso.
 */
export function montarLembretes(cfg: {
  horariosAgua: string[];
  diasDeTreino: number[];
  horaTreino: string | null;
  horaDormir: string | null;
  pesarSemanalmente: boolean;
}): Lembrete[] {
  const out: Lembrete[] = [];

  for (const [i, h] of cfg.horariosAgua.entries()) {
    const [hora, minuto] = h.split(':').map(Number);
    if (Number.isNaN(hora)) continue;
    out.push({
      chave: `agua-${i}`,
      titulo: '💧 Hora da água',
      corpo: 'Um copo agora mantém a meta do dia sem ter que virar 1 litro à noite.',
      hora,
      minuto: minuto || 0,
    });
  }

  if (cfg.horaTreino && cfg.diasDeTreino.length) {
    const [h, m] = cfg.horaTreino.split(':').map(Number);
    if (!Number.isNaN(h)) {
      // 45 min antes: tempo de comer o pré-treino e sair de casa.
      const antes = (h * 60 + (m || 0) - 45 + 1440) % 1440;
      out.push({
        chave: 'treino',
        titulo: '🔥 Treino hoje',
        corpo: 'Falta pouco. Separa a roupa e come o pré-treino.',
        hora: Math.floor(antes / 60),
        minuto: antes % 60,
        dias: cfg.diasDeTreino,
      });
    }
  }

  if (cfg.horaDormir) {
    const [h, m] = cfg.horaDormir.split(':').map(Number);
    if (!Number.isNaN(h)) {
      const antes = (h * 60 + (m || 0) - 30 + 1440) % 1440;
      out.push({
        chave: 'sono',
        titulo: '😴 Meia hora para dormir',
        corpo: 'É dormindo que o músculo do treino de hoje é construído.',
        hora: Math.floor(antes / 60),
        minuto: antes % 60,
      });
    }
  }

  if (cfg.pesarSemanalmente) {
    out.push({
      chave: 'medida',
      titulo: '📏 Medir cintura e peso',
      corpo: 'Mesmo dia, mesma hora, em jejum. É a comparação que vale.',
      hora: 7,
      minuto: 0,
      dias: [1], // segunda: começo de semana e antes do fim de semana pesar
    });
  }

  return out;
}

export async function listarAgendados(): Promise<number> {
  if (!suportaAgendamento) return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
