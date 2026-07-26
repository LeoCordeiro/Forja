/**
 * Vídeos de execução por exercício — IDs do YouTube.
 *
 * GERADO POR `node scripts/videos.mjs`. Não editar à mão sem necessidade:
 * a próxima execução do script preserva o que já está aqui, então um ID
 * corrigido manualmente sobrevive.
 *
 * Dois critérios foram aplicados na coleta e valem para tudo que está aqui:
 * o vídeo é público E permite ser embutido (validado via oEmbed), e dura no
 * máximo 100 segundos. Exercício sem vídeo curto ficou sem vídeo — o app cai
 * na demonstração em imagens, que serve melhor que uma aula de três minutos
 * no meio de um descanso.
 */

export interface VideoExercicio {
  id: string;
  /** Duração em segundos — vira o selo na miniatura. */
  seg: number;
}

export const VIDEOS: Record<string, VideoExercicio> = {
  'Abdominal infra': { id: 'Z3uAk4QcXso', seg: 60 },
  'Abdominal na polia': { id: 'I64bjVbs7XI', seg: 68 },
  'Abdominal supra': { id: 't4PBYd481nk', seg: 72 },
  'Abdução na máquina': { id: 'vMPY_T598Lw', seg: 55 },
  'Afundo com barra': { id: 'nuzdKy7wylw', seg: 29 },
  'Afundo com halteres': { id: '6Zz_RG0EHFE', seg: 65 },
  'Agachamento frontal': { id: 'ra13PWkv0dA', seg: 64 },
  'Agachamento livre': { id: 'rM6SDUdl9fs', seg: 57 },
  'Barra fixa': { id: 'AveJ5SXC7vI', seg: 30 },
  'Barra fixa supinada': { id: 'cI6d4nTFlhM', seg: 61 },
  'Bicicleta ergométrica': { id: 'xUwn9YpoLrc', seg: 57 },
  'Cadeira extensora': { id: 'nEKiPWJFdFs', seg: 46 },
  'Cadeira flexora': { id: 'y9pl2WmFSfI', seg: 35 },
  'Coice na polia': { id: 'k6jcIcXdDTE', seg: 41 },
  'Crossover na polia': { id: 'pdMWt71MPlw', seg: 66 },
  'Crucifixo com halteres': { id: 'MFwQa9B-Cxw', seg: 40 },
  'Crucifixo inclinado': { id: 'EOr8ogwVF-Q', seg: 80 },
  'Crucifixo inverso': { id: 'eo4O-BvfjRk', seg: 38 },
  'Desenvolvimento Arnold': { id: 'yuOPcpMmYJk', seg: 65 },
  'Desenvolvimento com halteres': { id: 'MmHTcVK-1tU', seg: 36 },
  'Desenvolvimento militar': { id: 'aee3VLz4ATQ', seg: 40 },
  'Elevação de pernas na barra': { id: 'X1-2oGDeeMY', seg: 32 },
  'Elevação frontal': { id: 'TVo6PoqwSBQ', seg: 41 },
  'Elevação lateral': { id: 'YrrO1zmBIjw', seg: 41 },
  'Elevação pélvica com barra': { id: '6sTO9ejM-Ew', seg: 37 },
  'Elíptico': { id: 'pLe3w8WBAK4', seg: 26 },
  'Encolhimento': { id: 'YeILDnoeYEk', seg: 53 },
  'Escalador': { id: 'UBZVwnQcjb0', seg: 18 },
  'Esteira': { id: '0_RcQbYRHPY', seg: 84 },
  'Face pull': { id: 'QVO3jdjaNFg', seg: 33 },
  'Flexão de braço': { id: 'dHgoYiCraCw', seg: 76 },
  'Hack machine': { id: 'Whp712OHPl8', seg: 64 },
  'Hiperextensão lombar': { id: '9uIWj1DigsY', seg: 70 },
  'Leg press': { id: 'waAxlYvtCcI', seg: 56 },
  'Levantamento terra': { id: 'GntwG0iiSZ4', seg: 44 },
  'Levantamento terra romeno': { id: 'jSomWOwLiGE', seg: 48 },
  'Mergulho entre bancos': { id: 'ZWwUpWIbnrA', seg: 18 },
  'Mergulho no paralelo': { id: 'vmkWuV-nH2w', seg: 32 },
  'Mesa flexora': { id: '8Nat6GRiEoc', seg: 52 },
  'Panturrilha em pé': { id: 'of5Z7yj-HqY', seg: 54 },
  'Panturrilha no leg press': { id: 'Ua7jx6wKyMw', seg: 45 },
  'Panturrilha sentado': { id: 'Vp788-iQqiI', seg: 59 },
  'Prancha': { id: 'vCpPF6Pg0O0', seg: 23 },
  'Prancha lateral': { id: '2NjO5KrlVEM', seg: 55 },
  'Pular corda': { id: 'ok4hlxv8eGo', seg: 18 },
  'Pulldown com braço estendido': { id: 'H9UrtnL156I', seg: 79 },
  'Puxada frontal na polia': { id: '25XTUWnt_R4', seg: 59 },
  'Puxada supinada': { id: 'uA3IrbUAVKA', seg: 28 },
  'Remada alta': { id: 'iWYNrcd3Y4Y', seg: 93 },
  'Remada baixa na polia': { id: 'KFRcLgKhiw8', seg: 68 },
  'Remada cavalinho': { id: 'b-n8m51UIxc', seg: 31 },
  'Remada curvada com barra': { id: '_vO2dAnz__c', seg: 50 },
  'Remada unilateral com halter': { id: 'mygFHnzugN4', seg: 43 },
  'Remo ergômetro': { id: '3Y9ZKnpuZ7E', seg: 84 },
  'Rosca alternada com halteres': { id: 'yW3nvq6VTOQ', seg: 21 },
  'Rosca concentrada': { id: '33waMTscv_Q', seg: 43 },
  'Rosca direta com barra': { id: '0R7V2FXfFyQ', seg: 40 },
  'Rosca inversa': { id: 'Ji_KYs4w59U', seg: 64 },
  'Rosca martelo': { id: 'NmmtosqUDnM', seg: 46 },
  'Rosca na polia alta': { id: 'esNhGb27jyA', seg: 36 },
  'Rosca scott': { id: 'JWRoHF7I2NQ', seg: 47 },
  'Russian twist': { id: '4AFJrgd7HkU', seg: 60 },
  'Stiff': { id: 'BHfY5-jGNDA', seg: 54 },
  'Supino fechado': { id: 'X1Y1sBIs1Z0', seg: 41 },
  'Supino inclinado com barra': { id: 'TIMRYQKVvDk', seg: 43 },
  'Supino inclinado com halteres': { id: 'rCPwrZkrVVQ', seg: 45 },
  'Supino reto com barra': { id: 'pCPyqW60Wuk', seg: 47 },
  'Supino reto com halteres': { id: 'tDxKGeY-hjQ', seg: 43 },
  'Tríceps coice': { id: 'DXGH9_WAP50', seg: 56 },
  'Tríceps francês': { id: 'bBFx4_i_8Mo', seg: 41 },
  'Tríceps na polia com barra': { id: 'iioOkPqsVr0', seg: 80 },
  'Tríceps na polia com corda': { id: '7le1JRUUagM', seg: 44 },
  'Tríceps testa': { id: 'GwZzKiEmbcU', seg: 46 },
  'Voador (peck deck)': { id: 'QJT52jGuyVE', seg: 99 },
};

/** Miniatura sem custo de player — carrega antes de decidir assistir. */
export function thumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function duracaoCurta(seg: number): string {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}
