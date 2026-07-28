/**
 * Onde caem os treinos numa semana, por quantidade de dias.
 *
 * Fica num arquivo próprio, sem import nenhum, porque tanto a agenda (que fala
 * com o banco) quanto o gerador (que não deveria falar) precisam disto. Sem
 * essa separação, o núcleo de prescrição arrasta o React Native junto e deixa
 * de rodar no Node — que é onde `scripts/testar-gerador.mjs` confere as regras.
 */
export const PADROES: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};
