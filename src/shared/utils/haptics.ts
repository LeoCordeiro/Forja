import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Vibração tátil. No web não existe — daí o guard, senão quebra o preview.
 *
 * Regra de uso: toque leve confirma ação comum (marcar série), forte marca
 * evento raro (PR, medalha). Se tudo vibrar igual, nada significa nada.
 */
const ativo = Platform.OS !== 'web';

export const buzz = {
  leve: () => ativo && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medio: () => ativo && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  forte: () => ativo && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  ok: () => ativo && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  erro: () => ativo && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  aviso: () => ativo && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  selecao: () => ativo && Haptics.selectionAsync(),
};
