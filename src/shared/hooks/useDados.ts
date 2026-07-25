import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Carregador de dados do SQLite.
 *
 * Não usei TanStack Query porque aqui não existe rede, cache stale nem
 * revalidação — é leitura local em milissegundos. Recarregar ao focar a tela
 * resolve 100% dos casos e cabe em 30 linhas.
 */
export function useDados<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  opts: { aoFocar?: boolean } = { aoFocar: true }
) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<Error | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const r = await fn();
      setDados(r);
    } catch (e) {
      setErro(e as Error);
      console.error('[useDados]', e);
    } finally {
      setCarregando(false);
    }
    // fn muda a cada render; as deps do chamador é que definem quando recarregar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useFocusEffect(
    useCallback(() => {
      if (opts.aoFocar) carregar();
    }, [carregar, opts.aoFocar])
  );

  return { dados, carregando, erro, recarregar: carregar };
}
