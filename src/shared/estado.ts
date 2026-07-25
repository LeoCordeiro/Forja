import { create } from 'zustand';

interface AppState {
  /** null = ainda não verificado. O gate de rotas em app/_layout depende disso. */
  temPerfil: boolean | null;
  setTemPerfil: (v: boolean) => void;
}

/**
 * Estado mínimo compartilhado entre o onboarding e o gate de navegação.
 *
 * Sem isto o layout só descobre que existe perfil na montagem: ao terminar o
 * onboarding ele ainda acharia que não há perfil e jogaria a pessoa de volta
 * para o passo 1.
 */
export const useApp = create<AppState>((set) => ({
  temPerfil: null,
  setTemPerfil: (v) => set({ temPerfil: v }),
}));
