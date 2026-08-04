import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Quantos pontos o teclado está cobrindo, agora.
 *
 * ── Por que não é só `KeyboardAvoidingView` ──────────────────────────────
 *
 * Porque o app real do Leonardo é o PWA no iPhone, e ali o
 * `KeyboardAvoidingView` do `react-native-web` não faz nada: ele depende dos
 * eventos `keyboardDidShow`/`keyboardWillShow`, que o web não emite. É a mesma
 * armadilha que a Fase 4 pagou com o `hitSlop` — a prop existe, o componente
 * aceita, e no aparelho de verdade o efeito é zero.
 *
 * Quem sabe a altura do teclado no navegador é o `visualViewport`: quando o
 * teclado sobe, o viewport visual encolhe e desloca. A diferença entre a
 * janela (`innerHeight`) e o viewport visual É a altura coberta.
 *
 * No app compilado (iOS/Android) o `Keyboard` continua sendo a fonte certa, e
 * o hook usa os dois — cada plataforma com a API que de fato funciona nela.
 *
 * ── Por que devolve número, e não um componente ──────────────────────────
 *
 * Porque quem precisa reagir é o `Sheet`, que já é `Modal` + posição absoluta
 * no bottom com `maxHeight` calculado. Embrulhar tudo num
 * `KeyboardAvoidingView` mudaria o layout de nove telas para resolver o de
 * quatro; com a altura na mão, o sheet só encolhe e sobe o próprio rodapé.
 */
export function useTeclado(): number {
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const medir = () => {
        // `offsetTop` entra porque o Safari desloca o viewport quando o campo
        // focado está embaixo: sem ele, a conta erra exatamente no caso que
        // este hook existe para resolver.
        const coberto = window.innerHeight - vv.height - vv.offsetTop;
        // Ruído de barra de endereço aparece como 1-2 px o tempo todo. Abaixo
        // de 80 não é teclado, e reagir a isso faria o sheet tremer.
        setAltura(coberto > 80 ? Math.round(coberto) : 0);
      };
      medir();
      vv.addEventListener('resize', medir);
      vv.addEventListener('scroll', medir);
      return () => {
        vv.removeEventListener('resize', medir);
        vv.removeEventListener('scroll', medir);
      };
    }

    // `will` no iOS (a animação do sheet acompanha o teclado) e `did` no
    // Android, que não emite os `will`.
    const mostrar = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const esconder = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const abriu = Keyboard.addListener(mostrar, (e) =>
      setAltura(Math.round(e.endCoordinates?.height ?? 0))
    );
    const fechou = Keyboard.addListener(esconder, () => setAltura(0));
    return () => {
      abriu.remove();
      fechou.remove();
    };
  }, []);

  return altura;
}
