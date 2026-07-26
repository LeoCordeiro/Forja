/**
 * Vídeos de execução por exercício — IDs do YouTube.
 *
 * GERADO POR `node scripts/videos.mjs`. Não editar à mão sem necessidade:
 * a próxima execução do script preserva o que já está aqui, então um ID
 * corrigido manualmente sobrevive.
 *
 * Todos foram validados via oEmbed no momento da coleta — quer dizer que o
 * vídeo era público E permitia ser embutido. Se algum sair do ar depois, o app
 * cai na demonstração em imagens e oferece a busca no YouTube.
 */

export const VIDEOS: Record<string, string> = {
  'Abdominal infra': 'ixJcUH8AlL8',
  'Abdominal na polia': 'I64bjVbs7XI',
  'Abdominal supra': 'byJVYH03490',
  'Abdução na máquina': 'rsCFUcbhTnQ',
  'Afundo com barra': 'X4AM49unQUc',
  'Afundo com halteres': 'wWKI8rsq_6Y',
  'Agachamento frontal': 'syfDrU220FU',
  'Agachamento livre': 'rM6SDUdl9fs',
  'Barra fixa': '5zK5kEyAK4w',
  'Barra fixa supinada': 'RX-zKIbcg3s',
  'Bicicleta ergométrica': 'DV3k01KFUz4',
  'Cadeira extensora': 'el3oHblB5DM',
  'Cadeira flexora': 'Zss6E3VU6X0',
  'Coice na polia': 'RONwI0wM-Mw',
  'Crossover na polia': 'pdMWt71MPlw',
  'Crucifixo com halteres': 'uDMmccuPVPQ',
  'Crucifixo inclinado': 'uy9Xk3SVrms',
  'Crucifixo inverso': 'EWwR2Z-yHjQ',
  'Desenvolvimento Arnold': 'Qjv_6bwRlnE',
  'Desenvolvimento com halteres': 'eufDL9MmF8A',
  'Desenvolvimento militar': 'dxQCyYawS-0',
  'Elevação de pernas na barra': 'nPmIwKvB3kI',
  'Elevação frontal': 'NxSuojHZa8k',
  'Elevação lateral': '3vbYw9xklBc',
  'Elevação pélvica com barra': 'uWCPu8Ngwuk',
  'Elíptico': 'Rltlu55sBLE',
  'Encolhimento': 'AdkMdSoRVPE',
  'Escalador': 'rj1BYRCeuAQ',
  'Esteira': 'nQdMzvhaSrI',
  'Face pull': 'GKQOpTgR_DE',
  'Flexão de braço': 'Azw6BZ8-wSM',
  'Hack machine': 'Whp712OHPl8',
  'Hiperextensão lombar': '0ssEGdsjGWw',
  'Leg press': 'waAxlYvtCcI',
  'Levantamento terra': '50AkPBZwACQ',
  'Levantamento terra romeno': 'jSomWOwLiGE',
  'Mergulho entre bancos': 'UJrHB5J9-TA',
  'Mergulho no paralelo': 'TCVj8cliLNo',
  'Mesa flexora': '2-ULaRrQa7c',
  'Panturrilha em pé': 'nm4W5nJB7ZI',
  'Panturrilha no leg press': 'Ua7jx6wKyMw',
  'Panturrilha sentado': 'tvMl4HM2B4o',
  'Prancha': 'qNRqGqESAWU',
  'Prancha lateral': '2NjO5KrlVEM',
  'Pular corda': 'sJ4N2V0svyw',
  'Pulldown com braço estendido': 'vbtQoblNq2Q',
  'Puxada frontal na polia': 'yzlQK3s-a_Y',
  'Puxada supinada': 'uA3IrbUAVKA',
  'Remada alta': 'iWYNrcd3Y4Y',
  'Remada baixa na polia': 'KFRcLgKhiw8',
  'Remada cavalinho': 'b-n8m51UIxc',
  'Remada curvada com barra': 'VJHBEy2duVc',
  'Remada unilateral com halter': 'm4h4jT9patY',
  'Remo ergômetro': '3Y9ZKnpuZ7E',
  'Rosca alternada com halteres': 'AuBN9_8Iihc',
  'Rosca concentrada': 'rjcgtMDJgSc',
  'Rosca direta com barra': '9G5eHUIANz4',
  'Rosca inversa': 'jbSr9CzJPmA',
  'Rosca martelo': '0qkQy8V2FC0',
  'Rosca na polia alta': 'vqpS2W73Ozo',
  'Rosca scott': 'wWKrF4iSU_8',
  'Russian twist': '4AFJrgd7HkU',
  'Stiff': 'NP548KPEpMw',
  'Supino fechado': 'X1Y1sBIs1Z0',
  'Supino inclinado com barra': 'TIMRYQKVvDk',
  'Supino inclinado com halteres': 'G-i3jMIbDmo',
  'Supino reto com barra': 'pCPyqW60Wuk',
  'Supino reto com halteres': 'Cjh2fIMQHk0',
  'Tríceps coice': '4DapiJicioo',
  'Tríceps francês': 'PlQOxSm_ZWI',
  'Tríceps na polia com barra': 'rDjhqg_cZWM',
  'Tríceps na polia com corda': '7le1JRUUagM',
  'Tríceps testa': 'VakpIeaaeXA',
  'Voador (peck deck)': 'FwtqdGlRgig',
};

/** Miniatura sem custo de player — carrega antes de decidir assistir. */
export function thumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
